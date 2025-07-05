import { exec, execSync } from 'child_process';
import { getProjectDirectory } from './shell-snapshot.js';
import { logError } from './logger.js';

const SECOND = 1000;
const MINUTE = 60;

/**
 * コマンドを実行（プロジェクトディレクトリを使用）
 */
export function runCommand(command, args, options = {
  timeout: 10 * MINUTE * SECOND,
  preserveOutputOnError: true,
  useCwd: true
}) {
  return runCommandWithOptions(command, args, {
    abortSignal: options.abortSignal,
    timeout: options.timeout,
    preserveOutputOnError: options.preserveOutputOnError,
    cwd: options.useCwd ? getProjectDirectory() : undefined,
    env: options.env
  });
}

/**
 * コマンドを実行（詳細オプション付き）
 */
export function runCommandWithOptions(command, args, options = {
  timeout: 10 * MINUTE * SECOND,
  preserveOutputOnError: true
}) {
  const {
    abortSignal,
    timeout = 10 * MINUTE * SECOND,
    preserveOutputOnError = true,
    cwd,
    env
  } = options;
  
  return new Promise((resolve) => {
    try {
      exec(command, args, {
        maxBuffer: 1e6,
        signal: abortSignal,
        timeout,
        cwd,
        env
      }, (error, stdout, stderr) => {
        if (error) {
          if (preserveOutputOnError) {
            const code = typeof error.code === 'number' ? error.code : 1;
            resolve({
              stdout: stdout || '',
              stderr: stderr || '',
              code,
              error: typeof error.code === 'string' ? error.code : String(code)
            });
          } else {
            resolve({
              stdout: '',
              stderr: '',
              code: 1
            });
          }
        } else {
          resolve({
            stdout,
            stderr,
            code: 0
          });
        }
      });
    } catch (error) {
      logError(error);
      resolve({
        stdout: '',
        stderr: '',
        code: 1
      });
    }
  });
}

/**
 * コマンドを同期実行してテキスト出力を取得
 */
export function runCommandSync(command, options, defaultTimeout = 10 * MINUTE * SECOND) {
  let execOptions;
  
  if (options === undefined) {
    execOptions = {};
  } else if (options instanceof AbortSignal) {
    execOptions = {
      abortSignal: options,
      timeout: defaultTimeout
    };
  } else {
    execOptions = options;
  }
  
  const {
    abortSignal,
    timeout = defaultTimeout
  } = execOptions;
  
  abortSignal?.throwIfAborted();
  
  const result = execSync(command, {
    env: process.env,
    maxBuffer: 1e6,
    timeout,
    cwd: getProjectDirectory(),
    stdio: ['ignore', 'pipe', 'pipe']
  });
  
  if (!result) {
    return null;
  }
  
  return result.toString().trim() || null;
}