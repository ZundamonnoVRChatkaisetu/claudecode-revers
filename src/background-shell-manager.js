// Background Shell Management System
// Reconstructed from cli.js lines 1577-1586

// Background Shell class
class dM2 {
    id;
    command;
    startTime;
    status;
    result;
    shellCommand;
    stdout = "";
    stderr = "";
    
    constructor(A, B, Q, D) {
        this.id = A;
        this.command = B;
        this.status = "running";
        this.startTime = Date.now();
        this.shellCommand = Q;
        
        iA(`BackgroundShell ${A} created for command: ${B}`);
        
        let I = Q.background(A);
        if (!I) {
            this.status = "failed";
            this.result = { code: 1, interrupted: false };
        } else {
            I.stdoutStream.on("data", (G) => {
                this.stdout += G.toString();
            });
            
            I.stderrStream.on("data", (G) => {
                this.stderr += G.toString();
            });
            
            Q.result.then((G) => {
                if (G.code === 0) {
                    this.status = "completed";
                } else {
                    this.status = "failed";
                }
                
                this.result = { code: G.code, interrupted: G.interrupted };
                
                iA(`BackgroundShell ${A} completed with code ${G.code} (interrupted: ${G.interrupted})`);
                D(G);
            });
        }
    }
    
    getOutput() {
        let A = { stdout: this.stdout, stderr: this.stderr };
        
        // Clear buffers after reading
        this.stdout = "";
        this.stderr = "";
        
        return A;
    }
    
    hasNewOutput() {
        return !!this.stdout;
    }
    
    kill() {
        try {
            iA(`BackgroundShell ${this.id} kill requested`);
            this.shellCommand?.kill();
            this.status = "killed";
            return true;
        } catch (A) {
            h1(A instanceof Error ? A : new Error(String(A)));
            return false;
        }
    }
    
    dispose() {
        this.shellCommand = null;
    }
}

// Background Shell Manager (Singleton)
class Zc {
    static instance = null;
    shells = new Map;
    shellCounter = 0;
    subscribers = new Set;
    
    constructor() {}
    
    static getInstance() {
        if (!Zc.instance) {
            Zc.instance = new Zc;
        }
        return Zc.instance;
    }
    
    subscribe(A) {
        this.subscribers.add(A);
        return () => {
            this.subscribers.delete(A);
        };
    }
    
    notifySubscribers() {
        this.subscribers.forEach((A) => {
            try {
                A();
            } catch (B) {
                h1(B);
            }
        });
    }
    
    addBackgroundShell(A) {
        this.shells.set(A.id, A);
        this.notifySubscribers();
        return A.id;
    }
    
    completeShell(A, B) {
        let Q = this.shells.get(A);
        if (!Q) return;
        
        Q.status = B.code === 0 ? "completed" : "failed";
        
        iA(`Shell ${A} completed: status=${Q.status}, code=${B.code}, interrupted=${B.interrupted}`);
        
        if (B.code === 143) {
            iA(`Shell ${A} exited with code 143 (SIGTERM) - likely terminated by timeout or explicit kill`);
        }
        
        Q.result = { code: B.code, interrupted: B.interrupted };
        this.notifySubscribers();
    }
    
    getAllShells() {
        return Array.from(this.shells.values());
    }
    
    getActiveShells() {
        return Array.from(this.shells.values()).filter((A) => A.status === "running");
    }
    
    getActiveShellCount() {
        return this.getActiveShells().length;
    }
    
    getShell(A) {
        return this.shells.get(A);
    }
    
    getShellOutput(A) {
        let B = this.shells.get(A);
        if (!B) {
            return {
                shellId: A,
                command: "",
                status: "failed",
                exitCode: null,
                stdout: "",
                stderr: "Shell not found"
            };
        }
        
        let Q = B.result ? B.result.code : null;
        let { stdout: D, stderr: I } = B.getOutput();
        
        return {
            shellId: A,
            command: B.command,
            status: B.status,
            exitCode: Q,
            stdout: D.trimEnd(),
            stderr: I.trimEnd()
        };
    }
    
    getShellsUnreadOutputInfo() {
        return this.getActiveShells().map((A) => {
            let B = A.hasNewOutput();
            return {
                id: A.id,
                command: A.command,
                hasNewOutput: B
            };
        });
    }
    
    removeShell(A) {
        let B = this.shells.get(A);
        if (B) {
            if (B.status === "running") {
                B.kill();
                B.dispose();
            }
            
            let Q = this.shells.delete(A);
            this.notifySubscribers();
            return Q;
        }
        return false;
    }
    
    killShell(A) {
        let B = this.shells.get(A);
        if (B && B.status === "running") {
            iA(`Killing shell ${A} (command: ${B.command})`);
            B.kill();
            
            // Auto-cleanup after 30 minutes
            setTimeout(() => {
                if (this.shells.get(A)) {
                    B.dispose();
                }
            }, 1800000);
            
            this.notifySubscribers();
            return true;
        }
        return false;
    }
    
    moveToBackground(A, B) {
        let Q = this.generateShellId();
        
        iA(`Moving command to background: ${A} (shellId: ${Q})`);
        
        let D = new dM2(Q, A, B, (I) => {
            this.completeShell(D.id, I);
        });
        
        this.addBackgroundShell(D);
        return Q;
    }
    
    generateShellId() {
        return `bash_${++this.shellCounter}`;
    }
}

// Global instance
const dU = Zc.getInstance();

module.exports = {
    dM2,
    Zc,
    dU
};