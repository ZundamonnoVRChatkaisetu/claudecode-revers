/**
 * Install Method Detector
 */

// Function to detect install method based on auto-updater status
function detectInstallMethod(autoUpdaterStatus) {
    let installMethod = "unknown";
    let autoUpdatesEnabled = true;

    switch (autoUpdaterStatus) {
        case "migrated":
            installMethod = "local";
            break;
        case "installed":
            installMethod = "native";
            break;
        case "disabled":
            autoUpdatesEnabled = false;
            break;
        case "enabled":
        case "no_permissions":
        case "not_configured":
            installMethod = "global";
            break;
        case undefined:
            break;
    }

    return { installMethod, autoUpdates: autoUpdatesEnabled };
}

module.exports = {
    detectInstallMethod
};
