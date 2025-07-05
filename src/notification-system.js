// Notification system from cli.js (lines 1957-1966)

import { Z1 } from './common.js';
const lA1 = Z1(U1(), 1);
const YS2 = Z1(ZS2(), 1);

// hO2 - React hook for notification management
export function hO2() {
  const [version, setVersion] = lA1.useState(0);
  const [notification, setNotification] = lA1.useState({ show: false });
  
  const addNotification = lA1.useCallback((content, options = {}) => {
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

// t0A - iTerm2 notification
export function t0A({ message, title }) {
  const notificationText = title ? `${title}:\n${message}` : message;
  
  try {
    process.stdout.write(`\x1B]9;\n\n${notificationText}\x07`);
  } catch {
    // Ignore errors
  }
}

// FS2 - Kitty terminal notification
export function FS2({ message, title }) {
  try {
    const id = Math.floor(Math.random() * 10000);
    process.stdout.write(`\x1B]99;i=${id}:d=0:p=title;${title || A2}\x1B\\`);
    process.stdout.write(`\x1B]99;i=${id}:p=body;${message}\x1B\\`);
    process.stdout.write(`\x1B]99;i=${id}:d=1:a=focus;\x1B\\`);
  } catch {
    // Ignore errors
  }
}

// IL6 - Ghostty terminal notification
export function IL6({ message, title }) {
  try {
    const notifTitle = title || A2;
    process.stdout.write(`\x1B]777;notify;${notifTitle};${message}\x07`);
  } catch {
    // Ignore errors
  }
}

// e0A - Terminal bell notification
export function e0A() {
  process.stdout.write("\x07");
}

// GL6 - Custom notification script
export async function GL6(notification, customCommand) {
  try {
    const title = notification.title || A2;
    const scriptPath = L51(customCommand, dA());
    await G2(scriptPath, [title, notification.message]);
  } catch (error) {
    J9(`Error triggering custom notify script: ${String(error)}`);
  }
}

// ZL6 - Check if Apple Terminal bell is disabled
export async function ZL6() {
  try {
    if (aA.terminal !== "Apple_Terminal") return false;
    
    const settingsName = (await G2("osascript", [
      "-e",
      'tell application "Terminal" to name of current settings of front window'
    ])).stdout.trim();
    
    if (!settingsName) return false;
    
    const defaultsExport = await G2("defaults", ["export", "com.apple.Terminal", "-"]);
    if (defaultsExport.code !== 0) return false;
    
    const plist = YS2.default.parse(defaultsExport.stdout);
    const windowSettings = plist?.["Window Settings"]?.[settingsName];
    
    if (!windowSettings) return false;
    
    return windowSettings.Bell === false;
  } catch (error) {
    h1(error instanceof Error ? error : new Error(String(error)));
    return false;
  }
}

// Rc - Main notification handler
export async function Rc(notification) {
  const settings = WA();
  const channel = settings.preferredNotifChannel;
  let methodUsed = "none";
  
  // Custom notification command
  if (settings.customNotifyCommand) {
    await GL6(notification, settings.customNotifyCommand);
  }
  
  // Platform notifications
  await _O2(notification);
  
  switch (channel) {
    case "auto":
      if (aA.terminal === "Apple_Terminal") {
        if (await ZL6()) {
          e0A();
          methodUsed = "terminal_bell";
        } else {
          methodUsed = "no_method_available";
        }
      } else if (aA.terminal === "iTerm.app") {
        t0A(notification);
        methodUsed = "iterm2";
      } else if (aA.terminal === "kitty") {
        FS2(notification);
        methodUsed = "kitty";
      } else if (aA.terminal === "ghostty") {
        IL6(notification);
        methodUsed = "ghostty";
      } else {
        methodUsed = "no_method_available";
      }
      break;
      
    case "iterm2":
      t0A(notification);
      methodUsed = "iterm2";
      break;
      
    case "terminal_bell":
      e0A();
      methodUsed = "terminal_bell";
      break;
      
    case "iterm2_with_bell":
      t0A(notification);
      e0A();
      methodUsed = "iterm2_with_bell";
      break;
      
    case "kitty":
      FS2(notification);
      methodUsed = "kitty";
      break;
      
    case "notifications_disabled":
      methodUsed = "disabled";
      break;
  }
  
  await E1("notification_method_used", {
    configured_channel: channel,
    method_used: methodUsed,
    term: aA.terminal
  });
}

// _O2 - Execute notification hooks (moved from hook-system.js)
export async function _O2(notification) {
  const hookData = {
    ...Wz1(),
    hook_event_name: "Notification",
    message: notification.message,
    title: notification.title
  };
  
  await jq6(hookData);
}