/**
 * Language Definitions System
 * Comprehensive language definitions for syntax highlighting
 */

const { patternToString, lookahead, concat, either, wordBoundary } = require('./syntax-highlighter');

/**
 * Language Definition Registry
 */
class LanguageDefinitions {
    constructor() {
        this.definitions = new Map();
        this.initializeBuiltInLanguages();
    }

    /**
     * Initialize built-in language definitions
     */
    initializeBuiltInLanguages() {
        // Register core languages
        this.register('swift', this.createSwiftDefinition());
        this.register('javascript', this.createJavaScriptDefinition());
        this.register('typescript', this.createTypeScriptDefinition());
        this.register('yaml', this.createYAMLDefinition());
        this.register('tap', this.createTAPDefinition());
        this.register('tcl', this.createTclDefinition());
        this.register('thrift', this.createThriftDefinition());
        this.register('verilog', this.createVerilogDefinition());
        this.register('vala', this.createValaDefinition());
        this.register('vb', this.createVBNetDefinition());
        this.register('vbscript', this.createVBScriptDefinition());
        this.register('twig', this.createTwigDefinition());
    }

    /**
     * Register a language definition
     */
    register(name, definition) {
        this.definitions.set(name, definition);
        
        // Register aliases
        if (definition.aliases) {
            for (const alias of definition.aliases) {
                this.definitions.set(alias, definition);
            }
        }
    }

    /**
     * Get language definition
     */
    get(name) {
        return this.definitions.get(name.toLowerCase());
    }

    /**
     * List all available languages
     */
    list() {
        const languages = new Set();
        for (const [name, definition] of this.definitions) {
            languages.add(definition.name || name);
        }
        return Array.from(languages);
    }

    /**
     * Create Swift language definition
     */
    createSwiftDefinition() {
        const protocolTypes = ["Protocol", "Type"].map(wordBoundary);
        const initSelfKeywords = ["init", "self"].map(wordBoundary);
        const anyTypes = ["Any", "Self"];
        
        const keywords = [
            "associatedtype", "async", "await", /as\?/, /as!/, "as", "break", "case", "catch", "class", 
            "continue", "convenience", "default", "defer", "deinit", "didSet", "do", "dynamic", "else", 
            "enum", "extension", "fallthrough", /fileprivate\(set\)/, "fileprivate", "final", "for", 
            "func", "get", "guard", "if", "import", "indirect", "infix", /init\?/, /init!/, "inout", 
            /internal\(set\)/, "internal", "in", "is", "lazy", "let", "mutating", "nonmutating", 
            /open\(set\)/, "open", "operator", "optional", "override", "postfix", "precedencegroup", 
            "prefix", /private\(set\)/, "private", "protocol", /public\(set\)/, "public", "repeat", 
            "required", "rethrows", "return", "set", "some", "static", "struct", "subscript", "super", 
            "switch", "throws", "throw", /try\?/, /try!/, "try", "typealias", /unowned\(safe\)/, 
            /unowned\(unsafe\)/, "unowned", "var", "weak", "where", "while", "willSet"
        ];

        const literals = ["false", "nil", "true"];

        const contextualKeywords = ["assignment", "associativity", "higherThan", "left", "lowerThan", "none", "right"];

        const directives = [
            "#colorLiteral", "#column", "#dsohandle", "#else", "#elseif", "#endif", "#error", "#file", 
            "#fileID", "#fileLiteral", "#filePath", "#function", "#if", "#imageLiteral", "#keyPath", 
            "#line", "#selector", "#sourceLocation", "#warn_unqualified_access", "#warning"
        ];

        const builtIns = [
            "abs", "all", "any", "assert", "assertionFailure", "debugPrint", "dump", "fatalError", 
            "getVaList", "isKnownUniquelyReferenced", "max", "min", "numericCast", "pointwiseMax", 
            "pointwiseMin", "precondition", "preconditionFailure", "print", "readLine", "repeatElement", 
            "sequence", "stride", "swap", "swift_unboxFromSwiftValueWithType", "transcode", "type", 
            "unsafeBitCast", "unsafeDowncast", "withExtendedLifetime", "withUnsafeMutablePointer", 
            "withUnsafePointer", "withVaList", "withoutActuallyEscaping", "zip"
        ];

        // Custom operator patterns
        const operatorHead = either(
            /[/=\-+!*%<>&|^~?]/,
            /[\u00A1-\u00A7]/, /[\u00A9\u00AB]/, /[\u00AC\u00AE]/, /[\u00B0\u00B1]/,
            /[\u00B6\u00BB\u00BF\u00D7\u00F7]/, /[\u2016-\u2017]/, /[\u2020-\u2027]/,
            /[\u2030-\u203E]/, /[\u2041-\u2053]/, /[\u2055-\u205E]/, /[\u2190-\u23FF]/,
            /[\u2500-\u2775]/, /[\u2794-\u2BFF]/, /[\u2E00-\u2E7F]/, /[\u3001-\u3003]/,
            /[\u3008-\u3020]/, /[\u3030]/
        );

        const operatorBody = either(
            operatorHead,
            /[\u0300-\u036F]/, /[\u1DC0-\u1DFF]/, /[\u20D0-\u20FF]/,
            /[\uFE00-\uFE0F]/, /[\uFE20-\uFE2F]/
        );

        const operatorPattern = concat(operatorHead, operatorBody, "*");

        return {
            name: "Swift",
            keywords: {
                keyword: keywords.filter(k => typeof k === 'string').concat(["_|0"]),
                literal: literals,
                built_in: builtIns,
                $pattern: either(/\b\w+/, /#\w+/)
            },
            contains: [
                {
                    className: "comment",
                    begin: "//",
                    end: "$"
                },
                {
                    className: "comment",
                    begin: "/\\*",
                    end: "\\*/",
                    contains: ["self"]
                },
                {
                    className: "keyword",
                    match: either(...protocolTypes, ...initSelfKeywords)
                },
                {
                    className: "built_in",
                    match: concat(/\b/, either(...builtIns), /(?=\()/)
                },
                {
                    className: "operator",
                    match: operatorPattern,
                    relevance: 0
                },
                {
                    className: "number",
                    variants: [
                        { match: "\\b([0-9]_*)+(\\.([0-9]_*)+)?([eE][+-]?([0-9]_*)+)?\\b" },
                        { match: "\\b0x([0-9a-fA-F]_*)+(\\.([0-9a-fA-F]_*)+)?([pP][+-]?([0-9]_*)+)?\\b" },
                        { match: /\b0o([0-7]_*)+\b/ },
                        { match: /\b0b([01]_*)+\b/ }
                    ],
                    relevance: 0
                },
                {
                    className: "string",
                    variants: [
                        {
                            begin: /"""/,
                            end: /"""/,
                            contains: [
                                { className: "subst", match: /\\[0\\tnr"']/ },
                                { className: "subst", match: /\\u\{[0-9a-fA-F]{1,8}\}/ },
                                { className: "subst", begin: /\\\(/, end: /\)/ }
                            ]
                        },
                        {
                            begin: /"/,
                            end: /"/,
                            contains: [
                                { className: "subst", match: /\\[0\\tnr"']/ },
                                { className: "subst", begin: /\\\(/, end: /\)/ }
                            ]
                        }
                    ]
                },
                {
                    className: "variable",
                    match: /\$\d+/
                },
                {
                    className: "variable", 
                    match: /\$[a-zA-Z_][a-zA-Z0-9_]*/
                },
                {
                    className: "function",
                    beginKeywords: "func",
                    end: /\{/,
                    excludeEnd: true,
                    contains: [
                        {
                            className: "title",
                            begin: /[a-zA-Z_][a-zA-Z0-9_]*/,
                            endsParent: true
                        }
                    ]
                },
                {
                    className: "class",
                    beginKeywords: "struct protocol class extension enum",
                    end: "\\{",
                    excludeEnd: true,
                    contains: [
                        {
                            className: "title",
                            begin: /[A-Za-z$_][\u00C0-\u02B80-9A-Za-z$_]*/
                        }
                    ]
                }
            ]
        };
    }

    /**
     * Create JavaScript language definition
     */
    createJavaScriptDefinition() {
        const keywords = [
            "as", "in", "of", "if", "for", "while", "finally", "var", "new", "function", "do", "return", 
            "void", "else", "break", "catch", "instanceof", "with", "throw", "case", "default", "try", 
            "switch", "continue", "typeof", "delete", "let", "yield", "const", "class", "debugger", 
            "async", "await", "static", "import", "from", "export", "extends"
        ];

        const literals = ["true", "false", "null", "undefined", "NaN", "Infinity"];

        const builtIns = [
            "Intl", "DataView", "Number", "Math", "Date", "String", "RegExp", "Object", "Function", 
            "Boolean", "Error", "Symbol", "Set", "Map", "WeakSet", "WeakMap", "Proxy", "Reflect", 
            "JSON", "Promise", "Float64Array", "Int16Array", "Int32Array", "Int8Array", "Uint16Array", 
            "Uint32Array", "Float32Array", "Array", "Uint8Array", "Uint8ClampedArray", "ArrayBuffer", 
            "BigInt64Array", "BigUint64Array", "BigInt", "console", "window", "document", "localStorage", 
            "module", "global", "require", "exports", "eval", "isFinite", "isNaN", "parseFloat", 
            "parseInt", "decodeURI", "decodeURIComponent", "encodeURI", "encodeURIComponent", "escape", 
            "unescape", "setInterval", "setTimeout", "clearInterval", "clearTimeout"
        ];

        return {
            name: "JavaScript",
            aliases: ["js", "jsx", "mjs", "cjs"],
            keywords: {
                keyword: keywords,
                literal: literals,
                built_in: builtIns
            },
            contains: [
                {
                    className: "comment",
                    variants: [
                        { begin: "//", end: "$" },
                        { begin: "/\\*", end: "\\*/" }
                    ]
                },
                {
                    className: "string",
                    variants: [
                        { begin: "'", end: "'", contains: [{ begin: "\\\\." }] },
                        { begin: '"', end: '"', contains: [{ begin: "\\\\." }] },
                        { 
                            begin: "`", 
                            end: "`", 
                            contains: [
                                { begin: "\\\\." },
                                { 
                                    className: "subst", 
                                    begin: "\\$\\{", 
                                    end: "\\}", 
                                    contains: ["self"] 
                                }
                            ] 
                        }
                    ]
                },
                {
                    className: "number",
                    variants: [
                        { begin: "\\b\\d+(\\.\\d+)?([eE][+-]?\\d+)?\\b" },
                        { begin: "\\b0[xX][0-9a-fA-F]+\\b" },
                        { begin: "\\b0[bB][01]+\\b" },
                        { begin: "\\b0[oO][0-7]+\\b" }
                    ]
                },
                {
                    className: "regexp",
                    begin: "/(?![*/])",
                    end: "/[gimuy]*",
                    contains: [{ begin: "\\\\." }]
                },
                {
                    className: "function",
                    beginKeywords: "function",
                    end: /[\{;]/,
                    excludeEnd: true,
                    contains: [
                        {
                            className: "title",
                            begin: /[a-zA-Z_$][a-zA-Z0-9_$]*/
                        },
                        {
                            className: "params",
                            begin: /\(/,
                            end: /\)/,
                            contains: ["self"]
                        }
                    ]
                },
                {
                    className: "class",
                    beginKeywords: "class",
                    end: /[\{;]/,
                    excludeEnd: true,
                    contains: [
                        {
                            className: "title",
                            begin: /[a-zA-Z_$][a-zA-Z0-9_$]*/
                        }
                    ]
                }
            ]
        };
    }

    /**
     * Create TypeScript language definition (extends JavaScript)
     */
    createTypeScriptDefinition() {
        const jsDefinition = this.createJavaScriptDefinition();
        
        // Add TypeScript-specific keywords
        const typeScriptKeywords = [
            "type", "namespace", "typedef", "interface", "public", "private", "protected", 
            "implements", "declare", "abstract", "readonly", "enum"
        ];

        const typeKeywords = ["any", "void", "number", "boolean", "string", "object", "never"];

        return {
            ...jsDefinition,
            name: "TypeScript",
            aliases: ["ts", "tsx"],
            keywords: {
                ...jsDefinition.keywords,
                keyword: [...jsDefinition.keywords.keyword, ...typeScriptKeywords],
                built_in: [...jsDefinition.keywords.built_in, ...typeKeywords]
            },
            contains: [
                ...jsDefinition.contains,
                {
                    className: "meta",
                    begin: "@[a-zA-Z_$][a-zA-Z0-9_$]*"
                },
                {
                    beginKeywords: "interface",
                    end: /\{/,
                    excludeEnd: true,
                    contains: [
                        {
                            className: "title",
                            begin: /[a-zA-Z_$][a-zA-Z0-9_$]*/
                        }
                    ]
                }
            ]
        };
    }

    /**
     * Create YAML language definition
     */
    createYAMLDefinition() {
        return {
            name: "YAML",
            aliases: ["yml"],
            case_insensitive: true,
            contains: [
                {
                    className: "comment",
                    begin: "#",
                    end: "$"
                },
                {
                    className: "meta",
                    begin: "^---\\s*$",
                    relevance: 10
                },
                {
                    className: "attr",
                    variants: [
                        { begin: "\\w[\\w :\\/.-]*:(?=[ \t]|$)" },
                        { begin: '"\\w[\\w :\\/.-]*":(?=[ \t]|$)' },
                        { begin: "'\\w[\\w :\\/.-]*':(?=[ \t]|$)" }
                    ]
                },
                {
                    className: "string",
                    begin: "[\\|>]([1-9]?[+-])?[ ]*\\n( +)[^ ][^\\n]*\\n(\\2[^\\n]+\\n?)*"
                },
                {
                    className: "string",
                    variants: [
                        { begin: "'", end: "'" },
                        { begin: '"', end: '"' },
                        { begin: "\\S+" }
                    ]
                },
                {
                    className: "number",
                    begin: "\\b[0-9]{4}(-[0-9][0-9]){0,2}([Tt \\t][0-9][0-9]?(:[0-9][0-9]){2})?(\\.[0-9]*)?([ \\t])*(Z|[-+][0-9][0-9]?(:[0-9][0-9])?)?\\b"
                },
                {
                    className: "literal",
                    beginKeywords: "true false yes no null"
                }
            ]
        };
    }

    /**
     * Create TAP (Test Anything Protocol) definition
     */
    createTAPDefinition() {
        return {
            name: "Test Anything Protocol",
            case_insensitive: true,
            contains: [
                {
                    className: "comment",
                    begin: "#",
                    end: "$"
                },
                {
                    className: "meta",
                    variants: [
                        { begin: "^TAP version (\\d+)$" },
                        { begin: "^1\\.\\.(\\d+)$" }
                    ]
                },
                {
                    begin: /---$/,
                    end: "\\.\\.\\.$",
                    subLanguage: "yaml",
                    relevance: 0
                },
                {
                    className: "number",
                    begin: " (\\d+) "
                },
                {
                    className: "symbol",
                    variants: [
                        { begin: "^ok" },
                        { begin: "^not ok" }
                    ]
                }
            ]
        };
    }

    /**
     * Create additional language definitions (Tcl, Thrift, etc.)
     */
    createTclDefinition() {
        return {
            name: "Tcl",
            aliases: ["tk"],
            keywords: "after append apply array auto_execok auto_import auto_load auto_mkindex auto_mkindex_old auto_qualify auto_reset bgerror binary break catch cd chan clock close concat continue dde dict encoding eof error eval exec exit expr fblocked fconfigure fcopy file fileevent filename flush for foreach format gets glob global history http if incr info interp join lappend|10 lassign|10 lindex|10 linsert|10 list llength|10 load lrange|10 lrepeat|10 lreplace|10 lreverse|10 lsearch|10 lset|10 lsort|10 mathfunc mathop memory msgcat namespace open package parray pid pkg::create pkg_mkIndex platform platform::shell proc puts pwd read refchan regexp registry regsub|10 rename return safe scan seek set socket source split string subst switch tcl_endOfWord tcl_findLibrary tcl_startOfNextWord tcl_startOfPreviousWord tcl_wordBreakAfter tcl_wordBreakBefore tcltest tclvars tell time tm trace unknown unload unset update uplevel upvar variable vwait while",
            contains: [
                {
                    className: "comment",
                    begin: ";[ \\t]*#",
                    end: "$"
                },
                {
                    className: "comment",
                    begin: "^[ \\t]*#",
                    end: "$"
                },
                {
                    beginKeywords: "proc",
                    end: "[\\{]",
                    excludeEnd: true,
                    contains: [
                        {
                            className: "title",
                            begin: "[ \\t\\n\\r]+(::)?[a-zA-Z_]((::)?[a-zA-Z0-9_])*",
                            end: "[ \\t\\n\\r]",
                            endsWithParent: true,
                            excludeEnd: true
                        }
                    ]
                },
                {
                    className: "string",
                    begin: '"',
                    end: '"',
                    contains: [{ begin: "\\\\." }]
                },
                {
                    className: "number",
                    begin: "\\b\\d+(\\.\\d+)?(e[+-]?\\d+)?\\b"
                }
            ]
        };
    }

    createThriftDefinition() {
        return {
            name: "Thrift",
            keywords: {
                keyword: "namespace const typedef struct enum service exception void oneway set list map required optional",
                built_in: "bool byte i16 i32 i64 double string binary",
                literal: "true false"
            },
            contains: [
                {
                    className: "string",
                    begin: '"',
                    end: '"'
                },
                {
                    className: "number",
                    begin: "\\b\\d+(\\.\\d+)?\\b"
                },
                {
                    className: "comment",
                    begin: "//",
                    end: "$"
                },
                {
                    className: "comment",
                    begin: "/\\*",
                    end: "\\*/"
                }
            ]
        };
    }

    createVerilogDefinition() {
        return {
            name: "Verilog",
            aliases: ["v", "sv", "svh"],
            case_insensitive: false,
            keywords: {
                keyword: "accept_on alias always always_comb always_ff always_latch and assert assign assume automatic before begin bind bins binsof bit break buf bufif0 bufif1 byte case casex casez cell chandle checker class clocking cmos config const constraint context continue cover covergroup coverpoint cross deassign default defparam design disable dist do edge else end endcase endchecker endclass endclocking endconfig endfunction endgenerate endgroup endinterface endmodule endpackage endprimitive endprogram endproperty endspecify endsequence endtable endtask enum event eventually expect export extends extern final first_match for force foreach forever fork forkjoin function generate genvar global highz0 highz1 if iff ifnone ignore_bins illegal_bins implements implies import incdir include initial inout input inside instance int integer interconnect interface intersect join join_any join_none large let liblist library local localparam logic longint macromodule matches medium modport module nand negedge nettype new nexttime nmos nor noshowcancelled not notif0 notif1 or output package packed parameter pmos posedge primitive priority program property protected pull0 pull1 pulldown pullup pulsestyle_ondetect pulsestyle_onevent pure rand randc randcase randsequence rcmos real realtime ref reg reject_on release repeat restrict return rnmos rpmos rtran rtranif0 rtranif1 scalared sequence shortint shortreal showcancelled signed small soft solve specify specparam static string strong strong0 strong1 struct super supply0 supply1 sync_accept_on sync_reject_on table tagged task this throughout time timeprecision timeunit tran tranif0 tranif1 tri tri0 tri1 triand trior trireg type typedef union unique until until_with untyped use uwire var vectored virtual void wait wait_order wand weak weak0 weak1 while wildcard wire with within wor xnor xor",
                built_in: "$finish $stop $exit $fatal $error $warning $info $realtime $time $stime $timeformat $bitstoreal $realtobits $bitstoshortreal $shortrealtobits $itor $rtoi $signed $unsigned $cast $bits $isunbounded $typename $unpacked_dimensions $left $right $low $high $increment $size $dimensions $unpacked_dimensions $clog2 $asin $ln $log10 $exp $sqrt $pow $floor $ceil $sin $cos $tan $countbits $countones $isunknown $fatal $error $warning $info $display $write $strobe $monitor $displayb $writeb $strobeb $monitorb $displayh $writeh $strobeh $monitorh $displayo $writeo $strobeo $monitoro $readmemb $readmemh $sreadmemb $sreadmemh $fopen $fclose $fgetc $ungetc $fgets $fscanf $fread $ftell $fseek $rewind $fflush $feof $ferror $fdisplay $fwrite $fstrobe $fmonitor $swrite $sformat $swriteb $swriteh $swriteo",
                literal: "null"
            },
            contains: [
                {
                    className: "comment",
                    begin: "//",
                    end: "$"
                },
                {
                    className: "comment",
                    begin: "/\\*",
                    end: "\\*/"
                },
                {
                    className: "string",
                    begin: '"',
                    end: '"'
                }
            ]
        };
    }

    createValaDefinition() {
        return {
            name: "Vala",
            keywords: {
                keyword: "char uchar unichar int uint long ulong short ushort int8 int16 int32 int64 uint8 uint16 uint32 uint64 float double bool struct enum string void weak unowned owned async signal static abstract interface override virtual delegate if while do for foreach else switch case break default return try catch public private protected internal using new this get set const stdout stdin stderr var",
                built_in: "DBus GLib CCode Gee Object Gtk Posix",
                literal: "false true null"
            },
            contains: [
                {
                    className: "class",
                    beginKeywords: "class interface namespace",
                    end: /\{/,
                    excludeEnd: true,
                    contains: [
                        {
                            className: "title",
                            begin: /[a-zA-Z_$][a-zA-Z0-9_$]*/
                        }
                    ]
                },
                {
                    className: "comment",
                    begin: "//",
                    end: "$"
                },
                {
                    className: "comment",
                    begin: "/\\*",
                    end: "\\*/"
                },
                {
                    className: "string",
                    begin: '"""',
                    end: '"""',
                    relevance: 5
                },
                {
                    className: "string",
                    begin: '"',
                    end: '"'
                },
                {
                    className: "string",
                    begin: "'",
                    end: "'"
                }
            ]
        };
    }

    createVBNetDefinition() {
        return {
            name: "Visual Basic .NET",
            aliases: ["vb"],
            case_insensitive: true,
            keywords: {
                keyword: "addhandler alias aggregate ansi as async assembly auto binary by byref byval call case catch class compare const continue custom declare default delegate dim distinct do each equals else elseif end enum erase error event exit explicit finally for friend from function get global goto group handles if implements imports in inherits interface into iterator join key let lib loop me mid module mustinherit mustoverride mybase myclass namespace narrowing new next notinheritable notoverridable of off on operator option optional order overloads overridable overrides paramarray partial preserve private property protected public raiseevent readonly redim removehandler resume return select set shadows shared skip static step stop structure strict sub synclock take text then throw to try unicode until using when where while widening with withevents writeonly yield",
                built_in: "addressof and andalso await directcast gettype getxmlnamespace is isfalse isnot istrue like mod nameof new not or orelse trycast typeof xor cbool cbyte cchar cdate cdbl cdec cint clng cobj csbyte cshort csng cstr cuint culng cushort",
                type: "boolean byte char date decimal double integer long object sbyte short single string uinteger ulong ushort",
                literal: "true false nothing"
            },
            contains: [
                {
                    className: "comment",
                    begin: "'",
                    end: "$"
                },
                {
                    className: "string",
                    begin: '"',
                    end: '"',
                    contains: [{ begin: '""' }]
                }
            ]
        };
    }

    createVBScriptDefinition() {
        return {
            name: "VBScript",
            aliases: ["vbs"],
            case_insensitive: true,
            keywords: {
                keyword: "call class const dim do loop erase execute executeglobal exit for each next function if then else on error option explicit new private property let get public randomize redim rem select case set stop sub while wend with end to elseif is or xor and not class_initialize class_terminate default preserve in me byval byref step resume goto",
                built_in: "server response request scriptengine scriptenginebuildversion scriptengineminorversion scriptenginemajorversion",
                literal: "true false null nothing empty"
            },
            contains: [
                {
                    className: "comment",
                    begin: "'",
                    end: "$"
                },
                {
                    className: "string",
                    begin: '"',
                    end: '"',
                    contains: [{ begin: '""' }]
                }
            ]
        };
    }

    createTwigDefinition() {
        return {
            name: "Twig",
            aliases: ["craftcms"],
            case_insensitive: true,
            subLanguage: "xml",
            contains: [
                {
                    className: "comment",
                    begin: /\{#/,
                    end: /#\}/
                },
                {
                    className: "template-tag",
                    begin: /\{%/,
                    end: /%\}/,
                    contains: [
                        {
                            className: "name",
                            begin: /\w+/,
                            keywords: "apply autoescape block deprecated do embed extends filter flush for from if import include macro sandbox set use verbatim with endapply endautoescape endblock enddeprecated enddo endembed endextends endfilter endflush endfor endfrom endif endimport endinclude endmacro endsandbox endset enduse endverbatim endwith"
                        }
                    ]
                },
                {
                    className: "template-variable",
                    begin: /\{\{/,
                    end: /\}\}/
                }
            ]
        };
    }
}

module.exports = {
    LanguageDefinitions
};