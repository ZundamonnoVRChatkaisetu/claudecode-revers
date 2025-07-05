/**
 * Response Quality Manager
 * 
 * 解析対象行: 1157-1166
 * 主な機能: 応答品質管理、簡潔性ガイドライン、CLIインターフェース最適化
 */

class ResponseQualityManager {
    constructor() {
        this.guidelineConfig = {
            maxLines: 4,
            preferSingleWord: true,
            excludeToolUsage: true,
            excludeCodeGeneration: true,
            enableDetailOnRequest: true
        };
        
        this.avoidPatterns = new Set([
            'The answer is',
            'Here is the content of the file',
            'Based on the information provided',
            'Here is what I will do next',
            'Let me',
            'I will',
            'According to',
            'As you can see',
            'In summary',
            'To summarize',
            'In conclusion'
        ]);
        
        this.initializeExamples();
        this.initializeResponsePatterns();
    }

    /**
     * 数学的計算例の初期化
     */
    initializeExamples() {
        this.mathematicalExamples = new Map([
            ['2 + 2', '4'],
            ['what is 2+2?', '4'],
            ['2+2', '4'],
            ['calculate 2 plus 2', '4']
        ]);
        
        this.directAnswerExamples = new Map([
            ['user: 2 + 2', 'assistant: 4'],
            ['user: what is 2+2?', 'assistant: 4']
        ]);
    }

    /**
     * 応答パターンの初期化
     */
    initializeResponsePatterns() {
        this.responsePatterns = {
            mathematical: {
                pattern: /^[\d\s\+\-\*\/\(\)\.]+[\?]?$/,
                handler: this.handleMathematical.bind(this)
            },
            command: {
                pattern: /what command.*\?$/i,
                handler: this.handleCommand.bind(this)
            },
            boolean: {
                pattern: /(is|are|can|does|will).*\?$/i,
                handler: this.handleBoolean.bind(this)
            },
            estimation: {
                pattern: /(how many|how much).*\?$/i,
                handler: this.handleEstimation.bind(this)
            }
        };
    }

    /**
     * 応答長度チェック機能
     */
    checkResponseLength(response, excludePatterns = ['```', '<']) {
        if (!response || typeof response !== 'string') {
            return { valid: false, reason: 'Invalid response' };
        }

        const lines = response.split('\n');
        let contentLines = 0;

        for (let line of lines) {
            const trimmedLine = line.trim();
            
            // 除外パターンをチェック
            let shouldExclude = false;
            for (let pattern of excludePatterns) {
                if (trimmedLine.includes(pattern)) {
                    shouldExclude = true;
                    break;
                }
            }
            
            if (!shouldExclude && trimmedLine.length > 0) {
                contentLines++;
            }
        }

        const isValid = contentLines <= this.guidelineConfig.maxLines;
        
        return {
            valid: isValid,
            contentLines,
            maxAllowed: this.guidelineConfig.maxLines,
            reason: isValid ? 'Valid length' : `Exceeds ${this.guidelineConfig.maxLines} line limit`
        };
    }

    /**
     * 不要表現検出・除去機能
     */
    detectAvoidPatterns(response) {
        const detected = [];
        const lowerResponse = response.toLowerCase();
        
        for (let pattern of this.avoidPatterns) {
            if (lowerResponse.includes(pattern.toLowerCase())) {
                detected.push(pattern);
            }
        }
        
        return {
            hasAvoidPatterns: detected.length > 0,
            detectedPatterns: detected,
            cleanResponse: this.removeAvoidPatterns(response)
        };
    }

    /**
     * 不要表現の除去
     */
    removeAvoidPatterns(response) {
        let cleanedResponse = response;
        
        for (let pattern of this.avoidPatterns) {
            const regex = new RegExp(pattern, 'gi');
            cleanedResponse = cleanedResponse.replace(regex, '').trim();
        }
        
        // 余分な空白や句読点の整理
        cleanedResponse = cleanedResponse
            .replace(/^[,.\s]+/, '')  // 先頭の句読点と空白除去
            .replace(/[,.\s]+$/, '')  // 末尾の句読点と空白除去
            .replace(/\s+/g, ' ');    // 複数空白を単一空白に
            
        return cleanedResponse;
    }

    /**
     * 簡潔性評価システム
     */
    evaluateConciseness(response) {
        const wordCount = response.trim().split(/\s+/).length;
        const characterCount = response.trim().length;
        
        let score = 100;
        let feedback = [];
        
        // 一語回答の評価
        if (wordCount === 1) {
            score += 20;
            feedback.push('Excellent: Single word answer');
        } else if (wordCount <= 3) {
            score += 10;
            feedback.push('Good: Very concise');
        } else if (wordCount <= 5) {
            feedback.push('Fair: Moderately concise');
        } else {
            score -= (wordCount - 5) * 5;
            feedback.push('Consider shortening');
        }
        
        // 不要表現の評価
        const avoidCheck = this.detectAvoidPatterns(response);
        if (avoidCheck.hasAvoidPatterns) {
            score -= avoidCheck.detectedPatterns.length * 15;
            feedback.push(`Remove: ${avoidCheck.detectedPatterns.join(', ')}`);
        }
        
        // 行数の評価
        const lengthCheck = this.checkResponseLength(response);
        if (!lengthCheck.valid) {
            score -= (lengthCheck.contentLines - lengthCheck.maxAllowed) * 10;
            feedback.push(`Reduce lines: ${lengthCheck.contentLines}/${lengthCheck.maxAllowed}`);
        }
        
        return {
            score: Math.max(0, score),
            wordCount,
            characterCount,
            feedback,
            grade: this.getGrade(score)
        };
    }

    /**
     * グレード判定
     */
    getGrade(score) {
        if (score >= 120) return 'A+';
        if (score >= 100) return 'A';
        if (score >= 80) return 'B';
        if (score >= 60) return 'C';
        if (score >= 40) return 'D';
        return 'F';
    }

    /**
     * 数学的質問への応答処理
     */
    handleMathematical(question) {
        // 簡単な算術計算の処理
        try {
            const cleaned = question.replace(/[^\d\+\-\*\/\(\)\.\s]/g, '');
            if (cleaned.trim()) {
                // 基本的な計算例への対応
                if (this.mathematicalExamples.has(question.trim())) {
                    return this.mathematicalExamples.get(question.trim());
                }
            }
        } catch (error) {
            // 計算エラーの場合は通常処理
        }
        
        return null; // 他の処理に委ねる
    }

    /**
     * コマンド質問への応答処理
     */
    handleCommand(question) {
        const lowerQuestion = question.toLowerCase();
        
        if (lowerQuestion.includes('list files')) {
            return 'ls';
        }
        if (lowerQuestion.includes('watch files')) {
            return 'npm run dev';
        }
        if (lowerQuestion.includes('current directory')) {
            return 'pwd';
        }
        
        return null;
    }

    /**
     * 真偽値質問への応答処理
     */
    handleBoolean(question) {
        const lowerQuestion = question.toLowerCase();
        
        if (lowerQuestion.includes('prime number') && lowerQuestion.includes('11')) {
            return 'Yes';
        }
        
        return null;
    }

    /**
     * 推定質問への応答処理
     */
    handleEstimation(question) {
        const lowerQuestion = question.toLowerCase();
        
        if (lowerQuestion.includes('golf balls') && lowerQuestion.includes('jetta')) {
            return '150000';
        }
        
        return null;
    }

    /**
     * CLIインターフェース最適化
     */
    optimizeForCLI(response, userRequest = '') {
        // 詳細要求の検出
        const detailRequested = /detail|explain|elaborate|describe|tell me more/i.test(userRequest);
        
        if (detailRequested) {
            // 詳細要求時は制限緩和
            return {
                optimized: response,
                applied: false,
                reason: 'Detail requested by user'
            };
        }
        
        // パターンマッチによる最適化
        for (let [patternName, patternConfig] of Object.entries(this.responsePatterns)) {
            if (patternConfig.pattern.test(userRequest)) {
                const optimizedResponse = patternConfig.handler(userRequest);
                if (optimizedResponse) {
                    return {
                        optimized: optimizedResponse,
                        applied: true,
                        pattern: patternName,
                        reason: `Matched ${patternName} pattern`
                    };
                }
            }
        }
        
        // 一般的な最適化
        const avoidCheck = this.detectAvoidPatterns(response);
        const lengthCheck = this.checkResponseLength(response);
        
        let optimized = avoidCheck.cleanResponse || response;
        
        // 簡潔化処理
        if (!lengthCheck.valid) {
            optimized = this.simplifyResponse(optimized);
        }
        
        return {
            optimized,
            applied: optimized !== response,
            reason: 'General optimization applied',
            improvements: {
                removedPatterns: avoidCheck.detectedPatterns,
                lengthReduced: response.length - optimized.length
            }
        };
    }

    /**
     * 応答の簡潔化処理
     */
    simplifyResponse(response) {
        // 複数文の場合は最も重要な部分を抽出
        const sentences = response.split(/[.!?]+/).filter(s => s.trim());
        
        if (sentences.length > 1) {
            // 最短で意味のある文を選択
            return sentences.reduce((shortest, current) => 
                current.trim().length < shortest.trim().length ? current.trim() : shortest
            );
        }
        
        return response.trim();
    }

    /**
     * ガイドライン遵守チェック
     */
    checkCompliance(response, userRequest = '') {
        const lengthCheck = this.checkResponseLength(response);
        const avoidCheck = this.detectAvoidPatterns(response);
        const conciseEval = this.evaluateConciseness(response);
        
        const compliance = {
            overall: true,
            score: conciseEval.score,
            checks: {
                length: lengthCheck,
                avoidPatterns: avoidCheck,
                conciseness: conciseEval
            },
            recommendations: []
        };
        
        if (!lengthCheck.valid) {
            compliance.overall = false;
            compliance.recommendations.push('Reduce response length');
        }
        
        if (avoidCheck.hasAvoidPatterns) {
            compliance.overall = false;
            compliance.recommendations.push('Remove unnecessary introductions');
        }
        
        if (conciseEval.score < 60) {
            compliance.overall = false;
            compliance.recommendations.push('Improve conciseness');
        }
        
        return compliance;
    }

    /**
     * 応答品質レポート生成
     */
    generateQualityReport(response, userRequest = '') {
        const compliance = this.checkCompliance(response, userRequest);
        const optimization = this.optimizeForCLI(response, userRequest);
        
        return {
            original: response,
            optimized: optimization.optimized,
            compliance,
            optimization,
            recommendations: compliance.recommendations,
            summary: {
                grade: compliance.checks.conciseness.grade,
                score: compliance.score,
                improvementNeeded: !compliance.overall
            }
        };
    }
}

// エクスポートとユーティリティ関数
const responseQualityManager = new ResponseQualityManager();

/**
 * ファクトリー関数: 応答品質チェック
 */
function checkResponseQuality(response, userRequest = '') {
    return responseQualityManager.checkCompliance(response, userRequest);
}

/**
 * ファクトリー関数: CLI最適化
 */
function optimizeForCLI(response, userRequest = '') {
    return responseQualityManager.optimizeForCLI(response, userRequest);
}

/**
 * ファクトリー関数: 簡潔性評価
 */
function evaluateConciseness(response) {
    return responseQualityManager.evaluateConciseness(response);
}

/**
 * ファクトリー関数: 品質レポート生成
 */
function generateQualityReport(response, userRequest = '') {
    return responseQualityManager.generateQualityReport(response, userRequest);
}

module.exports = {
    ResponseQualityManager,
    responseQualityManager,
    checkResponseQuality,
    optimizeForCLI,
    evaluateConciseness,
    generateQualityReport
};

// 直接アクセス可能なエクスポート
module.exports.checkResponseQuality = checkResponseQuality;
module.exports.optimizeForCLI = optimizeForCLI;
module.exports.evaluateConciseness = evaluateConciseness;
module.exports.generateQualityReport = generateQualityReport;