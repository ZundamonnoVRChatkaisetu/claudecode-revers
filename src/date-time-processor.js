/**
 * 日時処理システム
 * RFC-3339、RFC-7231、エポックタイムスタンプ処理機能
 */

/**
 * スタックトレース警告システム
 */
class StackTraceWarningSystem {
    constructor() {
        this.warn = console.warn;
    }

    /**
     * フィルタリングされたスタックトレースを出力
     */
    logFilteredStackTrace(error) {
        if (error && error.stack) {
            const stackLines = error.stack
                .split('\n')
                .slice(0, 5)
                .filter(line => !line.includes('stackTraceWarning'))
                .join('\n');
            
            this.warn(stackLines);
        }
    }
}

/**
 * UTC日時処理システム
 */
class UtcDateTimeProcessor {
    constructor() {
        // 曜日名配列（英語短縮形）
        this.dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        
        // 月名配列（英語短縮形）
        this.monthNames = [
            'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
            'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
        ];
    }

    /**
     * DateオブジェクトをUTC文字列に変換
     */
    dateToUtcString(date) {
        const year = date.getUTCFullYear();
        const month = date.getUTCMonth();
        const dayOfWeek = date.getUTCDay();
        const day = date.getUTCDate();
        const hours = date.getUTCHours();
        const minutes = date.getUTCMinutes();
        const seconds = date.getUTCSeconds();

        // ゼロパディング処理
        const paddedDay = day < 10 ? `0${day}` : `${day}`;
        const paddedHours = hours < 10 ? `0${hours}` : `${hours}`;
        const paddedMinutes = minutes < 10 ? `0${minutes}` : `${minutes}`;
        const paddedSeconds = seconds < 10 ? `0${seconds}` : `${seconds}`;

        return `${this.dayNames[dayOfWeek]}, ${paddedDay} ${this.monthNames[month]} ${year} ${paddedHours}:${paddedMinutes}:${paddedSeconds} GMT`;
    }

    /**
     * 値を指定範囲内で検証
     */
    validateRange(value, fieldName, min, max) {
        const numValue = this.parseNumber(this.stripLeadingZeroes(value));
        if (numValue < min || numValue > max) {
            throw new TypeError(`${fieldName} must be between ${min} and ${max}, inclusive`);
        }
        return numValue;
    }

    /**
     * 先頭のゼロを除去
     */
    stripLeadingZeroes(str) {
        let index = 0;
        while (index < str.length - 1 && str.charAt(index) === '0') {
            index++;
        }
        return index === 0 ? str : str.slice(index);
    }

    /**
     * 文字列を数値に変換
     */
    parseNumber(str) {
        const result = parseInt(str, 10);
        if (isNaN(result)) {
            throw new TypeError(`Invalid number: ${str}`);
        }
        return result;
    }

    /**
     * 月名から月番号に変換
     */
    parseMonthByShortName(monthName) {
        const index = this.monthNames.indexOf(monthName);
        if (index < 0) {
            throw new TypeError(`Invalid month: ${monthName}`);
        }
        return index + 1;
    }

    /**
     * うるう年判定
     */
    isLeapYear(year) {
        return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    }

    /**
     * 月の日数配列
     */
    getMonthDays() {
        return [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    }

    /**
     * 日付妥当性検証
     */
    validateDayOfMonth(year, month, day) {
        const monthDays = this.getMonthDays();
        let maxDays = monthDays[month];
        
        if (month === 1 && this.isLeapYear(year)) {
            maxDays = 29;
        }
        
        if (day > maxDays) {
            throw new TypeError(`Invalid day for ${this.monthNames[month]} in ${year}: ${day}`);
        }
    }

    /**
     * 小数秒をミリ秒に変換
     */
    parseMilliseconds(fractionalSeconds) {
        if (fractionalSeconds === null || fractionalSeconds === undefined) {
            return 0;
        }
        return parseFloat('0.' + fractionalSeconds) * 1000;
    }

    /**
     * タイムゾーンオフセットをミリ秒に変換
     */
    parseOffsetToMilliseconds(offsetStr) {
        const direction = offsetStr[0];
        let multiplier = 1;

        if (direction === '+') {
            multiplier = 1;
        } else if (direction === '-') {
            multiplier = -1;
        } else {
            throw new TypeError(`Offset direction, ${direction}, must be "+" or "-"`);
        }

        const hours = Number(offsetStr.substring(1, 3));
        const minutes = Number(offsetStr.substring(4, 6));

        return multiplier * (hours * 60 + minutes) * 60 * 1000;
    }

    /**
     * Dateオブジェクト構築
     */
    buildDate(year, month, day, timeComponents) {
        const monthIndex = month - 1;
        this.validateDayOfMonth(year, monthIndex, day);

        return new Date(Date.UTC(
            year,
            monthIndex,
            day,
            this.validateRange(timeComponents.hours, 'hour', 0, 23),
            this.validateRange(timeComponents.minutes, 'minute', 0, 59),
            this.validateRange(timeComponents.seconds, 'seconds', 0, 60),
            this.parseMilliseconds(timeComponents.fractionalMilliseconds)
        ));
    }
}

/**
 * RFC-3339日時パーサー
 */
class Rfc3339DateTimeParser extends UtcDateTimeProcessor {
    constructor() {
        super();
        // RFC-3339 正規表現パターン
        this.rfc3339Pattern = /^(\d{4})-(\d{2})-(\d{2})[tT](\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?[zZ]$/;
        this.rfc3339WithOffsetPattern = /^(\d{4})-(\d{2})-(\d{2})[tT](\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?(([-+]\d{2}:\d{2})|[zZ])$/;
    }

    /**
     * RFC-3339日時文字列をパース
     */
    parseRfc3339DateTime(dateTimeStr) {
        if (dateTimeStr === null || dateTimeStr === undefined) {
            return;
        }

        if (typeof dateTimeStr !== 'string') {
            throw new TypeError('RFC-3339 date-times must be expressed as strings');
        }

        const match = this.rfc3339Pattern.exec(dateTimeStr);
        if (!match) {
            throw new TypeError('Invalid RFC-3339 date-time value');
        }

        const [, year, month, day, hours, minutes, seconds, fractionalSeconds] = match;

        const parsedYear = this.parseNumber(this.stripLeadingZeroes(year));
        const parsedMonth = this.validateRange(month, 'month', 1, 12);
        const parsedDay = this.validateRange(day, 'day', 1, 31);

        return this.buildDate(parsedYear, parsedMonth, parsedDay, {
            hours: hours,
            minutes: minutes,
            seconds: seconds,
            fractionalMilliseconds: fractionalSeconds
        });
    }

    /**
     * RFC-3339日時文字列（オフセット付き）をパース
     */
    parseRfc3339DateTimeWithOffset(dateTimeStr) {
        if (dateTimeStr === null || dateTimeStr === undefined) {
            return;
        }

        if (typeof dateTimeStr !== 'string') {
            throw new TypeError('RFC-3339 date-times must be expressed as strings');
        }

        const match = this.rfc3339WithOffsetPattern.exec(dateTimeStr);
        if (!match) {
            throw new TypeError('Invalid RFC-3339 date-time value');
        }

        const [, year, month, day, hours, minutes, seconds, fractionalSeconds, offsetStr] = match;

        const parsedYear = this.parseNumber(this.stripLeadingZeroes(year));
        const parsedMonth = this.validateRange(month, 'month', 1, 12);
        const parsedDay = this.validateRange(day, 'day', 1, 31);

        const date = this.buildDate(parsedYear, parsedMonth, parsedDay, {
            hours: hours,
            minutes: minutes,
            seconds: seconds,
            fractionalMilliseconds: fractionalSeconds
        });

        if (offsetStr.toUpperCase() !== 'Z') {
            date.setTime(date.getTime() - this.parseOffsetToMilliseconds(offsetStr));
        }

        return date;
    }
}

/**
 * RFC-7231日時パーサー（HTTP日時形式）
 */
class Rfc7231DateTimeParser extends UtcDateTimeProcessor {
    constructor() {
        super();
        
        // RFC-7231 正規表現パターン
        this.imfFixdatePattern = /^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun), (\d{2}) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{4}) (\d{1,2}):(\d{2}):(\d{2})(?:\.(\d+))? GMT$/;
        this.rfc850Pattern = /^(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday), (\d{2})-(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-(\d{2}) (\d{1,2}):(\d{2}):(\d{2})(?:\.(\d+))? GMT$/;
        this.asctimePattern = /^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) ( [1-9]|\d{2}) (\d{1,2}):(\d{2}):(\d{2})(?:\.(\d+))? (\d{4})$/;
    }

    /**
     * RFC-7231日時文字列をパース
     */
    parseRfc7231DateTime(dateTimeStr) {
        if (dateTimeStr === null || dateTimeStr === undefined) {
            return;
        }

        if (typeof dateTimeStr !== 'string') {
            throw new TypeError('RFC-7231 date-times must be expressed as strings');
        }

        // IMF-fixdate形式（推奨）
        let match = this.imfFixdatePattern.exec(dateTimeStr);
        if (match) {
            const [, day, month, year, hours, minutes, seconds, fractionalSeconds] = match;
            return this.buildDate(
                this.parseNumber(this.stripLeadingZeroes(year)),
                this.parseMonthByShortName(month),
                this.validateRange(day, 'day', 1, 31),
                { hours, minutes, seconds, fractionalMilliseconds: fractionalSeconds }
            );
        }

        // RFC-850形式
        match = this.rfc850Pattern.exec(dateTimeStr);
        if (match) {
            const [, day, month, year, hours, minutes, seconds, fractionalSeconds] = match;
            return this.adjustRfc850Year(this.buildDate(
                this.parseTwoDigitYear(year),
                this.parseMonthByShortName(month),
                this.validateRange(day, 'day', 1, 31),
                { hours, minutes, seconds, fractionalMilliseconds: fractionalSeconds }
            ));
        }

        // ASCTIME形式
        match = this.asctimePattern.exec(dateTimeStr);
        if (match) {
            const [, month, day, hours, minutes, seconds, fractionalSeconds, year] = match;
            return this.buildDate(
                this.parseNumber(this.stripLeadingZeroes(year)),
                this.parseMonthByShortName(month),
                this.validateRange(day.trimLeft(), 'day', 1, 31),
                { hours, minutes, seconds, fractionalMilliseconds: fractionalSeconds }
            );
        }

        throw new TypeError('Invalid RFC-7231 date-time value');
    }

    /**
     * 2桁年を4桁年に変換
     */
    parseTwoDigitYear(twoDigitYear) {
        const currentYear = new Date().getUTCFullYear();
        const century = Math.floor(currentYear / 100) * 100;
        const fullYear = century + this.parseNumber(this.stripLeadingZeroes(twoDigitYear));

        if (fullYear < currentYear) {
            return fullYear + 100;
        }
        return fullYear;
    }

    /**
     * RFC-850年調整（Y2K問題対応）
     */
    adjustRfc850Year(date) {
        const currentTime = new Date().getTime();
        const adjustmentThreshold = 1576800000000; // 約50年

        if (date.getTime() - currentTime > adjustmentThreshold) {
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
}

/**
 * エポックタイムスタンプパーサー
 */
class EpochTimestampParser {
    /**
     * エポックタイムスタンプをパース
     */
    parseEpochTimestamp(timestamp) {
        if (timestamp === null || timestamp === undefined) {
            return;
        }

        let numericTimestamp;

        if (typeof timestamp === 'number') {
            numericTimestamp = timestamp;
        } else if (typeof timestamp === 'string') {
            numericTimestamp = parseFloat(timestamp);
        } else if (typeof timestamp === 'object' && timestamp.tag === 1) {
            numericTimestamp = timestamp.value;
        } else {
            throw new TypeError('Epoch timestamps must be expressed as floating point numbers or their string representation');
        }

        if (Number.isNaN(numericTimestamp) || numericTimestamp === Infinity || numericTimestamp === -Infinity) {
            throw new TypeError('Epoch timestamps must be valid, non-Infinite, non-NaN numerics');
        }

        return new Date(Math.round(numericTimestamp * 1000));
    }
}

/**
 * 統合日時処理システム
 */
class IntegratedDateTimeProcessor {
    constructor() {
        this.stackTraceWarning = new StackTraceWarningSystem();
        this.utcProcessor = new UtcDateTimeProcessor();
        this.rfc3339Parser = new Rfc3339DateTimeParser();
        this.rfc7231Parser = new Rfc7231DateTimeParser();
        this.epochParser = new EpochTimestampParser();
    }

    /**
     * 自動日時パース（複数フォーマット対応）
     */
    parseDateTime(input) {
        if (input === null || input === undefined) {
            return null;
        }

        // エポックタイムスタンプ（数値）
        if (typeof input === 'number') {
            return this.epochParser.parseEpochTimestamp(input);
        }

        if (typeof input === 'string') {
            // RFC-3339形式を試行
            try {
                return this.rfc3339Parser.parseRfc3339DateTime(input);
            } catch (error) {
                // RFC-3339（オフセット付き）を試行
                try {
                    return this.rfc3339Parser.parseRfc3339DateTimeWithOffset(input);
                } catch (error2) {
                    // RFC-7231形式を試行
                    try {
                        return this.rfc7231Parser.parseRfc7231DateTime(input);
                    } catch (error3) {
                        // エポックタイムスタンプ（文字列）を試行
                        try {
                            return this.epochParser.parseEpochTimestamp(input);
                        } catch (error4) {
                            throw new TypeError(`Unable to parse date-time: ${input}`);
                        }
                    }
                }
            }
        }

        throw new TypeError('Unsupported date-time input type');
    }

    /**
     * UTC文字列生成
     */
    toUtcString(date) {
        return this.utcProcessor.dateToUtcString(date);
    }
}

module.exports = {
    StackTraceWarningSystem,
    UtcDateTimeProcessor,
    Rfc3339DateTimeParser,
    Rfc7231DateTimeParser,
    EpochTimestampParser,
    IntegratedDateTimeProcessor
};