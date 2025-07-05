const filesToTest = [
    './src/diff-library.js',
    './src/command-security.js',
    './src/installation-manager.js',
    './src/stats-telemetry.js',
    './src/bash-tool-core.js',
    './src/bash-tool-config.js',
    './src/doctor-command.js',
    './src/shell-parser.js',
    './src/command-parser.js',
    // Add other js files here if needed
];

let allClear = true;

console.log("Starting syntax check for modified/created files...");

filesToTest.forEach(filePath => {
    try {
        require(filePath);
        console.log(`[OK] ${filePath} parsed successfully.`);
    } catch (e) {
        console.error(`[ERROR] Syntax error or runtime error during require in ${filePath}:`);
        console.error(e);
        allClear = false;
    }
});

if (allClear) {
    console.log("\nAll checked files parsed successfully!");
} else {
    console.log("\nSome files have errors. Please check the logs above.");
    process.exit(1); // Exit with error code if any file fails
}
