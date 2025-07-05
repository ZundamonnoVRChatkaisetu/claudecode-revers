/**
 * Date Time Utilities System
 * Handles UTC string generation, RFC-3339/RFC-7231 parsing, and epoch timestamp processing
 */

class DateTimeUtils {
    constructor() {
        // Day names array
        this.dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        
        // Month names array
        this.monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        
        // Days in each month (non-leap year)
        this.daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
        
        // RFC-3339 regex pattern
        this.rfc3339Regex = /^(\d{4})-(\d{2})-(\d{2})[tT](\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?[zZ]$/;
        
        // RFC-3339 with offset regex pattern
        this.rfc3339OffsetRegex = /^(\d{4})-(\d{2})-(\d{2})[tT](\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(([-+]\d{2}\:\d{2})|[zZ])$/;
        
        // RFC-7231 regex patterns
        this.rfc7231Regex1 = /^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun), (\d{2}) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{4}) (\d{1,2}):(\d{2}):(\d{2})(?:\.(\d+))? GMT$/;
        this.rfc7231Regex2 = /^(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday), (\d{2})-(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-(\d{2}) (\d{1,2}):(\d{2}):(\d{2})(?:\.(\d+))? GMT$/;
        this.rfc7231Regex3 = /^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) ( [1-9]|\d{2}) (\d{1,2}):(\d{2}):(\d{2})(?:\.(\d+))? (\d{4})$/;
    }

    /**
     * Convert Date to UTC string in GMT format
     * @param {Date} date - Date object to convert
     * @returns {string} UTC string in GMT format
     */
    dateToUtcString(date) {
        const year = date.getUTCFullYear();
        const month = date.getUTCMonth();
        const dayOfWeek = date.getUTCDay();
        const dayOfMonth = date.getUTCDate();
        const hours = date.getUTCHours();
        const minutes = date.getUTCMinutes();
        const seconds = date.getUTCSeconds();

        const dayStr = dayOfMonth < 10 ? `0${dayOfMonth}` : `${dayOfMonth}`;
        const hoursStr = hours < 10 ? `0${hours}` : `${hours}`;
        const minutesStr = minutes < 10 ? `0${minutes}` : `${minutes}`;
        const secondsStr = seconds < 10 ? `0${seconds}` : `${seconds}`;

        return `${this.dayNames[dayOfWeek]}, ${dayStr} ${this.monthNames[month]} ${year} ${hoursStr}:${minutesStr}:${secondsStr} GMT`;
    }

    /**
     * Parse RFC-3339 date-time string
     * @param {string} dateTimeString - RFC-3339 formatted string
     * @returns {Date|null} Parsed Date object or null
     */
    parseRfc3339DateTime(dateTimeString) {
        if (dateTimeString === null || dateTimeString === undefined) {
            return null;
        }

        if (typeof dateTimeString !== "string") {
            throw new TypeError("RFC-3339 date-times must be expressed as strings");
        }

        const match = this.rfc3339Regex.exec(dateTimeString);
        if (!match) {
            throw new TypeError("Invalid RFC-3339 date-time value");
        }

        const [, year, month, day, hours, minutes, seconds, fractionalSeconds] = match;
        
        const yearInt = this.parseYear(year);
        const monthInt = this.validateRange(month, "month", 1, 12);
        const dayInt = this.validateRange(day, "day", 1, 31);

        return this.buildDate(yearInt, monthInt, dayInt, {
            hours,
            minutes,
            seconds,
            fractionalMilliseconds: fractionalSeconds
        });
    }

    /**
     * Parse RFC-3339 date-time string with timezone offset
     * @param {string} dateTimeString - RFC-3339 formatted string with offset
     * @returns {Date|null} Parsed Date object or null
     */
    parseRfc3339DateTimeWithOffset(dateTimeString) {
        if (dateTimeString === null || dateTimeString === undefined) {
            return null;
        }

        if (typeof dateTimeString !== "string") {
            throw new TypeError("RFC-3339 date-times must be expressed as strings");
        }

        const match = this.rfc3339OffsetRegex.exec(dateTimeString);
        if (!match) {
            throw new TypeError("Invalid RFC-3339 date-time value");
        }

        const [, year, month, day, hours, minutes, seconds, fractionalSeconds, , offset] = match;
        
        const yearInt = this.parseYear(year);
        const monthInt = this.validateRange(month, "month", 1, 12);
        const dayInt = this.validateRange(day, "day", 1, 31);

        const date = this.buildDate(yearInt, monthInt, dayInt, {
            hours,
            minutes,
            seconds,
            fractionalMilliseconds: fractionalSeconds
        });

        // Apply timezone offset
        if (offset.toUpperCase() !== "Z") {
            date.setTime(date.getTime() - this.parseOffsetToMilliseconds(offset));
        }

        return date;
    }

    /**
     * Parse RFC-7231 date-time string
     * @param {string} dateTimeString - RFC-7231 formatted string
     * @returns {Date|null} Parsed Date object or null
     */
    parseRfc7231DateTime(dateTimeString) {
        if (dateTimeString === null || dateTimeString === undefined) {
            return null;
        }

        if (typeof dateTimeString !== "string") {
            throw new TypeError("RFC-7231 date-times must be expressed as strings");
        }

        // Try first format
        let match = this.rfc7231Regex1.exec(dateTimeString);
        if (match) {
            const [, day, month, year, hours, minutes, seconds, fractionalSeconds] = match;
            return this.buildDate(
                this.parseYear(year),
                this.parseMonthByShortName(month),
                this.validateRange(day, "day", 1, 31),
                { hours, minutes, seconds, fractionalMilliseconds: fractionalSeconds }
            );
        }

        // Try second format
        match = this.rfc7231Regex2.exec(dateTimeString);
        if (match) {
            const [, day, month, year, hours, minutes, seconds, fractionalSeconds] = match;
            return this.adjustRfc850Year(this.buildDate(
                this.parseTwoDigitYear(year),
                this.parseMonthByShortName(month),
                this.validateRange(day, "day", 1, 31),
                { hours, minutes, seconds, fractionalMilliseconds: fractionalSeconds }
            ));
        }

        // Try third format
        match = this.rfc7231Regex3.exec(dateTimeString);
        if (match) {
            const [, month, day, hours, minutes, seconds, fractionalSeconds, year] = match;
            return this.buildDate(
                this.parseYear(year),
                this.parseMonthByShortName(month),
                this.validateRange(day.trimLeft(), "day", 1, 31),
                { hours, minutes, seconds, fractionalMilliseconds: fractionalSeconds }
            );
        }

        throw new TypeError("Invalid RFC-7231 date-time value");
    }

    /**
     * Parse epoch timestamp
     * @param {number|string|object} timestamp - Epoch timestamp
     * @returns {Date} Parsed Date object
     */
    parseEpochTimestamp(timestamp) {
        if (timestamp === null || timestamp === undefined) {
            return null;
        }

        let numericValue;
        if (typeof timestamp === "number") {
            numericValue = timestamp;
        } else if (typeof timestamp === "string") {
            numericValue = parseFloat(timestamp);
        } else if (typeof timestamp === "object" && timestamp.tag === 1) {
            numericValue = timestamp.value;
        } else {
            throw new TypeError("Epoch timestamps must be expressed as floating point numbers or their string representation");
        }

        if (Number.isNaN(numericValue) || numericValue === Infinity || numericValue === -Infinity) {
            throw new TypeError("Epoch timestamps must be valid, non-Infinite, non-NaN numerics");
        }

        return new Date(Math.round(numericValue * 1000));
    }

    /**
     * Build Date object from components
     * @param {number} year - Year
     * @param {number} month - Month (1-12)
     * @param {number} day - Day
     * @param {Object} time - Time components
     * @returns {Date} Built Date object
     */
    buildDate(year, month, day, time) {
        const monthIndex = month - 1; // Convert to 0-based index
        this.validateDayOfMonth(year, monthIndex, day);

        return new Date(Date.UTC(
            year,
            monthIndex,
            day,
            this.validateRange(time.hours, "hour", 0, 23),
            this.validateRange(time.minutes, "minute", 0, 59),
            this.validateRange(time.seconds, "seconds", 0, 60),
            this.parseMilliseconds(time.fractionalMilliseconds)
        ));
    }

    /**
     * Parse year string and remove leading zeros
     * @param {string} yearString - Year string
     * @returns {number} Parsed year
     */
    parseYear(yearString) {
        return this.parseInteger(this.stripLeadingZeroes(yearString));
    }

    /**
     * Parse two-digit year
     * @param {string} yearString - Two-digit year string
     * @returns {number} Full year
     */
    parseTwoDigitYear(yearString) {
        const currentYear = new Date().getUTCFullYear();
        const century = Math.floor(currentYear / 100) * 100;
        const parsedYear = century + this.parseInteger(this.stripLeadingZeroes(yearString));

        if (parsedYear < currentYear) {
            return parsedYear + 100;
        }
        return parsedYear;
    }

    /**
     * Adjust RFC-850 year (handle Y2K issues)
     * @param {Date} date - Date to adjust
     * @returns {Date} Adjusted date
     */
    adjustRfc850Year(date) {
        const y2kThreshold = 1576800000000; // Around year 2020
        if (date.getTime() - new Date().getTime() > y2kThreshold) {
            return new Date(Date.UTC(
                date.getUTCFullYear() - 100,
                date.getUTCMonth(),
                date.getUTCDate(),
                date.getUTCHours(),
                date.getUTCMinutes(),
                date.getUTCSeconds(),
                date.getUTCMilliseconds()
            ));
        }
        return date;
    }

    /**
     * Parse month by short name
     * @param {string} monthName - Month short name
     * @returns {number} Month number (1-12)
     */
    parseMonthByShortName(monthName) {
        const index = this.monthNames.indexOf(monthName);
        if (index < 0) {
            throw new TypeError(`Invalid month: ${monthName}`);
        }
        return index + 1;
    }

    /**
     * Validate day of month
     * @param {number} year - Year
     * @param {number} month - Month (0-11)
     * @param {number} day - Day
     */
    validateDayOfMonth(year, month, day) {
        let maxDay = this.daysInMonth[month];
        if (month === 1 && this.isLeapYear(year)) {
            maxDay = 29;
        }

        if (day > maxDay) {
            throw new TypeError(`Invalid day for ${this.monthNames[month]} in ${year}: ${day}`);
        }
    }

    /**
     * Check if year is leap year
     * @param {number} year - Year to check
     * @returns {boolean} True if leap year
     */
    isLeapYear(year) {
        return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    }

    /**
     * Validate range of value
     * @param {string} value - Value to validate
     * @param {string} name - Name for error messages
     * @param {number} min - Minimum value
     * @param {number} max - Maximum value
     * @returns {number} Validated integer
     */
    validateRange(value, name, min, max) {
        const intValue = this.parseInteger(this.stripLeadingZeroes(value));
        if (intValue < min || intValue > max) {
            throw new TypeError(`${name} must be between ${min} and ${max}, inclusive`);
        }
        return intValue;
    }

    /**
     * Parse milliseconds from fractional seconds
     * @param {string} fractionalSeconds - Fractional seconds string
     * @returns {number} Milliseconds
     */
    parseMilliseconds(fractionalSeconds) {
        if (fractionalSeconds === null || fractionalSeconds === undefined) {
            return 0;
        }
        return parseFloat("0." + fractionalSeconds) * 1000;
    }

    /**
     * Parse offset to milliseconds
     * @param {string} offset - Timezone offset string
     * @returns {number} Offset in milliseconds
     */
    parseOffsetToMilliseconds(offset) {
        const direction = offset[0];
        let multiplier = 1;

        if (direction === "+") {
            multiplier = 1;
        } else if (direction === "-") {
            multiplier = -1;
        } else {
            throw new TypeError(`Offset direction, ${direction}, must be "+" or "-"`);
        }

        const hours = Number(offset.substring(1, 3));
        const minutes = Number(offset.substring(4, 6));

        return multiplier * (hours * 60 + minutes) * 60 * 1000;
    }

    /**
     * Strip leading zeroes from string
     * @param {string} str - String to process
     * @returns {string} String without leading zeroes
     */
    stripLeadingZeroes(str) {
        let index = 0;
        while (index < str.length - 1 && str.charAt(index) === "0") {
            index++;
        }

        if (index === 0) {
            return str;
        }
        return str.slice(index);
    }

    /**
     * Parse integer from string
     * @param {string} str - String to parse
     * @returns {number} Parsed integer
     */
    parseInteger(str) {
        const result = parseInt(str, 10);
        if (isNaN(result)) {
            throw new TypeError(`Invalid integer: ${str}`);
        }
        return result;
    }

    /**
     * Stack trace warning utility
     * @param {Function} fn - Function to wrap
     * @param {string} name - Function name
     * @returns {Function} Wrapped function
     */
    stackTraceWarning(fn, name) {
        return fn;
    }
}

// Static instance for global use
const dateTimeUtils = new DateTimeUtils();

module.exports = {
    DateTimeUtils,
    dateToUtcString: (date) => dateTimeUtils.dateToUtcString(date),
    parseRfc3339DateTime: (str) => dateTimeUtils.parseRfc3339DateTime(str),
    parseRfc3339DateTimeWithOffset: (str) => dateTimeUtils.parseRfc3339DateTimeWithOffset(str),
    parseRfc7231DateTime: (str) => dateTimeUtils.parseRfc7231DateTime(str),
    parseEpochTimestamp: (ts) => dateTimeUtils.parseEpochTimestamp(ts)
};