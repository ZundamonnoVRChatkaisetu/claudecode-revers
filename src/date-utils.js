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
const tj6 = Math.pow(10, 8) * 24 * 60 * 60 * 1000;
const U_3 = -tj6;
const e01 = 43200; // seconds in 12 hours
const s9A = 1440; // minutes in a day

// Symbol for date construction
const o9A = Symbol.for("constructDateFrom");

// Core date utility functions
function Xp(constructor, value) {
  if (typeof constructor === "function") return constructor(value);
  if (constructor && typeof constructor === "object" && o9A in constructor) {
    return constructor[o9A](value);
  }
  if (constructor instanceof Date) return new constructor.constructor(value);
  return new Date(value);
}

function JW(date, constructor) {
  return Xp(constructor || date, date);
}

// Date construction cache
const ej6 = {};

function Jb2() {
  return ej6;
}

// Get UTC offset
function t9A(date) {
  const normalizedDate = JW(date);
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
function Vp(constructor, ...dates) {
  const constructDate = Xp.bind(null, constructor || dates.find(d => typeof d === "object"));
  return dates.map(constructDate);
}

// Compare dates
function Kp(dateLeft, dateRight) {
  const diff = +JW(dateLeft) - +JW(dateRight);
  if (diff < 0) return -1;
  else if (diff > 0) return 1;
  return diff;
}

// Get current date
function Xb2(constructor) {
  return Xp(constructor, Date.now());
}

// Calculate difference in months
function Vb2(dateLeft, dateRight, options) {
  const [left, right] = Vp(options?.in, dateLeft, dateRight);
  const yearsDiff = left.getFullYear() - right.getFullYear();
  const monthsDiff = left.getMonth() - right.getMonth();
  return yearsDiff * 12 + monthsDiff;
}

// Rounding function factory
function Kb2(method) {
  return (value) => {
    const result = (method ? Math[method] : Math.trunc)(value);
    return result === 0 ? 0 : result;
  };
}

// Calculate difference in milliseconds
function Eb2(dateLeft, dateRight) {
  return +JW(dateLeft) - +JW(dateRight);
}

// Get end of day
function Hb2(date, options) {
  const result = JW(date, options?.in);
  result.setHours(23, 59, 59, 999);
  return result;
}

// Get end of month
function zb2(date, options) {
  const result = JW(date, options?.in);
  const month = result.getMonth();
  result.setFullYear(result.getFullYear(), month + 1, 0);
  result.setHours(23, 59, 59, 999);
  return result;
}

// Check if date is last day of month
function Ub2(date, options) {
  const normalizedDate = JW(date, options?.in);
  return +Hb2(normalizedDate, options) === +zb2(normalizedDate, options);
}

// Calculate difference in months with edge cases
function wb2(dateLeft, dateRight, options) {
  const [originalLeft, left, right] = Vp(options?.in, dateLeft, dateLeft, dateRight);
  const sign = Kp(left, right);
  const difference = Math.abs(Vb2(left, right));
  
  if (difference < 1) return 0;
  
  if (left.getMonth() === 1 && left.getDate() > 27) {
    left.setDate(30);
  }
  
  left.setMonth(left.getMonth() - sign * difference);
  
  const isLastDayNotEqual = Kp(left, right) === -sign;
  
  if (Ub2(originalLeft) && difference === 1 && Kp(originalLeft, right) === 1) {
    isLastDayNotEqual = false;
  }
  
  const result = sign * (difference - +isLastDayNotEqual);
  return result === 0 ? 0 : result;
}

// Calculate difference in seconds
function Nb2(dateLeft, dateRight, options) {
  const diff = Eb2(dateLeft, dateRight) / 1000;
  return Kb2(options?.roundingMethod)(diff);
}

// Locale data for distance formatting
const Ay6 = {
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
const qb2 = (token, count, options) => {
  let result;
  const tokenValue = Ay6[token];
  
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
function Lw1(formatObject) {
  return (options = {}) => {
    const width = options.width ? String(options.width) : formatObject.defaultWidth;
    return formatObject.formats[width] || formatObject.formats[formatObject.defaultWidth];
  };
}

// Date format definitions
const By6 = {
  full: "EEEE, MMMM do, y",
  long: "MMMM do, y", 
  medium: "MMM d, y",
  short: "MM/dd/yyyy"
};

const Qy6 = {
  full: "h:mm:ss a zzzz",
  long: "h:mm:ss a z",
  medium: "h:mm:ss a",
  short: "h:mm a"
};

const Dy6 = {
  full: "{{date}} 'at' {{time}}",
  long: "{{date}} 'at' {{time}}",
  medium: "{{date}}, {{time}}",
  short: "{{date}}, {{time}}"
};

// Format long configurations
const $b2 = {
  date: Lw1({ formats: By6, defaultWidth: "full" }),
  time: Lw1({ formats: Qy6, defaultWidth: "full" }),
  dateTime: Lw1({ formats: Dy6, defaultWidth: "full" })
};

// Relative format definitions
const Iy6 = {
  lastWeek: "'last' eeee 'at' p",
  yesterday: "'yesterday at' p",
  today: "'today at' p",
  tomorrow: "'tomorrow at' p",
  nextWeek: "eeee 'at' p",
  other: "P"
};

const Lb2 = (token, date, baseDate, options) => Iy6[token];

// Main format distance function
function Tb2(date, baseDate, options) {
  const defaultOptions = Jb2();
  const locale = options?.locale ?? defaultOptions.locale ?? { formatDistance: qb2 };
  const minutesInDay = 1440;
  const minutesInAlmostTwoWeeks = 2520;
  
  const comparison = Kp(date, baseDate);
  if (isNaN(comparison)) {
    throw new RangeError("Invalid time value");
  }
  
  const formatOptions = Object.assign({}, options, {
    addSuffix: options?.addSuffix,
    comparison: comparison
  });
  
  const [laterDate, earlierDate] = Vp(
    options?.in,
    ...(comparison > 0 ? [baseDate, date] : [date, baseDate])
  );
  
  const seconds = Nb2(earlierDate, laterDate);
  const offsetCorrection = (t9A(earlierDate) - t9A(laterDate)) / 1000;
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
  } else if (minutes < e01) {
    const days = Math.round(minutes / minutesInDay);
    return locale.formatDistance("xDays", days, formatOptions);
  } else if (minutes < e01 * 2) {
    months = Math.round(minutes / e01);
    return locale.formatDistance("aboutXMonths", months, formatOptions);
  }
  
  months = wb2(earlierDate, laterDate);
  
  if (months < 12) {
    const nearestMonth = Math.round(minutes / e01);
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
function Pb2(date, options) {
  return Tb2(date, Xb2(date), options);
}

// Session status color mapping
function Oy6(status) {
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
function Ty6(status) {
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
const vj3 = React.memo(function SessionItem({ session, isSelected, index }) {
  const color = Oy6(session.status);
  const icon = Ty6(session.status);
  
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
      }, "- ", Pb2(session.updatedAt, { addSuffix: true }))
    ])
  );
});

// Divider component
function _y6({ 
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
function jy6({
  title,
  width = "auto",
  padding = 0,
  titlePadding = 1,
  titleColor = "text",
  dividerChar = "─",
  dividerColor = "secondaryText",
  boxProps
}) {
  const divider = React.createElement(_y6, {
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
function _b2({ sections, version, onClose }) {
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
  Xp as constructDate,
  JW as normalizeDate,
  Vp as constructDates,
  Kp as compareAsc,
  Xb2 as constructNow,
  
  // Date calculations
  Vb2 as differenceInMonths,
  Eb2 as differenceInMilliseconds,
  Nb2 as differenceInSeconds,
  wb2 as differenceInMonthsWithOptions,
  
  // Date utilities
  Hb2 as endOfDay,
  zb2 as endOfMonth,
  Ub2 as isLastDayOfMonth,
  t9A as getTimezoneOffset,
  
  // Formatting
  Tb2 as formatDistance,
  Pb2 as formatDistanceToNow,
  qb2 as formatDistanceLocale,
  
  // UI Components
  vj3 as SessionItem,
  _y6 as Divider,
  jy6 as TitleDivider,
  _b2 as StatusDisplay,
  
  // Status utilities
  Oy6 as getStatusColor,
  Ty6 as getStatusIcon,
  
  // Constants
  CODE_REVIEW_TEMPLATE,
  Ay6 as DISTANCE_FORMATS,
  $b2 as LONG_FORMATS
};