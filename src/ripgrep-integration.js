/**
 * Ripgrep Integration
 */

const createRequire = require('module').createRequire;
const fileURLToPath = require('url').fileURLToPath;
const { dirname, join } = require('path');

const ripgrepRequire = createRequire(import.meta.url);

function loadRipgrep(args) {
    let ripgrepPath;
    if (typeof Bun !== "undefined" && Bun.embeddedFiles?.length > 0) {
        ripgrepPath = "./ripgrep.node";
    } else {
        ripgrepPath = join(dirname(fileURLToPath(import.meta.url)), "ripgrep.node");
    }
    let { ripgrepMain: ripgrepFunction } = ripgrepRequire(ripgrepPath);
    return ripgrepFunction(args);
}

module.exports = {
    Uo0
};
