// Date Utils and UI Components - Restored from cli.js lines 2428-2437

import React from 'react';

// Code review template data (from lines 2418-2435)
const CODE_REVIEW_TEMPLATE = {
  // GitHub CLI integration process (lines 2418-2427)
  process: [
    "2. If a PR number is provided, use Bash(\"gh pr view <number>\") to get PR details",
    "3. Use Bash(\"gh pr diff <number>\") to get the diff",
    "4. Analyze the changes and provide a thorough code review that includes:",
    "   - Overview of what the PR does",
    "   - Analysis of code quality and style", 
    "   - Specific suggestions for improvements",
    "   - Any potential issues or risks"
  ],
  
  // Review focus areas
  focus: [
    "Keep your review concise but thorough. Focus on:",
    "- Code correctness"
  ],
  
  // Review sections (lines 2428-2435)
  sections: [
    "Following project conventions",
    "Performance implications", 
    "Test coverage",
    "Security considerations"
  ],
  
  format: "Format your review with clear sections and bullet points.",
  
  getTemplate: (prNumber) => `
      2. If a PR number is provided, use Bash("gh pr view <number>") to get PR details
      3. Use Bash("gh pr diff <number>") to get the diff
      4. Analyze the changes and provide a thorough code review that includes:
         - Overview of what the PR does
         - Analysis of code quality and style
         - Specific suggestions for improvements
         - Any potential issues or risks
      
      Keep your review concise but thorough. Focus on:
      - Code correctness
      - Following project conventions
      - Performance implications
      - Test coverage
      - Security considerations

      Format your review with clear sections and bullet points.

      PR number: ${prNumber}
    `,
  
  // Analysis components
  analysis: {
    overview: "Overview of what the PR does",
    quality: "Analysis of code quality and style", 
    suggestions: "Specific suggestions for improvements",
    risks: "Any potential issues or risks"
  },
  
  // GitHub CLI commands
  commands: {
    viewPR: (number) => `gh pr view ${number}`,
    diffPR: (number) => `gh pr diff ${number}`
  }
};

// Date utility constants
const MILLISECONDS_IN_EPOCH = Math.pow(10, 8) * 24 * 60 * 60 * 1000;
const NEGATIVE_EPOCH = -MILLISECONDS_IN_EPOCH;
const SECONDS_IN_HALF_DAY = 43200; // seconds in 12 hours
const MINUTES_IN_DAY = 1440; // minutes in a day

// Symbol for date construction
const CONSTRUCT_DATE_FROM = Symbol.for("constructDateFrom");

// Core date utility functions
function constructDate(constructor, value) {
  if (typeof constructor === "function") return constructor(value);
  if (constructor && typeof constructor === "object" && CONSTRUCT_DATE_FROM in constructor) {
    return constructor[CONSTRUCT_DATE_FROM](value);
  }
  if (constructor instanceof Date) return new constructor.constructor(value);
  return new Date(value);
}

function normalizeDate(date, constructor) {
  return constructDate(constructor || date, date);
}

// Date construction cache
const dateConstructionCache = {};

function getDefaultOptions() {
  return dateConstructionCache;
}

// Get UTC offset
function getTimezoneOffset(date) {
  const normalizedDate = normalizeDate(date);
  const utcDate = new Date(Date.UTC(
    normalizedDate.getFullYear(),
    normalizedDate.getMonth(),
    normalizedDate.getDate(),
    normalizedDate.getHours(),
    normalizedDate.getMinutes(),
    normalizedDate.getSeconds(),
    normalizedDate.getMilliseconds()
  ));
  utcDate.setUTCFullYear(normalizedDate.getFullYear());
  return +date - +utcDate;
}

// Construct dates with context
function constructDates(constructor, ...dates) {
  const constructDate = constructDate.bind(null, constructor || dates.find(d => typeof d === "object"));
  return dates.map(constructDate);
}

// Compare dates
function compareAsc(dateLeft, dateRight) {
  const diff = +normalizeDate(dateLeft) - +normalizeDate(dateRight);
  if (diff < 0) return -1;
  else if (diff > 0) return 1;
  return diff;
}

// Get current date
function constructNow(constructor) {
  return constructDate(constructor, Date.now());
}

// Calculate difference in months
function differenceInMonths(dateLeft, dateRight, options) {
  const [left, right] = constructDates(options?.in, dateLeft, dateRight);
  const yearsDiff = left.getFullYear() - right.getFullYear();
  const monthsDiff = left.getMonth() - right.getMonth();
  return yearsDiff * 12 + monthsDiff;
}

// Rounding function factory
function getRoundingFunction(method) {
  return (value) => {
    const result = (method ? Math[method] : Math.trunc)(value);
    return result === 0 ? 0 : result;
  };
}

// Calculate difference in milliseconds
function differenceInMilliseconds(dateLeft, dateRight) {
  return +normalizeDate(dateLeft) - +normalizeDate(dateRight);
}

// Get end of day
function endOfDay(date, options) {
  const result = normalizeDate(date, options?.in);
  result.setHours(23, 59, 59, 999);
  return result;
}

// Get end of month
function endOfMonth(date, options) {
  const result = normalizeDate(date, options?.in);
  const month = result.getMonth();
  result.setFullYear(result.getFullYear(), month + 1, 0);
  result.setHours(23, 59, 59, 999);
  return result;
}

// Check if date is last day of month
function isLastDayOfMonth(date, options) {
  const normalizedDate = normalizeDate(date, options?.in);
  return +endOfDay(normalizedDate, options) === +endOfMonth(normalizedDate, options);
}

// Calculate difference in months with edge cases
function differenceInMonthsWithOptions(dateLeft, dateRight, options) {
  const [originalLeft, left, right] = constructDates(options?.in, dateLeft, dateLeft, dateRight);
  const sign = compareAsc(left, right);
  const difference = Math.abs(differenceInMonths(left, right));
  
  if (difference < 1) return 0;
  
  if (left.getMonth() === 1 && left.getDate() > 27) {
    left.setDate(30);
  }
  
  left.setMonth(left.getMonth() - sign * difference);
  
  const isLastDayNotEqual = compareAsc(left, right) === -sign;
  
  if (isLastDayOfMonth(originalLeft) && difference === 1 && compareAsc(originalLeft, right) === 1) {
    isLastDayNotEqual = false;
  }
  
  const result = sign * (difference - +isLastDayNotEqual);
  return result === 0 ? 0 : result;
}

// Calculate difference in seconds
function differenceInSeconds(dateLeft, dateRight, options) {
  const diff = differenceInMilliseconds(dateLeft, dateRight) / 1000;
  return getRoundingFunction(options?.roundingMethod)(diff);
}

// Locale data for distance formatting
const DISTANCE_FORMATS = {
  lessThanXSeconds: {
    one: "less than a second",
    other: "less than {{count}} seconds"
  },
  xSeconds: {
    one: "1 second",
    other: "{{count}} seconds"
  },
  halfAMinute: "half a minute",
  lessThanXMinutes: {
    one: "less than a minute",
    other: "less than {{count}} minutes"
  },
  xMinutes: {
    one: "1 minute",
    other: "{{count}} minutes"
  },
  aboutXHours: {
    one: "about 1 hour",
    other: "about {{count}} hours"
  },
  xHours: {
    one: "1 hour",
    other: "{{count}} hours"
  },
  xDays: {
    one: "1 day",
    other: "{{count}} days"
  },
  aboutXWeeks: {
    one: "about 1 week",
    other: "about {{count}} weeks"
  },
  xWeeks: {
    one: "1 week",
    other: "{{count}} weeks"
  },
  aboutXMonths: {
    one: "about 1 month",
    other: "about {{count}} months"
  },
  xMonths: {
    one: "1 month",
    other: "{{count}} months"
  },
  aboutXYears: {
    one: "about 1 year",
    other: "about {{count}} years"
  },
  xYears: {
    one: "1 year",
    other: "{{count}} years"
  },
  overXYears: {
    one: "over 1 year",
    other: "over {{count}} years"
  },
  almostXYears: {
    one: "almost 1 year",
    other: "almost {{count}} years"
  }
};

// Format distance helper
const formatDistanceLocale = (token, count, options) => {
  let result;
  const tokenValue = DISTANCE_FORMATS[token];
  
  if (typeof tokenValue === "string") {
    result = tokenValue;
  } else if (count === 1) {
    result = tokenValue.one;
  } else {
    result = tokenValue.other.replace("{{count}}", count.toString());
  }
  
  if (options?.addSuffix) {
    if (options.comparison && options.comparison > 0) {
      return "in " + result;
    } else {
      return result + " ago";
    }
  }
  
  return result;
};

// Format width helper
function buildFormatLongFn(formatObject) {
  return (options = {}) => {
    const width = options.width ? String(options.width) : formatObject.defaultWidth;
    return formatObject.formats[width] || formatObject.formats[formatObject.defaultWidth];
  };
}

// Date format definitions
const DATE_FORMATS = {
  full: "EEEE, MMMM do, y",
  long: "MMMM do, y", 
  medium: "MMM d, y",
  short: "MM/dd/yyyy"
};

const TIME_FORMATS = {
  full: "h:mm:ss a zzzz",
  long: "h:mm:ss a z",
  medium: "h:mm:ss a",
  short: "h:mm a"
};

const DATE_TIME_FORMATS = {
  full: "{{date}} 'at' {{time}}",
  long: "{{date}} 'at' {{time}}",
  medium: "{{date}}, {{time}}",
  short: "{{date}}, {{time}}"
};

// Format long configurations
const LONG_FORMATS = {
  date: buildFormatLongFn({ formats: DATE_FORMATS, defaultWidth: "full" }),
  time: buildFormatLongFn({ formats: TIME_FORMATS, defaultWidth: "full" }),
  dateTime: buildFormatLongFn({ formats: DATE_TIME_FORMATS, defaultWidth: "full" })
};

// Relative format definitions
const RELATIVE_FORMATS = {
  lastWeek: "'last' eeee 'at' p",
  yesterday: "'yesterday at' p",
  today: "'today at' p",
  tomorrow: "'tomorrow at' p",
  nextWeek: "eeee 'at' p",
  other: "P"
};

const formatRelative = (token, date, baseDate, options) => RELATIVE_FORMATS[token];

// Main format distance function
function formatDistance(date, baseDate, options) {
  const defaultOptions = getDefaultOptions();
  const locale = options?.locale ?? defaultOptions.locale ?? { formatDistance: formatDistanceLocale };
  const minutesInDay = 1440;
  const minutesInAlmostTwoWeeks = 2520;
  
  const comparison = compareAsc(date, baseDate);
  if (isNaN(comparison)) {
    throw new RangeError("Invalid time value");
  }
  
  const formatOptions = Object.assign({}, options, {
    addSuffix: options?.addSuffix,
    comparison: comparison
  });
  
  const [laterDate, earlierDate] = constructDates(
    options?.in,
    ...(comparison > 0 ? [baseDate, date] : [date, baseDate])
  );
  
  const seconds = differenceInSeconds(earlierDate, laterDate);
  const offsetCorrection = (getTimezoneOffset(earlierDate) - getTimezoneOffset(laterDate)) / 1000;
  const minutes = Math.round((seconds - offsetCorrection) / 60);
  
  let months;
  
  if (minutes < 2) {
    if (options?.includeSeconds) {
      if (seconds < 5) {
        return locale.formatDistance("lessThanXSeconds", 5, formatOptions);
      } else if (seconds < 10) {
        return locale.formatDistance("lessThanXSeconds", 10, formatOptions);
      } else if (seconds < 20) {
        return locale.formatDistance("lessThanXSeconds", 20, formatOptions);
      } else if (seconds < 40) {
        return locale.formatDistance("halfAMinute", 0, formatOptions);
      } else if (seconds < 60) {
        return locale.formatDistance("lessThanXMinutes", 1, formatOptions);
      } else {
        return locale.formatDistance("xMinutes", 1, formatOptions);
      }
    } else {
      if (minutes === 0) {
        return locale.formatDistance("lessThanXMinutes", 1, formatOptions);
      } else {
        return locale.formatDistance("xMinutes", minutes, formatOptions);
      }
    }
  } else if (minutes < 45) {
    return locale.formatDistance("xMinutes", minutes, formatOptions);
  } else if (minutes < 90) {
    return locale.formatDistance("aboutXHours", 1, formatOptions);
  } else if (minutes < minutesInDay) {
    const hours = Math.round(minutes / 60);
    return locale.formatDistance("aboutXHours", hours, formatOptions);
  } else if (minutes < minutesInAlmostTwoWeeks) {
    return locale.formatDistance("xDays", 1, formatOptions);
  } else if (minutes < SECONDS_IN_HALF_DAY) {
    const days = Math.round(minutes / minutesInDay);
    return locale.formatDistance("xDays", days, formatOptions);
  } else if (minutes < SECONDS_IN_HALF_DAY * 2) {
    months = Math.round(minutes / SECONDS_IN_HALF_DAY);
    return locale.formatDistance("aboutXMonths", months, formatOptions);
  }
  
  months = differenceInMonthsWithOptions(earlierDate, laterDate);
  
  if (months < 12) {
    const nearestMonth = Math.round(minutes / SECONDS_IN_HALF_DAY);
    return locale.formatDistance("xMonths", nearestMonth, formatOptions);
  } else {
    const monthsRemainder = months % 12;
    const years = Math.trunc(months / 12);
    
    if (monthsRemainder < 3) {
      return locale.formatDistance("aboutXYears", years, formatOptions);
    } else if (monthsRemainder < 9) {
      return locale.formatDistance("overXYears", years, formatOptions);
    } else {
      return locale.formatDistance("almostXYears", years + 1, formatOptions);
    }
  }
}

// Format distance to now
function formatDistanceToNow(date, options) {
  return formatDistance(date, constructNow(date), options);
}

// Session status color mapping
function getStatusColor(status) {
  switch (status) {
    case "pending":
    case "queued":
      return "warning";
    case "in_progress":
      return "permission";
    case "completed":
      return "success";
    case "failed":
      return "error";
    case "cancelled":
      return "secondaryText";
    case "timed_out":
      return "autoAccept";
    default:
      return "text";
  }
}

// Session status icon mapping
function getStatusIcon(status) {
  const icons = {
    circle: "○",
    circleDotted: "◌", 
    circleFilled: "●",
    tick: "✓",
    cross: "✗",
    circleCircle: "◎",
    warning: "⚠",
    questionMarkPrefix: "?"
  };
  
  switch (status) {
    case "pending":
      return icons.circle;
    case "queued":
      return icons.circleDotted;
    case "in_progress":
      return icons.circleFilled;
    case "completed":
      return icons.tick;
    case "failed":
      return icons.cross;
    case "cancelled":
      return icons.circleCircle;
    case "timed_out":
      return icons.warning;
    default:
      return icons.questionMarkPrefix;
  }
}

// Session list item component
const SessionItem = React.memo(function SessionItem({ session, isSelected, index }) {
  const color = getStatusColor(session.status);
  const icon = getStatusIcon(session.status);
  
  return React.createElement("div", null,
    React.createElement("span", { 
      style: { 
        backgroundColor: isSelected ? "highlight" : "transparent",
        color: isSelected ? "text" : "secondaryText"
      }
    }, [
      React.createElement("span", {
        style: { color: isSelected ? "text" : "secondaryText" }
      }, "[", index + 1, "]"),
      " ",
      React.createElement("span", { style: { color } }, icon),
      " ",
      React.createElement("span", {
        style: { fontWeight: isSelected ? "bold" : "normal" }
      }, session.name),
      " ",
      React.createElement("span", {
        style: { color: isSelected ? "dim" : "secondaryText" }
      }, "(", session.status, ")"),
      " ",
      React.createElement("span", {
        style: { color: isSelected ? "dim" : "secondaryText" }
      }, "- ", formatDistanceToNow(session.updatedAt, { addSuffix: true }))
    ])
  );
});

// Divider component
function Divider({ 
  width = "auto", 
  dividerChar, 
  dividerColor = "secondaryText", 
  boxProps 
}) {
  return React.createElement("div", {
    style: {
      width,
      borderStyle: {
        topLeft: "",
        top: "",
        topRight: "",
        right: "",
        bottomRight: "",
        bottom: dividerChar || "─",
        bottomLeft: "",
        left: ""
      },
      borderColor: dividerColor,
      flexGrow: 1,
      borderBottom: true,
      borderTop: false,
      borderLeft: false,
      borderRight: false,
      ...boxProps
    }
  });
}

// Title divider component
function TitleDivider({
  title,
  width = "auto",
  padding = 0,
  titlePadding = 1,
  titleColor = "text",
  dividerChar = "─",
  dividerColor = "secondaryText",
  boxProps
}) {
  const divider = React.createElement(Divider, {
    dividerChar,
    dividerColor,
    boxProps
  });
  
  if (!title) {
    return React.createElement("div", {
      style: { paddingLeft: padding, paddingRight: padding }
    }, divider);
  }
  
  return React.createElement("div", {
    style: {
      width,
      paddingLeft: padding,
      paddingRight: padding,
      gap: titlePadding,
      flexDirection: "row",
      alignItems: "center"
    }
  }, [
    divider,
    React.createElement("div", null,
      React.createElement("span", { style: { color: titleColor } }, title)
    ),
    divider
  ]);
}

// Status display component
function StatusDisplay({ sections, version, onClose }) {
  // Handle keyboard events (mock implementation)
  const handleKeyboard = (key, keyData) => {
    if (keyData.return || keyData.escape) {
      onClose();
    }
  };
  
  // Mock exit state
  const exitState = { pending: false, keyName: "esc" };
  
  // Mock MCP state and model info
  const [{ mainLoopModel, maxRateLimitFallbackActive }] = [{ 
    mainLoopModel: null, 
    maxRateLimitFallbackActive: false 
  }];
  
  const modelDisplay = formatModelDisplay(mainLoopModel, maxRateLimitFallbackActive);
  
  // Add model section
  const allSections = [...sections, {
    title: "Model",
    command: "/model",
    items: [{
      label: modelDisplay,
      type: "info"
    }]
  }];
  
  return React.createElement("div", {
    style: {
      flexDirection: "column",
      width: "100%",
      padding: 1
    }
  }, [
    React.createElement("div", {
      style: { flexDirection: "column", gap: 1 }
    }, [
      React.createElement("div", null, [
        React.createElement("span", { style: { fontWeight: "bold" } }, "Claude Code Status "),
        React.createElement("span", { style: { color: "secondaryText" } }, "v", version)
      ]),
      React.createElement("div", null, [
        React.createElement("span", { style: { color: "secondaryText" } }, " L "),
        React.createElement("span", null, "Session ID: ", getSessionId())
      ]),
      
      // Render all sections
      ...allSections.map((section, index) => 
        (section.items && section.items.length > 0 || section.content) &&
        React.createElement("div", {
          key: index,
          style: { flexDirection: "column", gap: 0 }
        }, [
          React.createElement("div", null, [
            React.createElement("span", { style: { fontWeight: "bold" } }, section.title, " "),
            section.command && React.createElement("span", {
              style: { color: "secondaryText" }
            }, "• ", section.command)
          ]),
          
          // Render section items
          section.items?.map((item, itemIndex) =>
            React.createElement("div", { key: itemIndex }, [
              item.type === "check" 
                ? React.createElement("span", { style: { color: "success" } }, "✓ ")
                : item.type === "error"
                ? React.createElement("span", { style: { color: "error" } }, "⚠ ")
                : React.createElement("span", { style: { color: "secondaryText" } }, " L "),
              React.createElement("span", null, item.label)
            ])
          ),
          
          // Render custom content
          section.content
        ])
      ),
      
      React.createElement("div", { style: { marginTop: 1 } },
        exitState.pending 
          ? React.createElement("span", { style: { color: "dim" } },
              "Press ", exitState.keyName, " again to exit"
            )
          : React.createElement("div", null, "Press any key to exit")
      )
    ])
  ]);
}

// Helper functions (mock implementations)
function formatModelDisplay(model, fallbackActive) {
  if (model === null) {
    return "Default Sonnet";
  }
  return model;
}

function getSessionId() {
  return "sess_123456";
}

// Export all utilities
export {
  // Core date functions
  constructDate,
  normalizeDate,
  constructDates,
  compareAsc,
  constructNow,
  
  // Date calculations
  differenceInMonths,
  differenceInMilliseconds,
  differenceInSeconds,
  differenceInMonthsWithOptions,
  
  // Date utilities
  endOfDay,
  endOfMonth,
  isLastDayOfMonth,
  getTimezoneOffset,
  
  // Formatting
  formatDistance,
  formatDistanceToNow,
  formatDistanceLocale,
  
  // UI Components
  SessionItem,
  Divider,
  TitleDivider,
  StatusDisplay,
  
  // Status utilities
  getStatusColor,
  getStatusIcon,
  
  // Constants
  CODE_REVIEW_TEMPLATE,
  DISTANCE_FORMATS,
  LONG_FORMATS
};