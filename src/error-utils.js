// Error handling utilities from cli.js (lines 1937-1946)

// uq6 - Extract error messages
export function uq6(error) {
  if (error instanceof Bz) {
    return [
      error.interrupted ? pX : "",
      error.stderr,
      error.stdout
    ];
  }
  
  const messages = [error.message];
  
  if ("stderr" in error && typeof error.stderr === "string") {
    messages.push(error.stderr);
  }
  
  if ("stdout" in error && typeof error.stdout === "string") {
    messages.push(error.stdout);
  }
  
  return messages;
}

// yO2 - Format Zod validation error messages
export function yO2(toolName, zodError) {
  // Extract required parameter errors
  const missingParams = zodError.errors
    .filter(err => 
      err.code === "invalid_type" && 
      err.received === "undefined" && 
      err.message === "Required"
    )
    .map(err => String(err.path[0]));
  
  // Extract unrecognized keys
  const unexpectedParams = zodError.errors
    .filter(err => err.code === "unrecognized_keys")
    .flatMap(err => err.keys);
  
  // Extract type mismatch errors
  const typeMismatches = zodError.errors
    .filter(err => 
      err.code === "invalid_type" && 
      "received" in err && 
      err.received !== "undefined" && 
      err.message !== "Required"
    )
    .map(err => {
      const typeErr = err;
      return {
        param: String(err.path[0]),
        expected: typeErr.expected,
        received: typeErr.received
      };
    });
  
  let errorMessage = zodError.message;
  const issues = [];
  
  // Format missing parameters
  if (missingParams.length > 0) {
    const messages = missingParams.map(param => 
      `The required parameter \`${param}\` is missing`
    );
    issues.push(...messages);
  }
  
  // Format unexpected parameters
  if (unexpectedParams.length > 0) {
    const messages = unexpectedParams.map(param => 
      `An unexpected parameter \`${param}\` was provided`
    );
    issues.push(...messages);
  }
  
  // Format type mismatches
  if (typeMismatches.length > 0) {
    const messages = typeMismatches.map(({ param, expected, received }) => 
      `The parameter \`${param}\` type is expected as \`${expected}\` but provided as \`${received}\``
    );
    issues.push(...messages);
  }
  
  // Combine all issues
  if (issues.length > 0) {
    errorMessage = `${toolName} failed due to the following ${issues.length > 1 ? "issues" : "issue"}:\n${issues.join('\n')}`;
  }
  
  return errorMessage;
}