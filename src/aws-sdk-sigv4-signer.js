/**
 * AWS SDK SigV4 Signer Implementation
 * Provides AWS SDK signing capabilities with enhanced error handling and time synchronization
 */

const { HttpRequest, HttpResponse } = require('./http-request');
const { SignatureV4 } = require('./aws-signature-v4');

/**
 * Get date header from HTTP response
 */
function getDateHeader(response) {
    if (HttpResponse.isInstance(response)) {
        return response.headers?.date ?? response.headers?.Date;
    }
    return undefined;
}

/**
 * Get skew-corrected date with clock offset
 */
function getSkewCorrectedDate(systemClockOffset) {
    return new Date(Date.now() + systemClockOffset);
}

/**
 * Check if clock is skewed by more than 5 minutes
 */
function isClockSkewed(clockTime, systemClockOffset) {
    return Math.abs(getSkewCorrectedDate(systemClockOffset).getTime() - clockTime) >= 300000;
}

/**
 * Get updated system clock offset based on server time
 */
function getUpdatedSystemClockOffset(serverTime, systemClockOffset) {
    const clockTime = Date.parse(serverTime);
    if (isClockSkewed(clockTime, systemClockOffset)) {
        return clockTime - Date.now();
    }
    return systemClockOffset;
}

/**
 * Throw error for missing signing property
 */
function throwSigningPropertyError(property, value) {
    if (!value) {
        throw new Error(`Property \`${property}\` is not resolved for AWS SDK SigV4Auth`);
    }
    return value;
}

/**
 * Validate signing properties
 */
async function validateSigningProperties(signingProperties) {
    const context = throwSigningPropertyError("context", signingProperties.context);
    const config = throwSigningPropertyError("config", signingProperties.config);
    
    const authScheme = context.endpointV2?.properties?.authSchemes?.[0];
    const signer = await throwSigningPropertyError("signer", config.signer)(authScheme);
    
    const signingRegion = signingProperties?.signingRegion;
    const signingRegionSet = signingProperties?.signingRegionSet;
    const signingName = signingProperties?.signingName;
    
    return {
        config,
        signer,
        signingRegion,
        signingRegionSet,
        signingName
    };
}

/**
 * AWS SDK SigV4 Signer Class
 */
class AwsSdkSigV4Signer {
    /**
     * Sign HTTP request using AWS SigV4
     */
    async sign(request, httpHandlerOptions, signingProperties) {
        if (!HttpRequest.isInstance(request)) {
            throw new Error("The request is not an instance of `HttpRequest` and cannot be signed");
        }
        
        const validatedProperties = await validateSigningProperties(signingProperties);
        const { config, signer } = validatedProperties;
        let { signingRegion, signingName } = validatedProperties;
        
        const context = signingProperties.context;
        
        // Handle multiple auth schemes (sigv4a and sigv4)
        if (context?.authSchemes?.length ?? 0 > 1) {
            const [primaryScheme, fallbackScheme] = context.authSchemes;
            if (primaryScheme?.name === "sigv4a" && fallbackScheme?.name === "sigv4") {
                signingRegion = fallbackScheme?.signingRegion ?? signingRegion;
                signingName = fallbackScheme?.signingName ?? signingName;
            }
        }
        
        return await signer.sign(request, {
            signingDate: getSkewCorrectedDate(config.systemClockOffset),
            signingRegion,
            signingService: signingName
        });
    }

    /**
     * Error handler with clock skew correction
     */
    errorHandler(signingProperties) {
        return (error) => {
            const serverTime = error.ServerTime ?? getDateHeader(error.$response);
            if (serverTime) {
                const config = throwSigningPropertyError("config", signingProperties.config);
                const previousOffset = config.systemClockOffset;
                
                config.systemClockOffset = getUpdatedSystemClockOffset(serverTime, config.systemClockOffset);
                
                if (config.systemClockOffset !== previousOffset && error.$metadata) {
                    error.$metadata.clockSkewCorrected = true;
                }
            }
            throw error;
        };
    }

    /**
     * Success handler for clock correction
     */
    successHandler(response, signingProperties) {
        const serverTime = getDateHeader(response);
        if (serverTime) {
            const config = throwSigningPropertyError("config", signingProperties.config);
            config.systemClockOffset = getUpdatedSystemClockOffset(serverTime, config.systemClockOffset);
        }
    }
}

/**
 * AWS SDK SigV4A Signer (Advanced Signature Version 4)
 */
class AwsSdkSigV4ASigner extends AwsSdkSigV4Signer {
    /**
     * Sign HTTP request using AWS SigV4A (supports multiple regions)
     */
    async sign(request, httpHandlerOptions, signingProperties) {
        if (!HttpRequest.isInstance(request)) {
            throw new Error("The request is not an instance of `HttpRequest` and cannot be signed");
        }
        
        const {
            config,
            signer,
            signingRegion,
            signingRegionSet,
            signingName
        } = await validateSigningProperties(signingProperties);
        
        // Join multiple regions for SigV4A
        const signingRegions = (
            await config.sigv4aSigningRegionSet?.() ?? 
            signingRegionSet ?? 
            [signingRegion]
        ).join(",");
        
        return await signer.sign(request, {
            signingDate: getSkewCorrectedDate(config.systemClockOffset),
            signingRegion: signingRegions,
            signingService: signingName
        });
    }
}

/**
 * Resolve AWS SDK SigV4 configuration
 */
function resolveAwsSdkSigV4Config(config) {
    // Credential resolution with memoization
    const credentials = config.credentials;
    let hasCredentialsChanged = !!config.credentials;
    let memoizedCredentials = undefined;
    
    Object.defineProperty(config, "credentials", {
        set(newCredentials) {
            if (newCredentials && newCredentials !== credentials && newCredentials !== memoizedCredentials) {
                hasCredentialsChanged = true;
            }
            const normalizedCredentials = normalizeCredentialProvider(config, { 
                credentials: newCredentials, 
                credentialDefaultProvider: config.credentialDefaultProvider 
            });
            const boundCredentials = bindCallerConfig(config, normalizedCredentials);
            
            if (hasCredentialsChanged && !boundCredentials.attributed) {
                memoizedCredentials = async (authScheme) => 
                    boundCredentials(authScheme).then(creds => setCredentialFeature(creds, "CREDENTIALS_CODE", "e"));
                memoizedCredentials.memoized = boundCredentials.memoized;
                memoizedCredentials.configBound = boundCredentials.configBound;
                memoizedCredentials.attributed = true;
            } else {
                memoizedCredentials = boundCredentials;
            }
        },
        get() {
            return memoizedCredentials;
        },
        enumerable: true,
        configurable: true
    });
    
    config.credentials = credentials;
    
    const {
        signingEscapePath = true,
        systemClockOffset = config.systemClockOffset || 0,
        sha256
    } = config;
    
    let signer;
    if (config.signer) {
        signer = normalizeProvider(config.signer);
    } else if (config.regionInfoProvider) {
        signer = () => normalizeProvider(config.region)()
            .then(async region => [
                await config.regionInfoProvider(region, {
                    useFipsEndpoint: await config.useFipsEndpoint(),
                    useDualstackEndpoint: await config.useDualstackEndpoint()
                }) || {},
                region
            ])
            .then(([regionInfo, region]) => {
                const { signingRegion, signingService } = regionInfo;
                config.signingRegion = config.signingRegion || signingRegion || region;
                config.signingName = config.signingName || signingService || config.serviceId;
                
                const signerConfig = {
                    ...config,
                    credentials: config.credentials,
                    region: config.signingRegion,
                    service: config.signingName,
                    sha256,
                    uriEscapePath: signingEscapePath
                };
                
                return new (config.signerConstructor || SignatureV4)(signerConfig);
            });
    } else {
        signer = async (authScheme) => {
            authScheme = Object.assign({}, {
                name: "sigv4",
                signingName: config.signingName || config.defaultSigningName,
                signingRegion: await normalizeProvider(config.region)(),
                properties: {}
            }, authScheme);
            
            const { signingRegion, signingName } = authScheme;
            config.signingRegion = config.signingRegion || signingRegion;
            config.signingName = config.signingName || signingName || config.serviceId;
            
            const signerConfig = {
                ...config,
                credentials: config.credentials,
                region: config.signingRegion,
                service: config.signingName,
                sha256,
                uriEscapePath: signingEscapePath
            };
            
            return new (config.signerConstructor || SignatureV4)(signerConfig);
        };
    }
    
    return Object.assign(config, {
        systemClockOffset,
        signingEscapePath,
        signer
    });
}

/**
 * Normalize credential provider
 */
function normalizeCredentialProvider(config, { credentials, credentialDefaultProvider }) {
    let provider;
    
    if (credentials) {
        if (!credentials?.memoized) {
            provider = memoizeIdentityProvider(credentials, isIdentityExpired, doesIdentityRequireRefresh);
        } else {
            provider = credentials;
        }
    } else if (credentialDefaultProvider) {
        provider = normalizeProvider(credentialDefaultProvider(Object.assign({}, config, { parentClientConfig: config })));
    } else {
        provider = async () => {
            throw new Error("@aws-sdk/core::resolveAwsSdkSigV4Config - `credentials` not provided and no credentialDefaultProvider was configured.");
        };
    }
    
    provider.memoized = true;
    return provider;
}

/**
 * Bind caller configuration to provider
 */
function bindCallerConfig(config, provider) {
    if (provider.configBound) {
        return provider;
    }
    
    const boundProvider = async (authScheme) => provider({ ...authScheme, callerClientConfig: config });
    boundProvider.memoized = provider.memoized;
    boundProvider.configBound = true;
    
    return boundProvider;
}

// Placeholder functions for dependencies
function normalizeProvider(provider) { return provider; }
function memoizeIdentityProvider(provider, isExpired, doesRequireRefresh) { return provider; }
function isIdentityExpired(identity) { return false; }
function doesIdentityRequireRefresh(identity) { return false; }
function setCredentialFeature(credentials, feature, value) { return credentials; }

module.exports = {
    AwsSdkSigV4Signer,
    AwsSdkSigV4ASigner,
    resolveAwsSdkSigV4Config,
    validateSigningProperties,
    getDateHeader,
    getSkewCorrectedDate,
    isClockSkewed,
    getUpdatedSystemClockOffset
};