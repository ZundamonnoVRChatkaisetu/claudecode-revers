// Notification system from cli.js (lines 1957-1966)

import { createLazyImport } from './common.js';
import { getReactHooks } from './react-hooks.js';
import { getXMLParser } from './xml-parser.js';
import { getDefaultNotificationTitle } from './constants.js';
import { resolveScriptPath, getCurrentDirectory } from './path-utils.js';
import { executeProcess } from './process-utils.js';
import { logError, handleError } from './errors.js';
import { getEnvironmentInfo } from './environment.js';
import { getSettings } from './config.js';
import { sendTelemetry } from './telemetry.js';
import { getBaseHookData, executeHooks } from './hooks.js';

const react = createLazyImport(getReactHooks, 1);
const xmlParser = createLazyImport(getXMLParser, 1);

// React hook for notification management
export function useNotificationSystem() {
  const [version, setVersion] = react.useState(0);
  const [notification, setNotification] = react.useState({ show: false });
  
  const addNotification = react.useCallback((content, options = {}) => {
    const { timeoutMs = 8000 } = options;
    
    setVersion((prevVersion) => {
      const newVersion = prevVersion + 1;
      
      setNotification({ show: true, content });
      
      setTimeout(() => {
        setVersion((currentVersion) => {
          if (newVersion === currentVersion) {
            setNotification({ show: false });
          }
          return currentVersion;
        });
      }, timeoutMs);
      
      return newVersion;
    });
  }, []);
  
  return { notification, addNotification };
}

// iTerm2 notification
export function sendITermNotification({ message, title }) {
  const notificationText = title ? `${title}:\n${message}` : message;
  
  try {
    process.stdout.write(`\x1B]9;\n\n${notificationText}\x07`);
  } catch {
    // Ignore errors
  }
}

// Kitty terminal notification
export function sendKittyNotification({ message, title }) {
  try {
    const id = Math.floor(Math.random() * 10000);
    const defaultTitle = getDefaultNotificationTitle();
    process.stdout.write(`\x1B]99;i=${id}:d=0:p=title;${title || defaultTitle}\x1B\\`);
    process.stdout.write(`\x1B]99;i=${id}:p=body;${message}\x1B\\`);
    process.stdout.write(`\x1B]99;i=${id}:d=1:a=focus;\x1B\\`);
  } catch {
    // Ignore errors
  }
}

// Ghostty terminal notification
export function sendGhosttyNotification({ message, title }) {
  try {
    const defaultTitle = getDefaultNotificationTitle();
    const notifTitle = title || defaultTitle;
    process.stdout.write(`\x1B]777;notify;${notifTitle};${message}\x07`);
  } catch {
    // Ignore errors
  }
}

// Terminal bell notification
export function sendTerminalBell() {
  process.stdout.write("\x07");
}

// Custom notification script
export async function runCustomNotificationScript(notification, customCommand) {
  try {
    const defaultTitle = getDefaultNotificationTitle();
    const title = notification.title || defaultTitle;
    const scriptPath = resolveScriptPath(customCommand, getCurrentDirectory());
    await executeProcess(scriptPath, [title, notification.message]);
  } catch (error) {
    logError(`Error triggering custom notify script: ${String(error)}`);
  }
}

// Check if Apple Terminal bell is disabled
export async function isAppleTerminalBellDisabled() {
  try {
    const environmentInfo = getEnvironmentInfo();
    if (environmentInfo.terminal !== "Apple_Terminal") return false;
    
    const settingsName = (await executeProcess("osascript", [
      "-e",
      'tell application "Terminal" to name of current settings of front window'
    ])).stdout.trim();
    
    if (!settingsName) return false;
    
    const defaultsExport = await executeProcess("defaults", ["export", "com.apple.Terminal", "-"]);
    if (defaultsExport.code !== 0) return false;
    
    const plist = xmlParser.default.parse(defaultsExport.stdout);
    const windowSettings = plist?.["Window Settings"]?.[settingsName];
    
    if (!windowSettings) return false;
    
    return windowSettings.Bell === false;
  } catch (error) {
    handleError(error instanceof Error ? error : new Error(String(error)));
    return false;
  }
}

// Main notification handler
export async function handleNotification(notification) {
  const settings = getSettings();
  const channel = settings.preferredNotifChannel;
  let methodUsed = "none";
  
  // Custom notification command
  if (settings.customNotifyCommand) {
    await runCustomNotificationScript(notification, settings.customNotifyCommand);
  }
  
  // Platform notifications
  await executeNotificationHooks(notification);
  
  const environmentInfo = getEnvironmentInfo();
  
  switch (channel) {
    case "auto":
      if (environmentInfo.terminal === "Apple_Terminal") {
        if (await isAppleTerminalBellDisabled()) {
          sendTerminalBell();
          methodUsed = "terminal_bell";
        } else {
          methodUsed = "no_method_available";
        }
      } else if (environmentInfo.terminal === "iTerm.app") {
        sendITermNotification(notification);
        methodUsed = "iterm2";
      } else if (environmentInfo.terminal === "kitty") {
        sendKittyNotification(notification);
        methodUsed = "kitty";
      } else if (environmentInfo.terminal === "ghostty") {
        sendGhosttyNotification(notification);
        methodUsed = "ghostty";
      } else {
        methodUsed = "no_method_available";
      }
      break;
      
    case "iterm2":
      sendITermNotification(notification);
      methodUsed = "iterm2";
      break;
      
    case "terminal_bell":
      sendTerminalBell();
      methodUsed = "terminal_bell";
      break;
      
    case "iterm2_with_bell":
      sendITermNotification(notification);
      sendTerminalBell();
      methodUsed = "iterm2_with_bell";
      break;
      
    case "kitty":
      sendKittyNotification(notification);
      methodUsed = "kitty";
      break;
      
    case "notifications_disabled":
      methodUsed = "disabled";
      break;
  }
  
  await sendTelemetry("notification_method_used", {
    configured_channel: channel,
    method_used: methodUsed,
    term: environmentInfo.terminal
  });
}

// Execute notification hooks (moved from hook-system.js)
export async function executeNotificationHooks(notification) {
  const hookData = {
    ...getBaseHookData(),
    hook_event_name: "Notification",
    message: notification.message,
    title: notification.title
  };
  
  await executeHooks(hookData);
}