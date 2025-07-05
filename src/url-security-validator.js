/**
 * URL Security Validator System
 * Validates URLs for security compliance in AWS SDK contexts
 */

class UrlSecurityValidator {
    constructor() {
        // AWS container metadata endpoints
        this.ecsContainerHost = "169.254.170.2";
        this.ecsContainerEndpoint = "169.254.170.23";
        this.ec2MetadataIPv6 = "[fd00:ec2::23]";
        
        // Allowed protocols
        this.allowedProtocols = ["https:"];
        
        // Error messages
        this.errorMessages = {
            base: "URL not accepted. It must either be HTTPS or match one of the following:",
            loopback: "- loopback CIDR 127.0.0.0/8 or [::1/128]",
            ecsContainer: "- ECS container host 169.254.170.2",
            localhost: "- localhost",
            httpsRequired: "- HTTPS protocol required for external hosts"
        };
    }

    /**
     * Check URL for security compliance
     * @param {URL|Object} url - URL object to validate
     * @param {Object} logger - Logger instance for warnings
     * @throws {Error} If URL doesn't meet security requirements
     */
    checkUrl(url, logger) {
        // Allow HTTPS protocol
        if (url.protocol === "https:") {
            return;
        }

        // Check for specific allowed hosts for HTTP
        if (this.isAllowedHost(url.hostname)) {
            return;
        }

        // If we get here, the URL is not allowed
        const errorMessage = this.buildErrorMessage();
        logger?.warn?.("URL security validation failed:", errorMessage);
        
        throw new Error(errorMessage);
    }

    /**
     * Check if hostname is in allowed list for HTTP
     * @param {string} hostname - Hostname to check
     * @returns {boolean} True if allowed
     */
    isAllowedHost(hostname) {
        // AWS container metadata hosts
        if (hostname === this.ecsContainerHost || 
            hostname === this.ecsContainerEndpoint || 
            hostname === this.ec2MetadataIPv6) {
            return true;
        }

        // IPv6 localhost variations
        if (hostname.includes("[")) {
            if (hostname === "[::1]" || 
                hostname === "[0000:0000:0000:0000:0000:0000:0000:0001]") {
                return true;
            }
        } else {
            // Localhost
            if (hostname === "localhost") {
                return true;
            }

            // Check for 127.x.x.x (loopback CIDR)
            if (this.isLoopbackIPv4(hostname)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Check if IP is in IPv4 loopback range (127.0.0.0/8)
     * @param {string} hostname - Hostname to check
     * @returns {boolean} True if IPv4 loopback
     */
    isLoopbackIPv4(hostname) {
        const parts = hostname.split(".");
        
        if (parts.length !== 4) {
            return false;
        }

        // Check if first octet is 127
        if (parts[0] !== "127") {
            return false;
        }

        // Validate each octet is a valid number 0-255
        const isValidOctet = (octet) => {
            const num = parseInt(octet, 10);
            return num >= 0 && num <= 255 && octet === num.toString();
        };

        return parts.every(isValidOctet);
    }

    /**
     * Build comprehensive error message
     * @returns {string} Error message
     */
    buildErrorMessage() {
        return [
            this.errorMessages.base,
            "",
            this.errorMessages.loopback,
            this.errorMessages.ecsContainer,
            this.errorMessages.localhost,
            "",
            "For security reasons, only HTTPS URLs or specific localhost/container metadata endpoints are allowed."
        ].join("\n");
    }

    /**
     * Validate URL string and return parsed URL
     * @param {string} urlString - URL string to validate
     * @param {Object} logger - Logger instance
     * @returns {URL} Validated URL object
     * @throws {Error} If URL is invalid or insecure
     */
    validateUrlString(urlString, logger) {
        let url;
        
        try {
            url = new URL(urlString);
        } catch (error) {
            throw new Error(`Invalid URL: ${urlString}. ${error.message}`);
        }

        this.checkUrl(url, logger);
        return url;
    }

    /**
     * Check if URL is AWS metadata service endpoint
     * @param {URL|string} url - URL to check
     * @returns {boolean} True if AWS metadata endpoint
     */
    isAwsMetadataEndpoint(url) {
        if (typeof url === "string") {
            try {
                url = new URL(url);
            } catch {
                return false;
            }
        }

        const metadataHosts = [
            "169.254.169.254",    // EC2 metadata IPv4
            "[fd00:ec2::254]",    // EC2 metadata IPv6
            this.ecsContainerHost,
            this.ecsContainerEndpoint,
            this.ec2MetadataIPv6
        ];

        return metadataHosts.includes(url.hostname);
    }

    /**
     * Validate AWS service endpoint URL
     * @param {string} urlString - AWS service endpoint URL
     * @param {Object} options - Validation options
     * @returns {URL} Validated URL
     */
    validateAwsServiceEndpoint(urlString, options = {}) {
        const { 
            requireHttps = true, 
            allowLocalhost = false,
            logger = console 
        } = options;

        let url;
        try {
            url = new URL(urlString);
        } catch (error) {
            throw new Error(`Invalid AWS service endpoint URL: ${urlString}`);
        }

        // AWS service endpoints must be HTTPS unless explicitly allowed
        if (requireHttps && url.protocol !== "https:") {
            if (!allowLocalhost || !this.isAllowedHost(url.hostname)) {
                throw new Error(`AWS service endpoints must use HTTPS protocol. Got: ${url.protocol}`);
            }
        }

        // Check for suspicious domains
        if (this.isSuspiciousDomain(url.hostname)) {
            logger.warn(`Potentially suspicious domain detected: ${url.hostname}`);
        }

        return url;
    }

    /**
     * Check if domain appears suspicious
     * @param {string} hostname - Hostname to check
     * @returns {boolean} True if suspicious
     */
    isSuspiciousDomain(hostname) {
        const suspiciousPatterns = [
            /amazonaws\.com\./, // Homograph attack
            /aws-/, // Possible typosquatting
            /amazon-/, // Possible typosquatting
            /^([0-9]+\.){3}[0-9]+$/ // Raw IP addresses (except known good ones)
        ];

        // Skip check for known good AWS domains
        const knownGoodDomains = [
            /\.amazonaws\.com$/,
            /^amazonaws\.com$/,
            /^127\./,
            /^169\.254\./
        ];

        if (knownGoodDomains.some(pattern => pattern.test(hostname))) {
            return false;
        }

        return suspiciousPatterns.some(pattern => pattern.test(hostname));
    }

    /**
     * Sanitize URL for logging (remove credentials)
     * @param {URL|string} url - URL to sanitize
     * @returns {string} Sanitized URL string
     */
    sanitizeUrlForLogging(url) {
        if (typeof url === "string") {
            try {
                url = new URL(url);
            } catch {
                return "[Invalid URL]";
            }
        }

        const sanitized = new URL(url.toString());
        
        // Remove credentials
        sanitized.username = "";
        sanitized.password = "";
        
        return sanitized.toString();
    }
}

// Export singleton instance and class
const urlSecurityValidator = new UrlSecurityValidator();

module.exports = {
    UrlSecurityValidator,
    checkUrl: (url, logger) => urlSecurityValidator.checkUrl(url, logger),
    validateUrlString: (urlString, logger) => urlSecurityValidator.validateUrlString(urlString, logger),
    isAwsMetadataEndpoint: (url) => urlSecurityValidator.isAwsMetadataEndpoint(url),
    validateAwsServiceEndpoint: (url, options) => urlSecurityValidator.validateAwsServiceEndpoint(url, options),
    sanitizeUrlForLogging: (url) => urlSecurityValidator.sanitizeUrlForLogging(url)
};