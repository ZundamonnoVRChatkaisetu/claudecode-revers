import { createRequire } from "module";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const currentModuleRequire = createRequire(import.meta.url);

/**
 * Dynamically loads the ripgrep main module.
 * @param {any} A - Unused parameter in the original code, likely a context object.
 * @returns {function} - The ripgrep main function.
 */
function loadRipgrepMain(A) {
  let ripgrepPath;
  // Check for Bun runtime and embedded files
  if (typeof Bun !== "undefined" && Bun.embeddedFiles?.length > 0) {
    ripgrepPath = "./ripgrep.node";
  } else {
    // Construct path relative to the current module
    ripgrepPath = join(dirname(fileURLToPath(import.meta.url)), "ripgrep.node");
  }

  // Load ripgrepMain from the determined path
  const { ripgrepMain } = currentModuleRequire(ripgrepPath);
  return ripgrepMain(A); // Pass the original argument A to ripgrepMain
}

export { loadRipgrepMain };