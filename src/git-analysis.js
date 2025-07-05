/**
 * Git Analysis and File History System
 * Analyzes git history to identify frequently modified files for example suggestions
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Analyze git history to find frequently modified files
 * @param {boolean} isNonInteractiveSession - Whether this is a non-interactive session
 * @returns {Promise<string[]>} Array of frequently modified file basenames
 */
async function analyzeGitHistory(isNonInteractiveSession = false) {
    try {
        // Check if we're in a git repository
        if (!isGitRepository()) {
            return [];
        }

        // Get git log with file modification statistics
        const gitLogOutput = getGitFileStatistics();
        
        if (!gitLogOutput.trim()) {
            return [];
        }

        // Parse the git output to extract file modification data
        const fileStats = parseGitStatistics(gitLogOutput);
        
        // Generate analysis prompt for AI
        const analysisPrompt = generateAnalysisPrompt(fileStats);
        
        if (!analysisPrompt) {
            return [];
        }

        // Use AI to analyze and select the most relevant files
        const selectedFiles = await analyzeWithAI(analysisPrompt, isNonInteractiveSession);
        
        return selectedFiles;
        
    } catch (error) {
        console.error("Error analyzing git history:", error);
        return [];
    }
}

/**
 * Check if current directory is a git repository
 * @returns {boolean} True if in git repository
 */
function isGitRepository() {
    try {
        execSync('git rev-parse --git-dir', { stdio: 'ignore' });
        return true;
    } catch (error) {
        return false;
    }
}

/**
 * Get git file modification statistics
 * @returns {string} Git log output with file statistics
 */
function getGitFileStatistics() {
    try {
        // Get detailed file modification statistics from git log
        const command = `git log --name-only --pretty=format:"%H|%an|%ae|%ad" --date=short --since="6 months ago" --no-merges`;
        const output = execSync(command, { encoding: 'utf-8', maxBuffer: 1024 * 1024 });
        return output;
    } catch (error) {
        console.error("Error getting git statistics:", error);
        return '';
    }
}

/**
 * Parse git statistics output to extract file modification data
 * @param {string} gitOutput - Raw git log output
 * @returns {Object} Parsed file statistics
 */
function parseGitStatistics(gitOutput) {
    const commits = gitOutput.split('\n\n').filter(block => block.trim());
    const fileStats = new Map();
    const userStats = new Map();
    const otherUserStats = new Map();
    
    // Get current user info
    const currentUser = getCurrentGitUser();
    
    for (const commit of commits) {
        const lines = commit.trim().split('\n');
        if (lines.length < 2) continue;
        
        const commitInfo = lines[0].split('|');
        if (commitInfo.length < 4) continue;
        
        const [hash, authorName, authorEmail, date] = commitInfo;
        const isCurrentUser = authorEmail === currentUser.email || authorName === currentUser.name;
        
        // Process files in this commit
        for (let i = 1; i < lines.length; i++) {
            const filePath = lines[i].trim();
            if (!filePath || filePath.startsWith('.git/')) continue;
            
            // Skip certain file types
            if (isIgnoredFile(filePath)) continue;
            
            // Update file statistics
            if (!fileStats.has(filePath)) {
                fileStats.set(filePath, { total: 0, byCurrentUser: 0, byOthers: 0 });
            }
            
            const stats = fileStats.get(filePath);
            stats.total++;
            
            if (isCurrentUser) {
                stats.byCurrentUser++;
                userStats.set(filePath, (userStats.get(filePath) || 0) + 1);
            } else {
                stats.byOthers++;
                otherUserStats.set(filePath, (otherUserStats.get(filePath) || 0) + 1);
            }
        }
    }
    
    return {
        fileStats,
        userStats,
        otherUserStats,
        totalFiles: fileStats.size
    };
}

/**
 * Get current git user information
 * @returns {Object} Current user name and email
 */
function getCurrentGitUser() {
    try {
        const name = execSync('git config user.name', { encoding: 'utf-8' }).trim();
        const email = execSync('git config user.email', { encoding: 'utf-8' }).trim();
        return { name, email };
    } catch (error) {
        return { name: '', email: '' };
    }
}

/**
 * Check if file should be ignored from analysis
 * @param {string} filePath - File path to check
 * @returns {boolean} True if file should be ignored
 */
function isIgnoredFile(filePath) {
    // Ignore common auto-generated and configuration files
    const ignoredPatterns = [
        /node_modules\//,
        /\.git\//,
        /\.vscode\//,
        /\.idea\//,
        /build\//,
        /dist\//,
        /target\//,
        /\.log$/,
        /\.lock$/,
        /package-lock\.json$/,
        /yarn\.lock$/,
        /\.env$/,
        /\.env\./,
        /\.DS_Store$/,
        /Thumbs\.db$/,
        /\.tmp$/,
        /\.temp$/,
        /\.cache\//,
        /\.next\//,
        /\.nuxt\//,
        /coverage\//,
        /\.nyc_output\//,
        /\.coverage\//,
        /\.pytest_cache\//,
        /__pycache__\//,
        /\.pyc$/,
        /\.class$/,
        /\.o$/,
        /\.so$/,
        /\.dll$/,
        /\.exe$/
    ];
    
    return ignoredPatterns.some(pattern => pattern.test(filePath));
}

/**
 * Generate analysis prompt for AI
 * @param {Object} fileStats - Parsed file statistics
 * @returns {string} Analysis prompt for AI
 */
function generateAnalysisPrompt(fileStats) {
    const { fileStats: files, userStats, otherUserStats } = fileStats;
    
    if (files.size === 0) {
        return '';
    }
    
    // Sort files by total modifications (descending)
    const sortedFiles = Array.from(files.entries())
        .sort((a, b) => b[1].total - a[1].total)
        .slice(0, 50); // Limit to top 50 files
    
    let prompt = "File modification statistics:\n\n";
    prompt += "Files modified by current user:\n";
    
    // Add current user files
    const userFiles = Array.from(userStats.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15);
    
    for (const [filePath, count] of userFiles) {
        prompt += `${filePath}: ${count} modifications\n`;
    }
    
    prompt += "\nFiles modified by other users:\n";
    
    // Add other user files
    const otherFiles = Array.from(otherUserStats.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15);
    
    for (const [filePath, count] of otherFiles) {
        prompt += `${filePath}: ${count} modifications\n`;
    }
    
    return prompt;
}

/**
 * Analyze files with AI to select most relevant ones
 * @param {string} prompt - Analysis prompt
 * @param {boolean} isNonInteractiveSession - Whether this is non-interactive
 * @returns {Promise<string[]>} Selected file basenames
 */
async function analyzeWithAI(prompt, isNonInteractiveSession) {
    try {
        // This would integrate with the actual AI analysis system
        // For now, we'll implement a fallback algorithm
        
        const systemPrompt = `You are an expert at analyzing git history. Given a list of files and their modification counts, return exactly five filenames that are frequently modified and represent core application logic (not auto-generated files, dependencies, or configuration). Make sure filenames are diverse, not all in the same folder, and are a mix of user and other users. Return only the filenames' basenames (without the path) separated by newlines with no explanation.`;
        
        // Use actual AI analysis if available
        const aiResponse = await callAIAnalysis({
            systemPrompt: [systemPrompt],
            userPrompt: prompt,
            isNonInteractiveSession,
            promptCategory: "frequently_modified"
        });
        
        if (!aiResponse || !aiResponse.message || !aiResponse.message.content || !aiResponse.message.content[0]) {
            return fallbackFileSelection(prompt);
        }
        
        const content = aiResponse.message.content[0];
        if (!content || content.type !== "text") {
            return fallbackFileSelection(prompt);
        }
        
        const filenames = content.text.trim().split('\n').filter(name => name.trim());
        
        if (filenames.length < 5) {
            return fallbackFileSelection(prompt);
        }
        
        return filenames.slice(0, 5);
        
    } catch (error) {
        console.error("Error in AI analysis:", error);
        return fallbackFileSelection(prompt);
    }
}

/**
 * Fallback file selection when AI is not available
 * @param {string} prompt - Analysis prompt
 * @returns {string[]} Selected file basenames
 */
function fallbackFileSelection(prompt) {
    const lines = prompt.split('\n').filter(line => line.includes(':'));
    const files = [];
    
    for (const line of lines) {
        const match = line.match(/^([^:]+):\s*(\d+)/);
        if (match) {
            const [, filePath, count] = match;
            files.push({
                path: filePath,
                basename: path.basename(filePath),
                count: parseInt(count, 10)
            });
        }
    }
    
    // Sort by modification count and diversify by directory
    files.sort((a, b) => b.count - a.count);
    
    const selected = [];
    const usedDirectories = new Set();
    const usedBasenames = new Set();
    
    for (const file of files) {
        if (selected.length >= 5) break;
        
        const directory = path.dirname(file.path);
        
        // Skip if we already have a file from this directory (unless we need more files)
        if (usedDirectories.has(directory) && selected.length < 3) continue;
        
        // Skip if we already have this basename
        if (usedBasenames.has(file.basename)) continue;
        
        // Skip obvious configuration/build files
        if (isConfigurationFile(file.basename)) continue;
        
        selected.push(file.basename);
        usedDirectories.add(directory);
        usedBasenames.add(file.basename);
    }
    
    return selected;
}

/**
 * Check if file is a configuration file
 * @param {string} basename - File basename
 * @returns {boolean} True if it's a configuration file
 */
function isConfigurationFile(basename) {
    const configPatterns = [
        /^\./, // Hidden files
        /config/i,
        /\.json$/,
        /\.yaml$/,
        /\.yml$/,
        /\.toml$/,
        /\.ini$/,
        /Makefile$/,
        /Dockerfile$/,
        /README/i,
        /LICENSE/i,
        /CHANGELOG/i
    ];
    
    return configPatterns.some(pattern => pattern.test(basename));
}

/**
 * Placeholder for actual AI analysis call
 * @param {Object} options - AI analysis options
 * @returns {Promise<Object>} AI response
 */
async function callAIAnalysis(options) {
    // This would integrate with the actual AI system
    // For now, return null to trigger fallback
    return null;
}

/**
 * Generate example commands based on frequently modified files
 * @param {boolean} isNonInteractiveSession - Whether this is non-interactive
 * @returns {Promise<string[]>} Array of example commands
 */
async function generateExampleCommands(isNonInteractiveSession = false) {
    const settings = getProjectSettings();
    const now = Date.now();
    const lastGenerated = settings.exampleFilesGeneratedAt ?? 0;
    const cacheTime = 7 * 24 * 60 * 60 * 1000; // 7 days
    
    // Use cached files if available and fresh
    if (now - lastGenerated > cacheTime) {
        settings.exampleFiles = [];
    }
    
    if (!settings.exampleFiles?.length) {
        // Generate new example files in background
        analyzeGitHistory(isNonInteractiveSession).then((files) => {
            if (files.length) {
                updateProjectSettings({
                    ...getProjectSettings(),
                    exampleFiles: files,
                    exampleFilesGeneratedAt: Date.now()
                });
            }
        }).catch(error => {
            console.error("Error generating example files:", error);
        });
    }
    
    // Get a random file from cached examples or use placeholder
    const exampleFile = settings.exampleFiles?.length 
        ? settings.exampleFiles[Math.floor(Math.random() * settings.exampleFiles.length)]
        : "<filepath>";
    
    return [
        "fix lint errors",
        "fix typecheck errors", 
        `how does ${exampleFile} work?`,
        `refactor ${exampleFile}`,
        "how do I log an error?",
        `edit ${exampleFile} to...`,
        `write a test for ${exampleFile}`,
        "create a util logging.py that..."
    ];
}

/**
 * Get project settings (placeholder)
 * @returns {Object} Project settings
 */
function getProjectSettings() {
    // Placeholder - would integrate with actual settings system
    return {
        exampleFiles: [],
        exampleFilesGeneratedAt: 0
    };
}

/**
 * Update project settings (placeholder)
 * @param {Object} settings - Settings to update
 */
function updateProjectSettings(settings) {
    // Placeholder - would integrate with actual settings system
    console.log("Updating project settings:", settings);
}

module.exports = {
    analyzeGitHistory,
    generateExampleCommands,
    isGitRepository,
    getGitFileStatistics,
    parseGitStatistics,
    getCurrentGitUser,
    isIgnoredFile,
    fallbackFileSelection
};