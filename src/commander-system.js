/**
 * Commander CLI Framework System
 * 
 * 517-536行から復元したCommander CLIフレームワーク
 * - Commander.js CLIフレームワーク機能
 * - オプション処理・バリデーション・競合チェック
 * - サブコマンド実行・派遣・管理
 * - 引数解析・処理・必須チェック
 * - エラーハンドリング・メッセージ表示
 * - ヘルプ表示・バージョン表示・使用法
 * - 環境変数からのオプション読み込み
 * - 不明オプション・コマンドの処理
 * - スクリプトパス・実行ディレクトリ管理
 * - コマンドエイリアス・説明・要約設定
 */

import { EventEmitter } from "events";
import { spawn } from "child_process";
import { existsSync, realpathSync } from "fs";
import path from "path";
import process from "process";

/**
 * Commander エラークラス
 */
export class CommanderError extends Error {
    code;
    exitCode;
    nestedError;

    constructor(exitCode, code, message) {
        super(message);
        this.name = "CommanderError";
        this.code = code;
        this.exitCode = exitCode;
    }
}

/**
 * Commander オプションクラス
 */
export class Option {
    flags;
    description;
    required;
    optional;
    variadic;
    mandatory;
    defaultValue;
    choices;
    argParser;
    conflictsWith = [];
    implies = {};
    envVar;
    presetArg;
    negate;

    constructor(flags, description) {
        this.flags = flags;
        this.description = description;
        this.parseFlags();
    }

    parseFlags() {
        // フラグの解析（-v, --verbose など）
        const flagParts = this.flags.split(/[, ]+/);
        this.short = flagParts.find(flag => flag.match(/^-\w$/));
        this.long = flagParts.find(flag => flag.match(/^--[\w-]+/));
        
        // 引数の種類を判定
        if (this.flags.includes('<')) {
            this.required = true;
        } else if (this.flags.includes('[')) {
            this.optional = true;
        }
        
        // 可変引数
        if (this.flags.includes('...')) {
            this.variadic = true;
        }
        
        // 否定オプション
        if (this.long && this.long.startsWith('--no-')) {
            this.negate = true;
        }
    }

    name() {
        return this.long ? this.long.replace(/^--/, '') : this.short?.replace(/^-/, '');
    }

    attributeName() {
        return this.name()?.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    }

    is(flag) {
        return flag === this.short || flag === this.long;
    }

    makeOptionMandatory(mandatory = true) {
        this.mandatory = mandatory;
        return this;
    }

    default(value) {
        this.defaultValue = value;
        return this;
    }

    argParser(parser) {
        this.argParser = parser;
        return this;
    }

    choices(choices) {
        this.choices = choices;
        return this;
    }

    conflicts(option) {
        this.conflictsWith.push(option);
        return this;
    }

    implies(option, value) {
        this.implies[option] = value;
        return this;
    }

    env(name) {
        this.envVar = name;
        return this;
    }

    preset(value) {
        this.presetArg = value;
        return this;
    }

    isBoolean() {
        return !this.required && !this.optional;
    }

    _concatValue(value, previous) {
        if (previous && Array.isArray(previous)) {
            return previous.concat(value);
        }
        return [].concat(previous || []).concat(value);
    }
}

/**
 * Commander 引数クラス
 */
export class Argument {
    name;
    description;
    required;
    variadic;
    defaultValue;
    choices;
    argParser;

    constructor(name, description) {
        this.name = name;
        this.description = description;
        this.parseArgumentName();
    }

    parseArgumentName() {
        if (this.name.startsWith('<') && this.name.endsWith('>')) {
            this.required = true;
            this.name = this.name.slice(1, -1);
        } else if (this.name.startsWith('[') && this.name.endsWith(']')) {
            this.required = false;
            this.name = this.name.slice(1, -1);
        }
        
        if (this.name.endsWith('...')) {
            this.variadic = true;
            this.name = this.name.slice(0, -3);
        }
    }

    default(value) {
        this.defaultValue = value;
        return this;
    }

    argParser(parser) {
        this.argParser = parser;
        return this;
    }

    choices(choices) {
        this.choices = choices;
        return this;
    }
}

/**
 * Commander コマンドクラス
 */
export class Command extends EventEmitter {
    _name = "";
    _aliases = [];
    _description = "";
    _summary = "";
    _usage = "";
    _version = "";
    _versionOptionName = "";
    
    options = [];
    commands = [];
    registeredArguments = [];
    
    parent = null;
    _executableDir = "";
    _executableFile = "";
    _executableHandler = false;
    _defaultCommandName = "";
    _actionHandler = null;
    _helpOption = undefined;
    
    _allowUnknownOption = false;
    _allowExcessArguments = false;
    _enablePositionalOptions = false;
    _passThroughOptions = false;
    _combineFlagAndOptionalValue = false;
    _storeOptionsAsProperties = false;
    _showHelpAfterError = false;
    _showSuggestionAfterError = true;
    
    _optionValues = {};
    _optionValueSources = {};
    _lifeCycleHooks = {};
    
    rawArgs = [];
    args = [];
    processedArgs = [];
    
    _scriptPath = "";
    _outputConfiguration = {
        writeOut: (str) => process.stdout.write(str),
        writeErr: (str) => process.stderr.write(str),
        getOutHelpWidth: () => process.stdout.columns || 80,
        getErrHelpWidth: () => process.stderr.columns || 80,
        outputError: (str, write) => write(str)
    };
    _exitCallback = null;
    runningCommand = null;

    constructor(name) {
        super();
        this._name = name || "";
    }

    // オプション登録
    createOption(flags, description) {
        return new Option(flags, description);
    }

    _registerOption(option) {
        const conflictingFlag = this.options.find(existingOption => {
            return option.flags === existingOption.flags;
        });
        
        if (conflictingFlag) {
            throw new Error(`Cannot add option '${option.flags}' - already used by option '${conflictingFlag.flags}'`);
        }
        
        this.options.push(option);
    }

    addOption(option) {
        this._registerOption(option);
        
        const name = option.name();
        const attributeName = option.attributeName();
        
        // 否定オプションの処理
        if (option.negate) {
            const positiveFlag = option.long.replace(/^--no-/, '--');
            if (!this._findOption(positiveFlag)) {
                this.setOptionValueWithSource(attributeName, 
                    option.defaultValue === undefined ? true : option.defaultValue, 
                    "default");
            }
        } else if (option.defaultValue !== undefined) {
            this.setOptionValueWithSource(attributeName, option.defaultValue, "default");
        }
        
        // オプションハンドラーの設定
        const optionHandler = (value, previous, source) => {
            if (value == null && option.presetArg !== undefined) {
                value = option.presetArg;
            }
            
            const existingValue = this.getOptionValue(attributeName);
            
            if (value !== null && option.argParser) {
                value = this._callParseArg(option, value, existingValue, `error: option '${option.flags}' argument '${value}' is invalid.`);
            } else if (value !== null && option.variadic) {
                value = option._concatValue(value, existingValue);
            }
            
            if (value == null) {
                if (option.negate) {
                    value = false;
                } else if (option.isBoolean() || option.optional) {
                    value = true;
                } else {
                    value = "";
                }
            }
            
            this.setOptionValueWithSource(attributeName, value, source);
        };
        
        this.on(`option:${name}`, (value) => {
            optionHandler(value, `error: option '${option.flags}' argument '${value}' is invalid.`, "cli");
        });
        
        // 環境変数からの読み込み
        if (option.envVar) {
            this.on(`optionEnv:${name}`, (value) => {
                optionHandler(value, `error: option '${option.flags}' value '${value}' from env '${option.envVar}' is invalid.`, "env");
            });
        }
        
        return this;
    }

    option(flags, description, defaultValue, parser) {
        return this._optionEx({}, flags, description, defaultValue, parser);
    }

    requiredOption(flags, description, defaultValue, parser) {
        return this._optionEx({mandatory: true}, flags, description, defaultValue, parser);
    }

    _optionEx(config, flags, description, defaultValue, parser) {
        if (typeof description === "object" && description instanceof Option) {
            throw new Error("To add an Option object use addOption() instead of option() or requiredOption()");
        }
        
        const option = this.createOption(flags, description);
        option.makeOptionMandatory(!!config.mandatory);
        
        if (typeof defaultValue === "function") {
            option.default(parser).argParser(defaultValue);
        } else if (defaultValue instanceof RegExp) {
            const regex = defaultValue;
            defaultValue = (value, previous) => {
                const match = regex.exec(value);
                return match ? match[0] : previous;
            };
            option.default(parser).argParser(defaultValue);
        } else {
            option.default(defaultValue);
        }
        
        return this.addOption(option);
    }

    // 引数登録
    createArgument(name, description) {
        return new Argument(name, description);
    }

    argument(name, description, defaultValue, parser) {
        const argument = this.createArgument(name, description);
        
        if (typeof defaultValue === "function") {
            argument.default(parser).argParser(defaultValue);
        } else {
            argument.default(defaultValue);
        }
        
        this.registeredArguments.push(argument);
        return this;
    }

    // コマンド登録
    _registerCommand(command) {
        const nameAndAliases = (cmd) => [cmd.name()].concat(cmd.aliases());
        const existingCommandName = nameAndAliases(command).find(name => this._findCommand(name));
        
        if (existingCommandName) {
            const existingCommand = this._findCommand(existingCommandName);
            const existingNames = nameAndAliases(existingCommand).join("|");
            const newNames = nameAndAliases(command).join("|");
            throw new Error(`cannot add command '${newNames}' as already have command '${existingNames}'`);
        }
        
        this.commands.push(command);
    }

    command(nameAndArgs, description, options) {
        let desc = description;
        let opts = options || {};
        
        if (typeof description === "object") {
            opts = description;
            desc = opts.description;
        }
        
        const [, name, args] = nameAndArgs.match(/([^ ]+) *(.*)/);
        const command = new Command(name);
        command.parent = this;
        
        if (desc) {
            command.description(desc);
            command._executableHandler = true;
        }
        
        if (opts.executableFile) {
            command._executableFile = opts.executableFile;
        }
        
        if (args) {
            command._parseArguments(args.split(/ +/));
        }
        
        this._registerCommand(command);
        return command;
    }

    // オプション値管理
    getOptionValue(key) {
        if (this._storeOptionsAsProperties) {
            return this[key];
        }
        return this._optionValues[key];
    }

    setOptionValue(key, value) {
        return this.setOptionValueWithSource(key, value, undefined);
    }

    setOptionValueWithSource(key, value, source) {
        if (this._storeOptionsAsProperties) {
            this[key] = value;
        } else {
            this._optionValues[key] = value;
        }
        this._optionValueSources[key] = source;
        return this;
    }

    getOptionValueSource(key) {
        return this._optionValueSources[key];
    }

    // 引数準備
    _prepareUserArgs(argv, parseOptions) {
        if (argv !== undefined && !Array.isArray(argv)) {
            throw new Error("first parameter to parse must be array or undefined");
        }
        
        parseOptions = parseOptions || {};
        
        if (argv === undefined && parseOptions.from === undefined) {
            // Electron 環境の検出
            if (process.versions?.electron) {
                parseOptions.from = "electron";
            }
            
            const execArgv = process.execArgv ?? [];
            if (execArgv.includes("-e") || execArgv.includes("--eval") || 
                execArgv.includes("-p") || execArgv.includes("--print")) {
                parseOptions.from = "eval";
            }
        }
        
        if (argv === undefined) {
            argv = process.argv;
        }
        
        this.rawArgs = argv.slice();
        
        let userArgs;
        switch (parseOptions.from) {
            case undefined:
            case "node":
                this._scriptPath = argv[1];
                userArgs = argv.slice(2);
                break;
            case "electron":
                if (process.defaultApp) {
                    this._scriptPath = argv[1];
                    userArgs = argv.slice(2);
                } else {
                    userArgs = argv.slice(1);
                }
                break;
            case "user":
                userArgs = argv.slice(0);
                break;
            case "eval":
                userArgs = argv.slice(1);
                break;
            default:
                throw new Error(`unexpected parse option { from: '${parseOptions.from}' }`);
        }
        
        if (!this._name && this._scriptPath) {
            this.nameFromFilename(this._scriptPath);
        }
        
        this._name = this._name || "program";
        
        return userArgs;
    }

    // パース処理
    parse(argv, parseOptions) {
        const userArgs = this._prepareUserArgs(argv, parseOptions);
        this._parseCommand([], userArgs);
        return this;
    }

    async parseAsync(argv, parseOptions) {
        const userArgs = this._prepareUserArgs(argv, parseOptions);
        await this._parseCommand([], userArgs);
        return this;
    }

    // オプション解析
    parseOptions(argv) {
        const operands = [];
        const unknown = [];
        let destination = operands;
        const args = argv.slice();

        function isOption(arg) {
            return arg.length > 1 && arg[0] === "-";
        }

        let activeVariadicOption = null;
        
        while (args.length) {
            const arg = args.shift();
            
            if (arg === "--") {
                if (destination === unknown) destination.push(arg);
                destination.push(...args);
                break;
            }
            
            if (activeVariadicOption && !isOption(arg)) {
                this.emit(`option:${activeVariadicOption.name()}`, arg);
                continue;
            }
            
            activeVariadicOption = null;
            
            if (isOption(arg)) {
                const option = this._findOption(arg);
                if (option) {
                    if (option.required) {
                        const optionArg = args.shift();
                        if (optionArg === undefined) {
                            this.optionMissingArgument(option);
                        }
                        this.emit(`option:${option.name()}`, optionArg);
                    } else if (option.optional) {
                        let optionArg = null;
                        if (args.length > 0 && !isOption(args[0])) {
                            optionArg = args.shift();
                        }
                        this.emit(`option:${option.name()}`, optionArg);
                    } else {
                        this.emit(`option:${option.name()}`);
                    }
                    
                    activeVariadicOption = option.variadic ? option : null;
                    continue;
                }
            }
            
            // 結合されたショートオプション (-abc)
            if (arg.length > 2 && arg[0] === "-" && arg[1] !== "-") {
                const option = this._findOption(`-${arg[1]}`);
                if (option) {
                    if (option.required || (option.optional && this._combineFlagAndOptionalValue)) {
                        this.emit(`option:${option.name()}`, arg.slice(2));
                    } else {
                        this.emit(`option:${option.name()}`);
                        args.unshift(`-${arg.slice(2)}`);
                    }
                    continue;
                }
            }
            
            // 結合された長いオプション (--option=value)
            if (/^--[^=]+=/.test(arg)) {
                const equalIndex = arg.indexOf("=");
                const option = this._findOption(arg.slice(0, equalIndex));
                if (option && (option.required || option.optional)) {
                    this.emit(`option:${option.name()}`, arg.slice(equalIndex + 1));
                    continue;
                }
            }
            
            if (isOption(arg)) {
                destination = unknown;
            }
            
            // 位置オプションまたはパススルーの処理
            if ((this._enablePositionalOptions || this._passThroughOptions) && 
                operands.length === 0 && unknown.length === 0) {
                if (this._findCommand(arg)) {
                    operands.push(arg);
                    if (args.length > 0) {
                        unknown.push(...args);
                    }
                    break;
                } else if (this._getHelpCommand() && arg === this._getHelpCommand().name()) {
                    operands.push(arg);
                    if (args.length > 0) {
                        operands.push(...args);
                    }
                    break;
                } else if (this._defaultCommandName) {
                    unknown.push(arg);
                    if (args.length > 0) {
                        unknown.push(...args);
                    }
                    break;
                }
            }
            
            if (this._passThroughOptions) {
                destination.push(arg);
                if (args.length > 0) {
                    destination.push(...args);
                }
                break;
            }
            
            destination.push(arg);
        }
        
        return { operands, unknown };
    }

    // エラーハンドリング
    error(message, errorOptions) {
        this._outputConfiguration.outputError(`${message}\n`, this._outputConfiguration.writeErr);
        
        if (typeof this._showHelpAfterError === "string") {
            this._outputConfiguration.writeErr(`${this._showHelpAfterError}\n`);
        } else if (this._showHelpAfterError) {
            this.outputHelp({ error: true });
        }
        
        const config = errorOptions || {};
        const exitCode = config.exitCode || 1;
        const code = config.code || "commander.error";
        this._exit(exitCode, code, message);
    }

    // 環境変数からオプション解析
    _parseOptionsEnv() {
        this.options.forEach((option) => {
            if (option.envVar && option.envVar in process.env) {
                const attributeName = option.attributeName();
                if (this.getOptionValue(attributeName) === undefined || 
                    ["default", "config", "env"].includes(this.getOptionValueSource(attributeName))) {
                    if (option.required || option.optional) {
                        this.emit(`optionEnv:${option.name()}`, process.env[option.envVar]);
                    } else {
                        this.emit(`optionEnv:${option.name()}`);
                    }
                }
            }
        });
    }

    // ヘルプ関連
    version(version, flags, description) {
        if (version === undefined) return this._version;
        
        this._version = version;
        flags = flags || "-V, --version";
        description = description || "output the version number";
        
        const versionOption = this.createOption(flags, description);
        this._versionOptionName = versionOption.attributeName();
        this._registerOption(versionOption);
        
        this.on(`option:${versionOption.name()}`, () => {
            this._outputConfiguration.writeOut(`${version}\n`);
            this._exit(0, "commander.version", version);
        });
        
        return this;
    }

    description(desc, argsDescription) {
        if (desc === undefined && argsDescription === undefined) {
            return this._description;
        }
        
        this._description = desc;
        if (argsDescription) {
            this._argsDescription = argsDescription;
        }
        return this;
    }

    summary(summary) {
        if (summary === undefined) return this._summary;
        this._summary = summary;
        return this;
    }

    alias(alias) {
        if (alias === undefined) return this._aliases[0];
        
        let command = this;
        if (this.commands.length !== 0 && 
            this.commands[this.commands.length - 1]._executableHandler) {
            command = this.commands[this.commands.length - 1];
        }
        
        if (alias === command._name) {
            throw new Error("Command alias can't be the same as its name");
        }
        
        const existingCommand = this.parent?._findCommand(alias);
        if (existingCommand) {
            const existingNames = [existingCommand.name()].concat(existingCommand.aliases()).join("|");
            throw new Error(`cannot add alias '${alias}' to command '${this.name()}' as already have command '${existingNames}'`);
        }
        
        command._aliases.push(alias);
        return this;
    }

    aliases(aliases) {
        if (aliases === undefined) return this._aliases;
        aliases.forEach(alias => this.alias(alias));
        return this;
    }

    usage(usage) {
        if (usage === undefined) {
            if (this._usage) return this._usage;
            
            const args = this.registeredArguments.map(arg => {
                return this._formatArgumentUsage(arg);
            });
            
            return [].concat(
                this.options.length || this._helpOption !== null ? ["[options]"] : [],
                this.commands.length ? ["[command]"] : [],
                this.registeredArguments.length ? args : []
            ).join(" ");
        }
        
        this._usage = usage;
        return this;
    }

    name(name) {
        if (name === undefined) return this._name;
        this._name = name;
        return this;
    }

    nameFromFilename(filename) {
        this._name = path.basename(filename, path.extname(filename));
        return this;
    }

    executableDir(dir) {
        if (dir === undefined) return this._executableDir;
        this._executableDir = dir;
        return this;
    }

    // ヘルパーメソッド
    _findCommand(name) {
        if (!name) return;
        return this.commands.find(command => 
            command._name === name || command._aliases.includes(name));
    }

    _findOption(flag) {
        return this.options.find(option => option.is(flag));
    }

    _formatArgumentUsage(argument) {
        let usage = argument.name;
        if (argument.variadic) {
            usage += "...";
        }
        if (argument.required) {
            return `<${usage}>`;
        }
        return `[${usage}]`;
    }

    _callParseArg(option, value, previous, errorMessage) {
        try {
            return option.argParser(value, previous);
        } catch (error) {
            if (error.code === "commander.invalidArgument") {
                const message = `${errorMessage} ${error.message}`;
                this.error(message, { code: error.code });
            }
            throw error;
        }
    }

    _exit(exitCode, code, message) {
        if (this._exitCallback) {
            this._exitCallback(new CommanderError(exitCode, code, message));
            return;
        }
        if (code === "commander.executeSubCommandAsync") {
            this._exitCallback = null;
        }
        process.exit(exitCode);
    }

    _getCommandAndAncestors() {
        const commands = [];
        let command = this;
        while (command) {
            commands.push(command);
            command = command.parent;
        }
        return commands;
    }

    _getHelpCommand() {
        return this.commands.find(command => command._name === "help");
    }

    // Action設定
    action(actionHandler) {
        this._actionHandler = actionHandler;
        return this;
    }

    // 設定メソッド
    allowUnknownOption(allowUnknown = true) {
        this._allowUnknownOption = !!allowUnknown;
        return this;
    }

    allowExcessArguments(allowExcess = true) {
        this._allowExcessArguments = !!allowExcess;
        return this;
    }

    enablePositionalOptions(enable = true) {
        this._enablePositionalOptions = !!enable;
        return this;
    }

    passThroughOptions(passThrough = true) {
        this._passThroughOptions = !!passThrough;
        this._checkForBrokenPassThrough();
        return this;
    }

    _checkForBrokenPassThrough() {
        if (this.parent && this._passThroughOptions && !this.parent._enablePositionalOptions) {
            throw new Error(`passThroughOptions cannot be used for '${this._name}' without turning on enablePositionalOptions for parent command(s)`);
        }
    }

    combineFlagAndOptionalValue(combine = true) {
        this._combineFlagAndOptionalValue = !!combine;
        return this;
    }

    storeOptionsAsProperties(store = true) {
        if (this.options.length) {
            throw new Error("call .storeOptionsAsProperties() before adding options");
        }
        if (Object.keys(this._optionValues).length) {
            throw new Error("call .storeOptionsAsProperties() before setting option values");
        }
        this._storeOptionsAsProperties = !!store;
        return this;
    }

    // エラーハンドリングメソッド
    missingArgument(name) {
        const message = `error: missing required argument '${name}'`;
        this.error(message, { code: "commander.missingArgument" });
    }

    optionMissingArgument(option) {
        const message = `error: option '${option.flags}' argument missing`;
        this.error(message, { code: "commander.optionMissingArgument" });
    }

    missingMandatoryOptionValue(option) {
        const message = `error: required option '${option.flags}' not specified`;
        this.error(message, { code: "commander.missingMandatoryOptionValue" });
    }

    unknownOption(flag) {
        if (this._allowUnknownOption) return;
        
        let suggestion = "";
        if (flag.startsWith("--") && this._showSuggestionAfterError) {
            // 類似オプション提案の実装は簡略化
            suggestion = "";
        }
        
        const message = `error: unknown option '${flag}'${suggestion}`;
        this.error(message, { code: "commander.unknownOption" });
    }

    unknownCommand() {
        const name = this.args[0];
        let suggestion = "";
        
        if (this._showSuggestionAfterError) {
            // 類似コマンド提案の実装は簡略化
            suggestion = "";
        }
        
        const message = `error: unknown command '${name}'${suggestion}`;
        this.error(message, { code: "commander.unknownCommand" });
    }
}

// デフォルトプログラムインスタンス
export const program = new Command();

// デフォルトエクスポート
export default {
    Command,
    Option,
    Argument,
    CommanderError,
    program
};