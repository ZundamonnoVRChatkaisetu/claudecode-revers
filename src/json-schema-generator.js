import { randomUUID } from 'crypto';

// JSON Schema Generator for Zod schemas
export const JSON_SCHEMA_TARGETS = {
  JSONSCHEMA7: "jsonSchema7",
  JSONSCHEMA2019: "jsonSchema2019-09", 
  OPENAPI3: "openApi3",
  OPENAI: "openAi"
};

export const ZOD_TYPE_NAMES = {
  ZodString: "ZodString",
  ZodNumber: "ZodNumber", 
  ZodBigInt: "ZodBigInt",
  ZodBoolean: "ZodBoolean",
  ZodNull: "ZodNull",
  ZodObject: "ZodObject",
  ZodArray: "ZodArray",
  ZodUnion: "ZodUnion",
  ZodIntersection: "ZodIntersection",
  ZodTuple: "ZodTuple",
  ZodRecord: "ZodRecord",
  ZodLiteral: "ZodLiteral",
  ZodEnum: "ZodEnum",
  ZodNativeEnum: "ZodNativeEnum",
  ZodNullable: "ZodNullable",
  ZodOptional: "ZodOptional",
  ZodMap: "ZodMap",
  ZodSet: "ZodSet",
  ZodLazy: "ZodLazy",
  ZodPromise: "ZodPromise",
  ZodNaN: "ZodNaN",
  ZodNever: "ZodNever",
  ZodEffects: "ZodEffects",
  ZodAny: "ZodAny",
  ZodUnknown: "ZodUnknown",
  ZodDefault: "ZodDefault",
  ZodBranded: "ZodBranded",
  ZodReadonly: "ZodReadonly",
  ZodCatch: "ZodCatch",
  ZodPipeline: "ZodPipeline",
  ZodDiscriminatedUnion: "ZodDiscriminatedUnion",
  ZodFunction: "ZodFunction",
  ZodVoid: "ZodVoid",
  ZodSymbol: "ZodSymbol"
};

export function createJSONSchemaConfig(options = {}) {
  return {
    target: options.target || JSON_SCHEMA_TARGETS.JSONSCHEMA7,
    strictUnions: options.strictUnions ?? false,
    removeAdditionalStrategy: options.removeAdditionalStrategy || "strict",
    allowedAdditionalProperties: options.allowedAdditionalProperties ?? true,
    rejectedAdditionalProperties: options.rejectedAdditionalProperties ?? false,
    mapStrategy: options.mapStrategy || "record",
    pipeStrategy: options.pipeStrategy || "all",
    $refStrategy: options.$refStrategy || "root",
    basePath: options.basePath || ["#"],
    definitionPath: options.definitionPath || "definitions",
    currentPath: [],
    propertyPath: undefined,
    seen: new Map(),
    override: options.override,
    postProcess: options.postProcess,
    markdownDescription: options.markdownDescription ?? false,
    enforceStrictCapabilities: options.enforceStrictCapabilities ?? false
  };
}

export function convertZodToJSONSchema(zodSchema, options = {}) {
  const config = createJSONSchemaConfig(options);
  
  const definitions = typeof options === "object" && options.definitions 
    ? Object.entries(options.definitions).reduce((acc, [key, def]) => ({
        ...acc,
        [key]: parseZodDef(def._def, {
          ...config,
          currentPath: [...config.basePath, config.definitionPath, key]
        }, true) ?? {}
      }), {})
    : undefined;

  const name = typeof options === "string" ? options : 
    (options?.nameStrategy === "title" ? undefined : options?.name);
  
  const schema = parseZodDef(zodSchema._def, 
    name === undefined ? config : {
      ...config,
      currentPath: [...config.basePath, config.definitionPath, name]
    }, false) ?? {};

  const title = typeof options === "object" && options.name !== undefined && 
    options.nameStrategy === "title" ? options.name : undefined;

  if (title !== undefined) {
    schema.title = title;
  }

  const result = name === undefined 
    ? (definitions ? { ...schema, [config.definitionPath]: definitions } : schema)
    : {
        $ref: [...(config.$refStrategy === "relative" ? [] : config.basePath), 
              config.definitionPath, name].join("/"),
        [config.definitionPath]: {
          ...definitions,
          [name]: schema
        }
      };

  if (config.target === JSON_SCHEMA_TARGETS.JSONSCHEMA7) {
    result.$schema = "http://json-schema.org/draft-07/schema#";
  } else if (config.target === JSON_SCHEMA_TARGETS.JSONSCHEMA2019 || 
             config.target === JSON_SCHEMA_TARGETS.OPENAI) {
    result.$schema = "https://json-schema.org/draft/2019-09/schema#";
  }

  if (config.target === JSON_SCHEMA_TARGETS.OPENAI && 
      (("anyOf" in result) || ("oneOf" in result) || ("allOf" in result) ||
       ("type" in result) && Array.isArray(result.type))) {
    console.warn("Warning: OpenAI may not support schemas with unions as roots! Try wrapping it in an object property.");
  }

  return result;
}

export function parseZodDef(def, config, isRoot = false) {
  if (!def) return undefined;

  const existingEntry = config.seen.get(def);
  if (config.override) {
    const overrideResult = config.override(def, config, existingEntry, isRoot);
    if (overrideResult !== undefined) {
      return overrideResult;
    }
  }

  if (existingEntry && !isRoot) {
    const ref = createReference(existingEntry, config);
    if (ref !== undefined) return ref;
  }

  const entry = {
    def,
    path: config.currentPath,
    jsonSchema: undefined
  };
  config.seen.set(def, entry);

  const parser = getZodParser(def, def.typeName, config);
  const result = typeof parser === "function" ? parseZodDef(parser(), config) : parser;

  if (result) {
    addDescription(def, config, result);
  }

  if (config.postProcess) {
    const processed = config.postProcess(result, def, config);
    entry.jsonSchema = result;
    return processed;
  }

  entry.jsonSchema = result;
  return result;
}

function getZodParser(def, typeName, config) {
  switch (typeName) {
    case ZOD_TYPE_NAMES.ZodString:
      return parseZodString(def, config);
    case ZOD_TYPE_NAMES.ZodNumber:
      return parseZodNumber(def, config);
    case ZOD_TYPE_NAMES.ZodObject:
      return parseZodObject(def, config);
    case ZOD_TYPE_NAMES.ZodBigInt:
      return parseZodBigInt(def, config);
    case ZOD_TYPE_NAMES.ZodBoolean:
      return parseZodBoolean();
    case ZOD_TYPE_NAMES.ZodDate:
      return parseZodDate(def, config);
    case ZOD_TYPE_NAMES.ZodUndefined:
      return parseZodUndefined();
    case ZOD_TYPE_NAMES.ZodNull:
      return parseZodNull(config);
    case ZOD_TYPE_NAMES.ZodArray:
      return parseZodArray(def, config);
    case ZOD_TYPE_NAMES.ZodUnion:
    case ZOD_TYPE_NAMES.ZodDiscriminatedUnion:
      return parseZodUnion(def, config);
    case ZOD_TYPE_NAMES.ZodIntersection:
      return parseZodIntersection(def, config);
    case ZOD_TYPE_NAMES.ZodTuple:
      return parseZodTuple(def, config);
    case ZOD_TYPE_NAMES.ZodRecord:
      return parseZodRecord(def, config);
    case ZOD_TYPE_NAMES.ZodLiteral:
      return parseZodLiteral(def, config);
    case ZOD_TYPE_NAMES.ZodEnum:
      return parseZodEnum(def);
    case ZOD_TYPE_NAMES.ZodNativeEnum:
      return parseZodNativeEnum(def);
    case ZOD_TYPE_NAMES.ZodNullable:
      return parseZodNullable(def, config);
    case ZOD_TYPE_NAMES.ZodOptional:
      return parseZodOptional(def, config);
    case ZOD_TYPE_NAMES.ZodMap:
      return parseZodMap(def, config);
    case ZOD_TYPE_NAMES.ZodSet:
      return parseZodSet(def, config);
    case ZOD_TYPE_NAMES.ZodLazy:
      return () => def.getter()._def;
    case ZOD_TYPE_NAMES.ZodPromise:
      return parseZodPromise(def, config);
    case ZOD_TYPE_NAMES.ZodNaN:
    case ZOD_TYPE_NAMES.ZodNever:
      return parseZodNever();
    case ZOD_TYPE_NAMES.ZodEffects:
      return parseZodEffects(def, config);
    case ZOD_TYPE_NAMES.ZodAny:
      return parseZodAny();
    case ZOD_TYPE_NAMES.ZodUnknown:
      return parseZodUnknown();
    case ZOD_TYPE_NAMES.ZodDefault:
      return parseZodDefault(def, config);
    case ZOD_TYPE_NAMES.ZodBranded:
      return parseZodBranded(def, config);
    case ZOD_TYPE_NAMES.ZodReadonly:
      return parseZodReadonly(def, config);
    case ZOD_TYPE_NAMES.ZodCatch:
      return parseZodCatch(def, config);
    case ZOD_TYPE_NAMES.ZodPipeline:
      return parseZodPipeline(def, config);
    case ZOD_TYPE_NAMES.ZodFunction:
    case ZOD_TYPE_NAMES.ZodVoid:
    case ZOD_TYPE_NAMES.ZodSymbol:
      return undefined;
    default:
      return undefined;
  }
}

function parseZodString(def, config) {
  const schema = { type: "string" };
  
  if (!def.checks) return schema;
  
  for (const check of def.checks) {
    switch (check.kind) {
      case "min":
        setProperty(schema, "minLength", check.value, check.message, config);
        break;
      case "max":
        setProperty(schema, "maxLength", check.value, check.message, config);
        break;
      case "length":
        setProperty(schema, "minLength", check.value, check.message, config);
        setProperty(schema, "maxLength", check.value, check.message, config);
        break;
      case "email":
        setProperty(schema, "format", "email", check.message, config);
        break;
      case "url":
        setProperty(schema, "format", "uri", check.message, config);
        break;
      case "uuid":
        setProperty(schema, "format", "uuid", check.message, config);
        break;
      case "regex":
        setProperty(schema, "pattern", check.regex.source, check.message, config);
        break;
      case "includes":
        setProperty(schema, "pattern", escapeRegex(check.value), check.message, config);
        break;
      case "startsWith":
        setProperty(schema, "pattern", `^${escapeRegex(check.value)}`, check.message, config);
        break;
      case "endsWith":
        setProperty(schema, "pattern", `${escapeRegex(check.value)}$`, check.message, config);
        break;
      case "datetime":
        setProperty(schema, "format", "date-time", check.message, config);
        break;
      case "date":
        setProperty(schema, "format", "date", check.message, config);
        break;
      case "time":
        setProperty(schema, "format", "time", check.message, config);
        break;
      case "duration":
        setProperty(schema, "format", "duration", check.message, config);
        break;
      case "ip":
        setProperty(schema, "format", check.version ? `ipv${check.version}` : "ip", check.message, config);
        break;
    }
  }
  
  return schema;
}

function parseZodNumber(def, config) {
  const schema = { type: "number" };
  
  if (!def.checks) return schema;
  
  for (const check of def.checks) {
    switch (check.kind) {
      case "int":
        schema.type = "integer";
        setErrorMessage(schema, "type", check.message, config);
        break;
      case "min":
        if (config.target === JSON_SCHEMA_TARGETS.JSONSCHEMA7) {
          if (check.inclusive) {
            setProperty(schema, "minimum", check.value, check.message, config);
          } else {
            setProperty(schema, "exclusiveMinimum", check.value, check.message, config);
          }
        } else {
          if (!check.inclusive) {
            schema.exclusiveMinimum = true;
          }
          setProperty(schema, "minimum", check.value, check.message, config);
        }
        break;
      case "max":
        if (config.target === JSON_SCHEMA_TARGETS.JSONSCHEMA7) {
          if (check.inclusive) {
            setProperty(schema, "maximum", check.value, check.message, config);
          } else {
            setProperty(schema, "exclusiveMaximum", check.value, check.message, config);
          }
        } else {
          if (!check.inclusive) {
            schema.exclusiveMaximum = true;
          }
          setProperty(schema, "maximum", check.value, check.message, config);
        }
        break;
      case "multipleOf":
        setProperty(schema, "multipleOf", check.value, check.message, config);
        break;
    }
  }
  
  return schema;
}

function parseZodObject(def, config) {
  const requiresOpenAIWorkaround = config.target === JSON_SCHEMA_TARGETS.OPENAI;
  const schema = {
    type: "object",
    properties: {}
  };
  const required = [];
  const shape = def.shape();

  for (const key in shape) {
    const zodField = shape[key];
    if (!zodField || !zodField._def) continue;

    let isOptional = getOptionalState(zodField);
    
    if (isOptional && requiresOpenAIWorkaround) {
      if (zodField instanceof ZodOptional) {
        zodField = zodField._def.innerType;
      }
      if (!zodField.isNullable()) {
        zodField = zodField.nullable();
      }
      isOptional = false;
    }

    const fieldSchema = parseZodDef(zodField._def, {
      ...config,
      currentPath: [...config.currentPath, "properties", key],
      propertyPath: [...config.currentPath, "properties", key]
    });

    if (fieldSchema === undefined) continue;

    schema.properties[key] = fieldSchema;
    if (!isOptional) {
      required.push(key);
    }
  }

  if (required.length) {
    schema.required = required;
  }

  const additionalProperties = getAdditionalProperties(def, config);
  if (additionalProperties !== undefined) {
    schema.additionalProperties = additionalProperties;
  }

  return schema;
}

function parseZodBoolean() {
  return { type: "boolean" };
}

function parseZodBigInt(def, config) {
  const schema = { type: "integer" };
  
  if (def.checks) {
    for (const check of def.checks) {
      switch (check.kind) {
        case "min":
          setProperty(schema, "minimum", Number(check.value), check.message, config);
          break;
        case "max":
          setProperty(schema, "maximum", Number(check.value), check.message, config);
          break;
      }
    }
  }
  
  return schema;
}

function parseZodDate(def, config) {
  const schema = { type: "string", format: "date-time" };
  
  if (def.checks) {
    for (const check of def.checks) {
      switch (check.kind) {
        case "min":
          setProperty(schema, "formatMinimum", check.value.toISOString(), check.message, config);
          break;
        case "max":
          setProperty(schema, "formatMaximum", check.value.toISOString(), check.message, config);
          break;
      }
    }
  }
  
  return schema;
}

function parseZodArray(def, config) {
  const schema = {
    type: "array",
    items: parseZodDef(def.type._def, {
      ...config,
      currentPath: [...config.currentPath, "items"]
    })
  };

  if (def.minLength) {
    setProperty(schema, "minItems", def.minLength.value, def.minLength.message, config);
  }
  if (def.maxLength) {
    setProperty(schema, "maxItems", def.maxLength.value, def.maxLength.message, config);
  }
  if (def.exactLength) {
    setProperty(schema, "minItems", def.exactLength.value, def.exactLength.message, config);
    setProperty(schema, "maxItems", def.exactLength.value, def.exactLength.message, config);
  }

  return schema;
}

function parseZodEnum(def) {
  return {
    type: "string",
    enum: def.values
  };
}

function parseZodLiteral(def, config) {
  const value = def.value;
  const type = typeof value;
  
  if (type === "boolean" || type === "string" || type === "number") {
    return {
      type: type === "number" ? "number" : type,
      enum: [value]
    };
  }
  
  if (value === null) {
    return parseZodNull(config);
  }
  
  return { enum: [value] };
}

function parseZodNull(config) {
  return config.target === JSON_SCHEMA_TARGETS.OPENAPI3 
    ? { enum: ["null"], nullable: true }
    : { type: "null" };
}

function parseZodNever() {
  return { not: {} };
}

function parseZodAny() {
  return {};
}

function parseZodUnknown() {
  return {};
}

function parseZodNullable(def, config) {
  const innerSchema = parseZodDef(def.innerType._def, {
    ...config,
    currentPath: [...config.currentPath]
  });

  if (!innerSchema) return undefined;

  if (config.target === JSON_SCHEMA_TARGETS.OPENAPI3) {
    if (innerSchema && "$ref" in innerSchema) {
      return { allOf: [innerSchema], nullable: true };
    }
    return innerSchema && { ...innerSchema, nullable: true };
  }

  return { anyOf: [innerSchema, { type: "null" }] };
}

function parseZodOptional(def, config) {
  if (config.currentPath.toString() === config.propertyPath?.toString()) {
    return parseZodDef(def.innerType._def, config);
  }

  const innerSchema = parseZodDef(def.innerType._def, {
    ...config,
    currentPath: [...config.currentPath, "anyOf", "1"]
  });

  return innerSchema ? { anyOf: [{ not: {} }, innerSchema] } : {};
}

// Utility functions
function setProperty(schema, property, value, message, config) {
  schema[property] = value;
  if (message && config.errorMessages) {
    if (!schema.errorMessage) schema.errorMessage = {};
    schema.errorMessage[property] = message;
  }
}

function setErrorMessage(schema, property, message, config) {
  if (message && config.errorMessages) {
    if (!schema.errorMessage) schema.errorMessage = {};
    schema.errorMessage[property] = message;
  }
}

function escapeRegex(str, config) {
  // Advanced regex pattern strategy
  if (config?.patternStrategy === "escape") {
    return escapeRegexPattern(str);
  }
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Enhanced regex escaping for pattern strategy
function escapeRegexPattern(value) {
  const allowedChars = new Set("ABCDEFGHIJKLMNOPQRSTUVXYZabcdefghijklmnopqrstuvxyz0123456789");
  let result = "";
  
  for (let i = 0; i < value.length; i++) {
    if (!allowedChars.has(value[i])) {
      result += "\\";
    }
    result += value[i];
  }
  
  return result;
}

// Apply regex flags for advanced pattern matching
function applyRegexFlags(regex, config) {
  if (!config.applyRegexFlags || !regex.flags) {
    return regex.source;
  }

  const flags = {
    i: regex.flags.includes("i"),
    m: regex.flags.includes("m"), 
    s: regex.flags.includes("s")
  };

  const source = flags.i ? regex.source.toLowerCase() : regex.source;
  let result = "";
  let escaped = false;
  let inCharClass = false;
  let rangeFlag = false;

  for (let i = 0; i < source.length; i++) {
    if (escaped) {
      result += source[i];
      escaped = false;
      continue;
    }

    // Case insensitive flag handling
    if (flags.i) {
      if (inCharClass) {
        if (source[i].match(/[a-z]/)) {
          if (rangeFlag) {
            result += source[i];
            result += `${source[i-2]}-${source[i]}`.toUpperCase();
            rangeFlag = false;
          } else if (source[i+1] === "-" && source[i+2]?.match(/[a-z]/)) {
            result += source[i];
            rangeFlag = true;
          } else {
            result += `${source[i]}${source[i].toUpperCase()}`;
          }
          continue;
        }
      } else if (source[i].match(/[a-z]/)) {
        result += `[${source[i]}${source[i].toUpperCase()}]`;
        continue;
      }
    }

    // Multiline flag handling  
    if (flags.m) {
      if (source[i] === "^") {
        result += `(^|(?<=[\\r\\n]))`;
        continue;
      } else if (source[i] === "$") {
        result += `($|(?=[\\r\\n]))`;
        continue;
      }
    }

    // Dotall flag handling
    if (flags.s && source[i] === ".") {
      result += inCharClass ? `${source[i]}\\r\\n` : `[${source[i]}\\r\\n]`;
      continue;
    }

    if (source[i] === "\\") {
      escaped = true;
    } else if (source[i] === "[") {
      inCharClass = true;
    } else if (source[i] === "]") {
      inCharClass = false;
    }

    result += source[i];
  }

  return result;
}

function getOptionalState(zodType) {
  try {
    return zodType.isOptional();
  } catch {
    return true;
  }
}

function getAdditionalProperties(def, config) {
  if (def.catchall._def.typeName !== "ZodNever") {
    return parseZodDef(def.catchall._def, {
      ...config,
      currentPath: [...config.currentPath, "additionalProperties"]
    });
  }

  switch (def.unknownKeys) {
    case "passthrough":
      return config.allowedAdditionalProperties;
    case "strict":
      return config.rejectedAdditionalProperties;
    case "strip":
      return config.removeAdditionalStrategy === "strict" 
        ? config.allowedAdditionalProperties 
        : config.rejectedAdditionalProperties;
  }
}

function createReference(entry, config) {
  switch (config.$refStrategy) {
    case "root":
      return { $ref: entry.path.join("/") };
    case "relative":
      return { $ref: relativePath(config.currentPath, entry.path) };
    case "none":
    case "seen":
      if (entry.path.length < config.currentPath.length && 
          entry.path.every((segment, index) => config.currentPath[index] === segment)) {
        console.warn(`Recursive reference detected at ${config.currentPath.join("/")}! Defaulting to any`);
        return {};
      }
      return config.$refStrategy === "seen" ? {} : undefined;
  }
}

function relativePath(from, to) {
  let commonLength = 0;
  for (; commonLength < from.length && commonLength < to.length; commonLength++) {
    if (from[commonLength] !== to[commonLength]) break;
  }
  return [(from.length - commonLength).toString(), ...to.slice(commonLength)].join("/");
}

function addDescription(def, config, schema) {
  if (def.description) {
    schema.description = def.description;
    if (config.markdownDescription) {
      schema.markdownDescription = def.description;
    }
  }
  return schema;
}

// Placeholder implementations for missing parsers
function parseZodUnion(def, config) { return { anyOf: [] }; }
function parseZodIntersection(def, config) { return { allOf: [] }; }
function parseZodTuple(def, config) { return { type: "array" }; }
function parseZodRecord(def, config) { return { type: "object" }; }
function parseZodNativeEnum(def) { return { type: "string" }; }
function parseZodMap(def, config) { return { type: "object" }; }
function parseZodSet(def, config) { return { type: "array", uniqueItems: true }; }
function parseZodPromise(def, config) { return parseZodDef(def.type._def, config); }
function parseZodEffects(def, config) { return parseZodDef(def.schema._def, config); }
function parseZodDefault(def, config) { return parseZodDef(def.innerType._def, config); }
function parseZodBranded(def, config) { return parseZodDef(def.type._def, config); }
function parseZodReadonly(def, config) { return parseZodDef(def.innerType._def, config); }
function parseZodCatch(def, config) { return parseZodDef(def.innerType._def, config); }
function parseZodPipeline(def, config) { 
  if (config.pipeStrategy === "input") {
    return parseZodDef(def.in._def, config);
  } else if (config.pipeStrategy === "output") {
    return parseZodDef(def.out._def, config);
  }
  return { allOf: [] }; 
}

export const jsonSchemaGenerator = {
  convertZodToJSONSchema,
  parseZodDef,
  createJSONSchemaConfig,
  JSON_SCHEMA_TARGETS,
  ZOD_TYPE_NAMES
};