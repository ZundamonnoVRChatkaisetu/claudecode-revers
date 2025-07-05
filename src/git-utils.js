/**
 * Git Utilities
 */

const { U9 } = require('./system-core'); // Assuming U9 gets the current working directory
const { UBQ } = require('./bash-tool-core'); // Assuming UBQ executes bash commands
const { pU0 } = require('./error-utils'); // Assuming pU0 handles errors
const { O0 } = require('./utils'); // Assuming O0 is a memoization utility

// Function to get the top-level Git directory
const getGitToplevelDirectory = O0(() => {
    let cwd = U9();
    try {
        return UBQ("git rev-parse --show-toplevel", {cwd: cwd, encoding: "utf8", stdio: ["pipe", "pipe", "ignore"]}).trim();
    } catch {
        return pU0(cwd);
    }
});

module.exports = {
    getGitToplevelDirectory
};
