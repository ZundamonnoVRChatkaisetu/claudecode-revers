// HTTP/2 Subchannel Call implementation

const http2 = require('http2');
const { Status } = require('./status');
const { Metadata } = require('./metadata');
const { LogVerbosity, trace } = require('./logging');
const { getErrorCode } = require('./error-utils');

const TRACER_NAME = 'http2_stream';

// Map HTTP status codes to gRPC status codes
function mapHttpStatusToGrpc(httpStatusCode) {
  if (httpStatusCode >= 200 && httpStatusCode < 300) {
    return { code: Status.UNKNOWN, details: `Received HTTP status code ${httpStatusCode}` };
  }
  
  switch (httpStatusCode) {
    case 400:
      return { code: Status.INTERNAL, details: 'Bad Request' };
    case 401:
      return { code: Status.UNAUTHENTICATED, details: 'Unauthorized' };
    case 403:
      return { code: Status.PERMISSION_DENIED, details: 'Forbidden' };
    case 404:
      return { code: Status.UNIMPLEMENTED, details: 'Not Found' };
    case 429:
      return { code: Status.UNAVAILABLE, details: 'Too Many Requests' };
    case 502:
      return { code: Status.UNAVAILABLE, details: 'Bad Gateway' };
    case 503:
      return { code: Status.UNAVAILABLE, details: 'Service Unavailable' };
    case 504:
      return { code: Status.UNAVAILABLE, details: 'Gateway Timeout' };
    default:
      return { code: Status.UNKNOWN, details: `Received HTTP status code ${httpStatusCode}` };
  }
}

class Http2SubchannelCall {
  constructor(stream, callEventTracker, listener, transport, callNumber) {
    this.stream = stream;
    this.callEventTracker = callEventTracker;
    this.listener = listener;
    this.transport = transport;
    this.callNumber = callNumber;
    this.callId = callNumber;
    
    // State management
    this.decoder = null; // Message decoder
    this.isReadFilterPending = false;
    this.isPushPending = false;
    this.canPush = false;
    this.readsClosed = false;
    this.statusOutput = false;
    this.serverEndedCall = false;
    this.unpushedReadMessages = [];
    this.finalStatus = null;
    this.httpStatusCode = null;
    this.connectionDropped = false;
    this.internalError = null;
    
    // Set up stream event handlers
    this.setupStreamHandlers();
  }

  setupStreamHandlers() {
    const stream = this.stream;
    
    // Headers event
    stream.on('response', (headers, flags) => {
      let headersString = '';
      for (const [key, value] of Object.entries(headers)) {
        headersString += `\\t\\t${key}: ${value}\\n`;
      }
      
      this.trace(`Received server headers:\\n${headersString}`);
      this.httpStatusCode = headers[':status'];
      
      if (flags & http2.constants.NGHTTP2_FLAG_END_STREAM) {
        this.handleTrailers(headers);
      } else {
        try {
          const metadata = Metadata.fromHttp2Headers(headers);
          this.listener.onReceiveMetadata(metadata);
        } catch (error) {
          this.endCall({
            code: Status.UNKNOWN,
            details: error.message,
            metadata: new Metadata()
          });
        }
      }
    });
    
    // Trailers event
    stream.on('trailers', (headers) => {
      this.handleTrailers(headers);
    });
    
    // Data event
    stream.on('data', (chunk) => {
      if (this.statusOutput) return;
      
      this.trace(`receive HTTP/2 data frame of length ${chunk.length}`);
      
      let messages;
      try {
        messages = this.decoder.write(chunk);
      } catch (error) {
        if (this.httpStatusCode !== undefined && this.httpStatusCode !== 200) {
          const status = mapHttpStatusToGrpc(this.httpStatusCode);
          this.cancelWithStatus(status.code, status.details);
        } else {
          this.cancelWithStatus(Status.RESOURCE_EXHAUSTED, error.message);
        }
        return;
      }
      
      for (const message of messages) {
        this.trace(`parsed message of length ${message.length}`);
        this.callEventTracker.addMessageReceived();
        this.tryPush(message);
      }
    });
    
    // End event
    stream.on('end', () => {
      this.readsClosed = true;
      this.maybeOutputStatus();
    });
    
    // Close event
    stream.on('close', () => {
      this.serverEndedCall = true;
      process.nextTick(() => {
        this.handleStreamClose();
      });
    });
    
    // Error event
    stream.on('error', (error) => {
      if (error.code !== 'ERR_HTTP2_STREAM_ERROR') {
        this.trace(`Node error event: message=${error.message} code=${error.code} errno=${getErrorCode(error.errno)} syscall=${error.syscall}`);
        this.internalError = error;
      }
      this.callEventTracker.onStreamEnd(false);
    });
  }

  handleStreamClose() {
    if (this.finalStatus?.code === Status.OK) return;
    
    let code;
    let details = '';
    
    switch (this.stream.rstCode) {
      case http2.constants.NGHTTP2_NO_ERROR:
        if (this.finalStatus !== null) return;
        
        if (this.httpStatusCode && this.httpStatusCode !== 200) {
          const status = mapHttpStatusToGrpc(this.httpStatusCode);
          code = status.code;
          details = status.details;
        } else {
          code = Status.INTERNAL;
          details = `Received RST_STREAM with code ${this.stream.rstCode} (Call ended without gRPC status)`;
        }
        break;
        
      case http2.constants.NGHTTP2_REFUSED_STREAM:
        code = Status.UNAVAILABLE;
        details = 'Stream refused by server';
        break;
        
      case http2.constants.NGHTTP2_CANCEL:
        if (this.connectionDropped) {
          code = Status.UNAVAILABLE;
          details = 'Connection dropped';
        } else {
          code = Status.CANCELLED;
          details = 'Call cancelled';
        }
        break;
        
      case http2.constants.NGHTTP2_ENHANCE_YOUR_CALM:
        code = Status.RESOURCE_EXHAUSTED;
        details = 'Bandwidth exhausted or memory limit exceeded';
        break;
        
      case http2.constants.NGHTTP2_INADEQUATE_SECURITY:
        code = Status.PERMISSION_DENIED;
        details = 'Protocol not secure enough';
        break;
        
      case http2.constants.NGHTTP2_INTERNAL_ERROR:
        code = Status.INTERNAL;
        
        if (this.internalError === null) {
          details = `Received RST_STREAM with code ${this.stream.rstCode} (Internal server error)`;
        } else if (this.internalError.code === 'ECONNRESET' || this.internalError.code === 'ETIMEDOUT') {
          code = Status.UNAVAILABLE;
          details = this.internalError.message;
        } else {
          details = `Received RST_STREAM with code ${this.stream.rstCode} triggered by internal client error: ${this.internalError.message}`;
        }
        break;
        
      default:
        code = Status.INTERNAL;
        details = `Received RST_STREAM with code ${this.stream.rstCode}`;
    }
    
    this.endCall({
      code,
      details,
      metadata: new Metadata(),
      rstCode: this.stream.rstCode
    });
  }

  handleTrailers(headers) {
    this.serverEndedCall = true;
    this.callEventTracker.onStreamEnd(true);
    
    let headersString = '';
    for (const [key, value] of Object.entries(headers)) {
      headersString += `\\t\\t${key}: ${value}\\n`;
    }
    
    this.trace(`Received server trailers:\\n${headersString}`);
    
    let metadata;
    try {
      metadata = Metadata.fromHttp2Headers(headers);
    } catch (error) {
      metadata = new Metadata();
    }
    
    const metadataMap = metadata.getMap();
    let status;
    
    if (typeof metadataMap['grpc-status'] === 'string') {
      const code = Number(metadataMap['grpc-status']);
      this.trace(`received status code ${code} from server`);
      metadata.remove('grpc-status');
      
      let details = '';
      if (typeof metadataMap['grpc-message'] === 'string') {
        try {
          details = decodeURI(metadataMap['grpc-message']);
        } catch (e) {
          details = metadataMap['grpc-message'];
        }
        metadata.remove('grpc-message');
        this.trace(`received status details string "${details}" from server`);
      }
      
      status = { code, details, metadata };
    } else if (this.httpStatusCode) {
      status = mapHttpStatusToGrpc(this.httpStatusCode);
      status.metadata = metadata;
    } else {
      status = {
        code: Status.UNKNOWN,
        details: 'No status information received',
        metadata
      };
    }
    
    this.endCall(status);
  }

  // Other methods...
  trace(message) {
    trace(LogVerbosity.DEBUG, TRACER_NAME, `[${this.callId}] ${message}`);
  }

  getDeadlineInfo() {
    return [`remote_addr=${this.getPeer()}`];
  }

  onDisconnect() {
    this.connectionDropped = true;
    setImmediate(() => {
      this.endCall({
        code: Status.UNAVAILABLE,
        details: 'Connection dropped',
        metadata: new Metadata()
      });
    });
  }

  outputStatus() {
    if (!this.statusOutput) {
      this.statusOutput = true;
      this.trace(`ended with status: code=${this.finalStatus.code} details="${this.finalStatus.details}"`);
      this.callEventTracker.onCallEnd(this.finalStatus);
      
      process.nextTick(() => {
        this.listener.onReceiveStatus(this.finalStatus);
      });
      
      this.stream.resume();
    }
  }

  endCall(status) {
    if (this.finalStatus === null || this.finalStatus.code === Status.OK) {
      this.finalStatus = status;
      this.maybeOutputStatus();
    }
    this.destroyHttp2Stream();
  }

  maybeOutputStatus() {
    if (this.finalStatus !== null) {
      const shouldOutput = this.finalStatus.code !== Status.OK ||
        (this.readsClosed && this.unpushedReadMessages.length === 0 && !this.isReadFilterPending && !this.isPushPending);
      
      if (shouldOutput) {
        this.outputStatus();
      }
    }
  }

  push(message) {
    this.trace(`pushing to reader message of length ${message instanceof Buffer ? message.length : null}`);
    this.canPush = false;
    this.isPushPending = true;
    
    process.nextTick(() => {
      this.isPushPending = false;
      if (this.statusOutput) return;
      
      this.listener.onReceiveMessage(message);
      this.maybeOutputStatus();
    });
  }

  tryPush(message) {
    if (this.canPush) {
      this.stream.pause();
      this.push(message);
    } else {
      this.trace(`unpushedReadMessages.push message of length ${message.length}`);
      this.unpushedReadMessages.push(message);
    }
  }

  destroyHttp2Stream() {
    if (this.stream.destroyed) return;
    
    if (this.serverEndedCall) {
      this.stream.end();
    } else {
      let code;
      if (this.finalStatus?.code === Status.OK) {
        code = http2.constants.NGHTTP2_NO_ERROR;
      } else {
        code = http2.constants.NGHTTP2_CANCEL;
      }
      
      this.trace(`close http2 stream with code ${code}`);
      this.stream.close(code);
    }
  }

  cancelWithStatus(code, details) {
    this.trace(`cancelWithStatus code: ${code} details: "${details}"`);
    this.endCall({
      code,
      details,
      metadata: new Metadata()
    });
  }

  getStatus() {
    return this.finalStatus;
  }

  getPeer() {
    return this.transport.getPeerName();
  }

  getCallNumber() {
    return this.callId;
  }

  startRead() {
    if (this.finalStatus !== null && this.finalStatus.code !== Status.OK) {
      this.readsClosed = true;
      this.maybeOutputStatus();
      return;
    }
    
    this.canPush = true;
    
    if (this.unpushedReadMessages.length > 0) {
      const message = this.unpushedReadMessages.shift();
      this.push(message);
      return;
    }
    
    this.stream.resume();
  }

  sendMessageWithContext(context, message) {
    this.trace(`write() called with message of length ${message.length}`);
    
    const callback = (error) => {
      process.nextTick(() => {
        let code = Status.UNAVAILABLE;
        
        if (error?.code === 'ERR_STREAM_WRITE_AFTER_END') {
          code = Status.INTERNAL;
        }
        
        if (error) {
          this.cancelWithStatus(code, `Write error: ${error.message}`);
        }
        
        context.callback?.();
      });
    };
    
    this.trace(`sending data chunk of length ${message.length}`);
    this.callEventTracker.addMessageSent();
    
    try {
      this.stream.write(message, callback);
    } catch (error) {
      this.endCall({
        code: Status.UNAVAILABLE,
        details: `Write failed with error ${error.message}`,
        metadata: new Metadata()
      });
    }
  }

  halfClose() {
    this.trace('end() called');
    this.trace('calling end() on HTTP/2 stream');
    this.stream.end();
  }
}

module.exports = {
  Http2SubchannelCall
};