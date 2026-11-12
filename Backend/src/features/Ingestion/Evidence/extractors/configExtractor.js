import path from "node:path";
import { parse, parseExpression } from "@babel/parser";

const MAX_FILE_SIZE = 1_000_000;
const MAX_FILES = 1_000;
const MAX_EVIDENCE_ITEMS = 10_000;

const CODE_EXTENSIONS = new Set([".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx"]);

const CONFIG_KEYS = new Set([
  "baseurl",
  "base_url",
  "apiurl",
  "api_url",
  "url",
  "host",
  "port",
  "timeout",
  "requesttimeout",
  "request_timeout",
  "clientid",
  "client_id",
  "clientsecret",
  "client_secret",
  "tokenurl",
  "token_url",
  "authurl",
  "auth_url",
  "authorization",
  "authtype",
  "auth_type",
  "environment",
  "mode",
  "maxretries",
  "max_retries",
  "retries",
  "retrydelay",
  "retry_delay",
  "idempotencykey",
  "idempotency_key",
  "webhookurl",
  "webhook_url",
  "webhooksecret",
  "webhook_secret",
]);

const URL_KEY_PATTERN = /(url|uri|endpoint|host)$/i;

const AUTH_KEY_PATTERN =
  /(auth|authorization|token|clientsecret|client_secret|credential|privatekey|private_key)/i;

const TIMEOUT_KEY_PATTERN = /(timeout|time_limit|request_deadline)/i;

const RETRY_KEY_PATTERN = /(retry|retries|backoff)/i;

const IDEMPOTENCY_KEY_PATTERN = /idempotency/i;

const SECRET_KEY_PATTERN =
  /(secret|password|passwd|private.?key|access.?token|api.?key|credential)/i;
const pushEvidence = (evidence, item) => {
  if (evidence.length >= MAX_EVIDENCE_ITEMS) {
    return false;
  }

  evidence.push(item);
  return true;
};
const normalizeKey = (key) =>
  String(key)
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .toLowerCase();

const validateRelativePath = (relativePath) => {
  if (typeof relativePath !== "string" || !relativePath.trim()) {
    throw new Error("Each file must have a non-empty relativePath.");
  }

  if (
    relativePath.includes("\0") ||
    relativePath.includes("\\") ||
    relativePath.startsWith("/") ||
    /^[a-zA-Z]:/.test(relativePath)
  ) {
    throw new Error(`Unsafe file path: ${relativePath}`);
  }

  const segments = relativePath.split("/");

  if (
    segments.some((segment) => !segment || segment === "." || segment === "..")
  ) {
    throw new Error(`Unsafe file path: ${relativePath}`);
  }

  const normalized = path.posix.normalize(relativePath);

  if (
    normalized === "." ||
    normalized === ".." ||
    normalized.startsWith("../")
  ) {
    throw new Error(`Unsafe file path: ${relativePath}`);
  }

  return normalized;
};

const getSourceContent = (file) => {
  if (file.content === undefined || file.content === null) {
    throw new Error(`Content is missing for "${file.relativePath}".`);
  }

  if (Buffer.isBuffer(file.content)) {
    if (file.content.length > MAX_FILE_SIZE) {
      throw new Error(`File exceeds the ${MAX_FILE_SIZE} byte limit.`);
    }

    return file.content.toString("utf8");
  }

  if (typeof file.content !== "string") {
    throw new Error("File content must be a string or Buffer.");
  }

  if (Buffer.byteLength(file.content, "utf8") > MAX_FILE_SIZE) {
    throw new Error(`File exceeds the ${MAX_FILE_SIZE} byte limit.`);
  }

  return file.content;
};

const getExtension = (relativePath) =>
  path.posix.extname(relativePath).toLowerCase();

const isEnvironmentFile = (relativePath) => {
  const basename = path.posix.basename(relativePath);

  return (
    basename === ".env" ||
    basename.startsWith(".env.") ||
    basename === ".env.example"
  );
};

const isJsonFile = (relativePath) => getExtension(relativePath) === ".json";

const isCodeFile = (relativePath) =>
  CODE_EXTENSIONS.has(getExtension(relativePath));

const getNodeName = (node) => {
  if (!node) {
    return null;
  }

  switch (node.type) {
    case "Identifier":
      return node.name;

    case "StringLiteral":
    case "NumericLiteral":
      return String(node.value);

    case "MemberExpression":
    case "OptionalMemberExpression": {
      const objectName = getNodeName(node.object);
      const propertyName = getNodeName(node.property);

      if (!objectName || !propertyName) {
        return null;
      }

      return `${objectName}.${propertyName}`;
    }

    case "CallExpression":
    case "OptionalCallExpression":
      return getNodeName(node.callee);

    case "TSAsExpression":
    case "TSTypeAssertion":
    case "TSNonNullExpression":
    case "ParenthesizedExpression":
      return getNodeName(node.expression);

    default:
      return null;
  }
};

const describeExpression = (node) => {
  if (!node) {
    return null;
  }

  switch (node.type) {
    case "Identifier":
      return node.name;

    case "StringLiteral":
      return "<string>";

    case "NumericLiteral":
      return "<number>";

    case "BooleanLiteral":
      return "<boolean>";

    case "NullLiteral":
      return "null";

    case "TemplateLiteral":
      return "template-literal";

    case "MemberExpression":
    case "OptionalMemberExpression":
      return getNodeName(node);

    case "CallExpression":
    case "OptionalCallExpression":
      return `${getNodeName(node.callee) ?? "call"}(...)`;

    case "ObjectExpression":
      return "object-expression";

    case "ArrayExpression":
      return "array-expression";

    case "ArrowFunctionExpression":
    case "FunctionExpression":
      return "function-expression";

    case "BinaryExpression":
    case "LogicalExpression":
      return "binary-expression";

    case "ConditionalExpression":
      return "conditional-expression";

    case "TSAsExpression":
    case "TSTypeAssertion":
    case "TSNonNullExpression":
    case "ParenthesizedExpression":
      return describeExpression(node.expression);

    default:
      return `<${node.type}>`;
  }
};

const getPropertyName = (property) => {
  if (!property) {
    return null;
  }

  if (
    property.key?.type === "Identifier" ||
    property.key?.type === "StringLiteral"
  ) {
    return property.key.name ?? property.key.value;
  }

  return null;
};

const getObjectProperties = (node) => {
  if (!node || node.type !== "ObjectExpression") {
    return [];
  }

  return node.properties.filter(
    (property) =>
      property.type === "ObjectProperty" || property.type === "ObjectMethod",
  );
};

const getLocation = (node) => ({
  line: node?.loc?.start?.line ?? null,
  column: node?.loc?.start?.column ?? null,
  endLine: node?.loc?.end?.line ?? null,
  endColumn: node?.loc?.end?.column ?? null,
});

const createEvidence = ({
  evidenceType,
  relativePath,
  node,
  subject,
  value = null,
  confidence = "HIGH",
  interpretation = "DIRECT_OBSERVATION",
  limitations = [],
}) => ({
  evidenceType,
  subject,
  value,
  interpretation,
  confidence,
  source: {
    file: relativePath,
    ...getLocation(node),
  },
  limitations,
});

const walkAst = (node, visitor, parent = null) => {
  if (!node || typeof node !== "object") {
    return false;
  }

  if (typeof node.type === "string") {
    // Stop traversal when the visitor explicitly requests it.
    if (visitor(node, parent) === false) {
      return true;
    }
  }

  for (const [key, value] of Object.entries(node)) {
    if (
      key === "loc" ||
      key === "start" ||
      key === "end" ||
      key === "extra" ||
      key === "comments" ||
      key === "tokens"
    ) {
      continue;
    }

    if (Array.isArray(value)) {
      for (const child of value) {
        if (
          child &&
          typeof child === "object" &&
          walkAst(child, visitor, node)
        ) {
          return true;
        }
      }
    } else if (
      value &&
      typeof value === "object" &&
      typeof value.type === "string"
    ) {
      if (walkAst(value, visitor, node)) {
        return true;
      }
    }
  }

  return false;
};

// --------------------------------------------------
// Configuration evidence
// --------------------------------------------------

const extractConfigurationProperty = (property, relativePath, evidence) => {
  const propertyName = getPropertyName(property);

  if (!propertyName) {
    return;
  }

  const normalizedKey = normalizeKey(propertyName);

  if (!CONFIG_KEYS.has(normalizedKey)) {
    return;
  }

  const expression = property.value;

  pushEvidence(
    evidence,
    createEvidence({
      evidenceType: "CONFIGURATION_KEY",
      relativePath,
      node: property,
      subject: propertyName,
      value: {
        expression: describeExpression(expression),
      },
      limitations: [
        "Configuration declaration does not prove runtime usage.",
        "Expression values are not evaluated.",
      ],
    }),
  );

  if (expression) {
    pushEvidence(
      evidence,
      createEvidence({
        evidenceType: "CONFIGURATION_DEFAULT",
        relativePath,
        node: expression,
        subject: propertyName,
        value: {
          valueType: expression.type,
          expression: describeExpression(expression),
        },
        limitations: [
          "This is a statically declared expression.",
          "The effective runtime value may be different.",
          "Literal configuration values are intentionally not exposed.",
        ],
      }),
    );
  }

  if (URL_KEY_PATTERN.test(propertyName)) {
    pushEvidence(
      evidence,
      createEvidence({
        evidenceType: "URL_CONFIGURATION",
        relativePath,
        node: property,
        subject: propertyName,
        value: {
          expression: describeExpression(expression),
        },
        limitations: [
          "The URL expression is not evaluated.",
          "The URL is not verified as reachable or provider-owned.",
        ],
      }),
    );
  }

  if (AUTH_KEY_PATTERN.test(propertyName)) {
    pushEvidence(
      evidence,
      createEvidence({
        evidenceType: "AUTHENTICATION_CONFIGURATION",
        relativePath,
        node: property,
        subject: propertyName,
        value: {
          expression: SECRET_KEY_PATTERN.test(propertyName)
            ? "<redacted>"
            : describeExpression(expression),
        },
        limitations: [
          "Configuration naming does not prove authentication correctness.",
          "Credential values are never extracted.",
        ],
      }),
    );
  }

  if (TIMEOUT_KEY_PATTERN.test(propertyName)) {
    pushEvidence(
      evidence,
      createEvidence({
        evidenceType: "TIMEOUT_CONFIGURATION",
        relativePath,
        node: property,
        subject: propertyName,
        value: {
          expression: describeExpression(expression),
        },
        limitations: [
          "The configured timeout is not evaluated.",
          "Runtime timeout behavior is not verified.",
        ],
      }),
    );
  }

  if (RETRY_KEY_PATTERN.test(propertyName)) {
    pushEvidence(
      evidence,
      createEvidence({
        evidenceType: "RETRY_CONFIGURATION",
        relativePath,
        node: property,
        subject: propertyName,
        value: {
          expression: describeExpression(expression),
        },
        limitations: [
          "Configuration does not prove retry behavior.",
          "Retry safety for payment operations is not established.",
        ],
      }),
    );
  }

  if (IDEMPOTENCY_KEY_PATTERN.test(propertyName)) {
    pushEvidence(
      evidence,
      createEvidence({
        evidenceType: "IDEMPOTENCY_CONFIGURATION",
        relativePath,
        node: property,
        subject: propertyName,
        value: {
          expression: describeExpression(expression),
        },
        limitations: [
          "Configuration does not prove provider-side idempotency enforcement.",
        ],
      }),
    );
  }
};

const extractEnvironmentReference = (node, relativePath, evidence) => {
  const expression = getNodeName(node);

  if (!expression) {
    return;
  }

  const isNodeEnvironmentVariable = expression.startsWith("process.env.");

  const isViteEnvironmentVariable = expression.startsWith("import.meta.env.");

  if (!isNodeEnvironmentVariable && !isViteEnvironmentVariable) {
    return;
  }

  const variableName = expression.split(".").pop();

  if (!variableName) {
    return;
  }

  pushEvidence(
    evidence,
    createEvidence({
      evidenceType: "ENVIRONMENT_VARIABLE_REFERENCE",
      relativePath,
      node,
      subject: variableName,
      value: {
        accessExpression: expression,
      },
      limitations: [
        "A source reference does not prove the variable exists at runtime.",
        "Environment variable values are never extracted.",
      ],
    }),
  );
};

// --------------------------------------------------
// JSON / JavaScript / TypeScript
// --------------------------------------------------

const extractStructuredConfig = (source, relativePath, evidence) => {
  const extension = getExtension(relativePath);

  let ast;

  if (extension === ".json") {
    // Validate JSON syntax first.
    JSON.parse(source);

    // Parse JSON as an expression to preserve AST locations.
    ast = parseExpression(source, {
      plugins: ["typescript", "jsx"],
    });
  } else {
    // Existing JavaScript / TypeScript parsing.
    ast = parse(source, {
      sourceType: "unambiguous",
      errorRecovery: false,
      plugins: [
        "jsx",
        "typescript",
        "decorators-legacy",
        "classProperties",
        "classPrivateProperties",
        "classPrivateMethods",
        "dynamicImport",
        "optionalChaining",
        "nullishCoalescingOperator",
        "topLevelAwait",
      ],
    });
  }

  walkAst(ast, (node) => {
  if (evidence.length >= MAX_EVIDENCE_ITEMS) {
    return false;
  }

  if (node.type === "ObjectProperty") {
    extractConfigurationProperty(node, relativePath, evidence);
  }

  if (
    node.type === "MemberExpression" ||
    node.type === "OptionalMemberExpression"
  ) {
    extractEnvironmentReference(node, relativePath, evidence);
  }

  return evidence.length < MAX_EVIDENCE_ITEMS;
});
};

// --------------------------------------------------
// .env file extraction
// --------------------------------------------------

const extractEnvironmentFile = (source, relativePath, evidence) => {
  const lines = source.split(/\r?\n/);

  for (let index = 0; index < lines.length; index += 1) {
    if (evidence.length >= MAX_EVIDENCE_ITEMS) {
      break;
    }
    const line = lines[index];

    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("export ")) {
      continue;
    }

    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=/);

    if (!match) {
      continue;
    }

    const variableName = match[1];

    const normalizedKey = normalizeKey(variableName);

    const isSensitive = SECRET_KEY_PATTERN.test(variableName);

    pushEvidence(
      evidence,
      createEvidence({
        evidenceType: "ENVIRONMENT_VARIABLE_DECLARATION",
        relativePath,
        node: {
          loc: {
            start: {
              line: index + 1,
              column: 0,
            },
            end: {
              line: index + 1,
              column: line.length,
            },
          },
        },
        subject: variableName,
        value: {
          declarationPresent: true,
          valueType: isSensitive
            ? "SENSITIVE_VALUE_REDACTED"
            : "DECLARED_VALUE_NOT_EXTRACTED",
        },
        limitations: [
          "Declaration does not prove the variable is loaded.",
          "Declaration does not prove the variable is configured in production.",
          "Environment variable values are never extracted.",
        ],
      }),
    );

    if (URL_KEY_PATTERN.test(normalizedKey)) {
      pushEvidence(
        evidence,
        createEvidence({
          evidenceType: "URL_CONFIGURATION",
          relativePath,
          node: {
            loc: {
              start: {
                line: index + 1,
                column: 0,
              },
              end: {
                line: index + 1,
                column: line.length,
              },
            },
          },
          subject: variableName,
          value: {
            source: "ENVIRONMENT_FILE",
            valueType: "NOT_EXTRACTED",
          },
          limitations: ["The configured URL is not extracted or verified."],
        }),
      );
    }

    if (AUTH_KEY_PATTERN.test(variableName)) {
      evidence.push(
        createEvidence({
          evidenceType: "AUTHENTICATION_CONFIGURATION",
          relativePath,
          node: {
            loc: {
              start: {
                line: index + 1,
                column: 0,
              },
              end: {
                line: index + 1,
                column: line.length,
              },
            },
          },
          subject: variableName,
          value: {
            source: "ENVIRONMENT_FILE",
            valueType: "REDACTED",
          },
          limitations: [
            "Variable naming suggests authentication-related configuration only.",
            "Credential values are never extracted.",
          ],
        }),
      );
    }
  }
};

// --------------------------------------------------
// Main extractor
// --------------------------------------------------

export const extractConfigEvidence = (files) => {
  if (!Array.isArray(files)) {
    throw new Error("extractConfigEvidence expects an array of files.");
  }

  if (files.length > MAX_FILES) {
    throw new Error(`Maximum supported file count is ${MAX_FILES}.`);
  }

  const seenPaths = new Set();

  const evidence = [];
  const errors = [];

  let filesProcessed = 0;
  let filesSkipped = 0;

  for (const file of files) {
    try {
      if (!file || typeof file !== "object") {
        throw new Error("Each file must be an object.");
      }

      const relativePath = validateRelativePath(file.relativePath);

      const pathKey = relativePath.toLowerCase();

      if (seenPaths.has(pathKey)) {
        throw new Error(`Duplicate file path: ${relativePath}`);
      }

      seenPaths.add(pathKey);

      const supported =
        isEnvironmentFile(relativePath) ||
        isJsonFile(relativePath) ||
        isCodeFile(relativePath);

      if (!supported) {
        filesSkipped += 1;
        continue;
      }

      const source = getSourceContent(file);

      const evidenceBeforeFile = evidence.length;

      try {
        if (isEnvironmentFile(relativePath)) {
          extractEnvironmentFile(source, relativePath, evidence);
        } else {
          extractStructuredConfig(source, relativePath, evidence);
        }
      } catch (error) {
        evidence.length = evidenceBeforeFile;

        errors.push({
          file: relativePath,
          type: "PARSE_ERROR",
          message: error.message,
          line: error.loc?.line ?? null,
          column: error.loc?.column ?? null,
        });

        filesSkipped += 1;
        continue;
      }

      filesProcessed += 1;
    } catch (error) {
      errors.push({
        file: file?.relativePath ?? null,
        type: "FILE_PROCESSING_ERROR",
        message: error.message,
      });

      filesSkipped += 1;
    }
  }

  const evidenceByType = {};

  for (const item of evidence) {
    evidenceByType[item.evidenceType] =
      (evidenceByType[item.evidenceType] ?? 0) + 1;
  }

  return {
    evidenceType: "CONFIGURATION",
    extractor: {
      name: "CONFIG_EXTRACTOR",
      version: "1.0.0",
      parser: "@babel/parser + JSON-compatible AST + ENV_LINE_PARSER",
    },

    summary: {
      totalFiles: files.length,
      filesProcessed,
      filesSkipped,
      evidenceCount: evidence.length,
      evidenceByType,
      errorCount: errors.length,
      evidenceLimit: MAX_EVIDENCE_ITEMS,
      evidenceLimitReached: evidence.length >= MAX_EVIDENCE_ITEMS,
    },

    evidence,
    errors,

    limitations: [
      "Static extraction only. Uploaded code is never executed.",
      "Configuration expressions are not evaluated.",
      "Environment variable values and credential values are never extracted.",
      "Configuration declarations do not prove runtime usage.",
      "Imported configuration objects are not resolved.",
      "YAML configuration files are not supported in this version.",
      "Production environment configuration cannot be inferred from local files.",
    ],
  };
};
