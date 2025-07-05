// Time utility functions

// Convert HrTime to milliseconds
function hrTimeToMilliseconds(hrTime) {
  const [seconds, nanoseconds] = hrTime;
  return seconds * 1000 + nanoseconds / 1000000;
}

// Convert HrTime to microseconds
function hrTimeToMicroseconds(hrTime) {
  const [seconds, nanoseconds] = hrTime;
  return seconds * 1000000 + nanoseconds / 1000;
}

// Convert timestamp to HrTime
function timeInputToHrTime(input) {
  if (typeof input === 'number') {
    // Milliseconds timestamp
    const seconds = Math.floor(input / 1000);
    const nanoseconds = (input % 1000) * 1000000;
    return [seconds, nanoseconds];
  }
  
  if (Array.isArray(input) && input.length === 2) {
    // Already HrTime
    return input;
  }
  
  if (input instanceof Date) {
    const timestamp = input.getTime();
    const seconds = Math.floor(timestamp / 1000);
    const nanoseconds = (timestamp % 1000) * 1000000;
    return [seconds, nanoseconds];
  }
  
  // Default to current time
  const now = Date.now();
  const seconds = Math.floor(now / 1000);
  const nanoseconds = (now % 1000) * 1000000;
  return [seconds, nanoseconds];
}

// Get current HrTime
function hrTime() {
  if (typeof process !== 'undefined' && process.hrtime) {
    return process.hrtime();
  }
  
  // Fallback for non-Node environments
  const now = Date.now();
  const seconds = Math.floor(now / 1000);
  const nanoseconds = (now % 1000) * 1000000;
  return [seconds, nanoseconds];
}

// Calculate duration between two HrTimes
function hrTimeDuration(startTime, endTime) {
  let seconds = endTime[0] - startTime[0];
  let nanoseconds = endTime[1] - startTime[1];
  
  if (nanoseconds < 0) {
    seconds -= 1;
    nanoseconds += 1000000000;
  }
  
  return [seconds, nanoseconds];
}

module.exports = {
  hrTimeToMilliseconds,
  hrTimeToMicroseconds,
  timeInputToHrTime,
  hrTime,
  hrTimeDuration
};