// Process utilities module stub
import { spawn, exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function executeProcess(command, args = [], options = {}) {
    try {
        if (Array.isArray(args) && args.length > 0) {
            // Use spawn for commands with arguments
            return new Promise((resolve, reject) => {
                const child = spawn(command, args, {
                    stdio: 'pipe',
                    ...options
                });
                
                let stdout = '';
                let stderr = '';
                
                child.stdout.on('data', (data) => {
                    stdout += data.toString();
                });
                
                child.stderr.on('data', (data) => {
                    stderr += data.toString();
                });
                
                child.on('close', (code) => {
                    resolve({
                        stdout: stdout.trim(),
                        stderr: stderr.trim(),
                        code
                    });
                });
                
                child.on('error', reject);
            });
        } else {
            // Use exec for simple commands
            const result = await execAsync(command, options);
            return {
                stdout: result.stdout.trim(),
                stderr: result.stderr.trim(),
                code: 0
            };
        }
    } catch (error) {
        return {
            stdout: '',
            stderr: error.message,
            code: error.code || 1
        };
    }
}