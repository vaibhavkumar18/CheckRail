import path from "node:path";
import { parse } from "@babel/parser";

const MAX_FILE_SIZE = 1_000_000; // 1 MB per file
const MAX_FILES = 1_000;
const MAX_EVIDENCE_ITEMS = 10_000;

const SUPPORTED_EXTENSIONS = new Set([
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".ts",
  ".tsx",
]);

const PAYMENT_TERMS =
  /\b(payment|payments|payout|payouts|transfer|disbursement|refund|capture|checkout)\b/i;

const PAYMENT_FUNCTION_PATTERN =
  /\b(create|execute|capture|send|refund|process|authorize|get|fetch|cancel|update).*(payment|payout|transfer|disbursement|refund|checkout)|^(payment|payout|transfer|disbursement|refund|checkout)/i;

const HTTP_METHODS = new Set([
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
]);

// --------------------------------------------------
// Basic helpers
// --------------------------------------------------

const getExtension = (relativePath) =>
  path.posix.extname(relativePath).toLowerCase();

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
    throw new Error(
      `Content for "${file.relativePath}" must be a string or Buffer.`,
    );
  }

  if (Buffer.byteLength(file.content, "utf8") > MAX_FILE_SIZE) {
    throw new Error(`File exceeds the ${MAX_FILE_SIZE} byte limit.`);
  }

  return file.content;
};

const getLocation = (node) => ({
  line: node?.loc?.start?.line ?? null,
  column: node?.loc?.start?.column ?? null,
  endLine: node?.loc?.end?.line ?? null,
  endColumn: node?.loc?.end?.column ?? null,
});

const createSourceReference = (relativePath, node) => ({
  file: relativePath,
  ...getLocation(node),
});

// --------------------------------------------------
// AST helpers
// --------------------------------------------------

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

    case "PrivateName":
      return getNodeName(node.id);

    case "MemberExpression":
    case "OptionalMemberExpression": {
      const objectName = getNodeName(node.object);

      const propertyName = node.computed
        ? getNodeName(node.property)
        : getNodeName(node.property);

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

/**
 * Returns a safe structural representation of an expression.
 *
 * Important:
 * - Does not return literal string values.
 * - Does not evaluate expressions.
 * - Does not expose environment variable values.
 * - Does not expose potential credentials.
 */
const describeExpression = (node) => {
  if (!node) {
    return null;
  }

  switch (node.type) {
    case "Identifier":
      return node.name;

    case "StringLiteral":
    case "NumericLiteral":
    case "BooleanLiteral":
      return `<${node.type.replace("Literal", "").toLowerCase()}>`;

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

    case "BinaryExpression":
    case "LogicalExpression":
      return "binary-expression";

    case "ConditionalExpression":
      return "conditional-expression";

    case "ArrowFunctionExpression":
    case "FunctionExpression":
      return "function-expression";

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

  if (property.computed) {
    return getNodeName(property.key);
  }

  return getNodeName(property.key);
};

const getObjectProperty = (objectNode, propertyName) => {
  if (!objectNode || objectNode.type !== "ObjectExpression") {
    return null;
  }

  return (
    objectNode.properties.find(
      (property) =>
        property.type === "ObjectProperty" &&
        getPropertyName(property) === propertyName,
    ) ?? null
  );
};

const getObjectProperties = (objectNode) => {
  if (!objectNode || objectNode.type !== "ObjectExpression") {
    return [];
  }

  return objectNode.properties.filter(
    (property) => property.type === "ObjectProperty",
  );
};

const getCallArguments = (node) => {
  if (
    node?.type !== "CallExpression" &&
    node?.type !== "OptionalCallExpression"
  ) {
    return [];
  }

  return node.arguments ?? [];
};

const getCallName = (node) => {
  if (
    node?.type !== "CallExpression" &&
    node?.type !== "OptionalCallExpression"
  ) {
    return null;
  }

  return getNodeName(node.callee);
};

const isCallExpression = (node) =>
  node?.type === "CallExpression" || node?.type === "OptionalCallExpression";

// --------------------------------------------------
// AST traversal
// --------------------------------------------------

const walkAst = (node, visitor, parent = null) => {
  if (!node || typeof node !== "object") {
    return;
  }

  if (typeof node.type === "string") {
    visitor(node, parent);
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
        if (child && typeof child === "object") {
          walkAst(child, visitor, node);
        }
      }
    } else if (
      value &&
      typeof value === "object" &&
      typeof value.type === "string"
    ) {
      walkAst(value, visitor, node);
    }
  }
};

// --------------------------------------------------
// Evidence creation
// --------------------------------------------------

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
  source: createSourceReference(relativePath, node),
  limitations,
});

// --------------------------------------------------
// HTTP client detection
// --------------------------------------------------
// --------------------------------------------------
// Axios instance detection
// --------------------------------------------------

const getAxiosInstances = (ast) => {
  const instances = new Set();

  walkAst(ast, (node) => {
    if (node.type !== "VariableDeclarator") {
      return;
    }

    if (node.id?.type !== "Identifier") {
      return;
    }

    if (!isCallExpression(node.init)) {
      return;
    }

    const callName = getCallName(node.init);

    if (callName === "axios.create") {
      instances.add(node.id.name);
    }
  });

  return instances;
};

const getAxiosMethod = (callName, axiosInstances) => {
  if (!callName) {
    return null;
  }

  // Direct Axios calls: axios.post(), axios.get(), etc.
  const directMatch = callName.match(
    /^axios\.(get|post|put|patch|delete|head|options)$/i,
  );

  if (directMatch) {
    return directMatch[1].toUpperCase();
  }

  // Configured Axios instances: client.post(), client.get(), etc.
  const instanceMatch = callName.match(
    /^([a-zA-Z_$][\w$]*)\.(get|post|put|patch|delete|head|options)$/i,
  );

  if (!instanceMatch) {
    return null;
  }

  const [, instanceName, method] = instanceMatch;

  if (!axiosInstances.has(instanceName)) {
    return null;
  }

  return method.toUpperCase();
};
const extractHttpClient = (node, axiosInstances) => {
  const callName = getCallName(node);

  if (!callName) {
    return null;
  }

  if (
    callName === "fetch" ||
    callName === "window.fetch" ||
    callName === "globalThis.fetch"
  ) {
    return "FETCH";
  }

  // Axios config-object request.
  if (callName === "axios") {
    return "AXIOS";
  }

  // Direct Axios methods and configured Axios instances.
  if (getAxiosMethod(callName, axiosInstances)) {
    return "AXIOS";
  }

  if (callName === "http.request" || callName === "https.request") {
    return "NODE_HTTP";
  }

  return null;
};

// --------------------------------------------------
// HTTP method extraction
// --------------------------------------------------

const extractHttpMethod = (node, axiosInstances) => {
  const callName = getCallName(node);

  if (!callName) {
    return null;
  }

  // Direct Axios methods and configured Axios instances.
  const axiosMethod = getAxiosMethod(callName, axiosInstances);

  if (axiosMethod) {
    return axiosMethod;
  }

  const argumentsList = getCallArguments(node);

  // fetch(url, { method: "POST" })
  if (
    callName === "fetch" ||
    callName === "window.fetch" ||
    callName === "globalThis.fetch"
  ) {
    const options = argumentsList[1];

    const methodProperty = getObjectProperty(options, "method");

    if (methodProperty?.value?.type === "StringLiteral") {
      const method = methodProperty.value.value.toUpperCase();

      return HTTP_METHODS.has(method) ? method : null;
    }

    return null;
  }

  // axios({ method: "POST", url: ... })
  if (callName === "axios") {
    const config = argumentsList[0];

    const methodProperty = getObjectProperty(config, "method");

    if (methodProperty?.value?.type === "StringLiteral") {
      const method = methodProperty.value.value.toUpperCase();

      return HTTP_METHODS.has(method) ? method : null;
    }
  }

  return null;
};

// --------------------------------------------------
// HTTP request extraction
// --------------------------------------------------

const extractHttpRequest = (node, relativePath, evidence, axiosInstances) => {
  const client = extractHttpClient(node, axiosInstances);

  if (!client) {
    return;
  }

  const callName = getCallName(node);
  const argumentsList = getCallArguments(node);

  const axiosMethod =
    client === "AXIOS" ? getAxiosMethod(callName, axiosInstances) : null;

  const isAxiosMethod = Boolean(axiosMethod);

  let urlNode = argumentsList[0];
  let bodyNode = null;
  let configNode = null;

  if (isAxiosMethod) {
    const hasRequestBody = ["POST", "PUT", "PATCH"].includes(axiosMethod);

    if (hasRequestBody) {
      // axios.post(url, data, config)
      bodyNode = argumentsList[1] ?? null;
      configNode = argumentsList[2] ?? null;
    } else {
      // axios.get(url, config)
      configNode = argumentsList[1] ?? null;
    }
  } else if (callName === "axios") {
    // axios({ method, url, data, ... })
    const axiosConfig = argumentsList[0];

    const urlProperty = getObjectProperty(axiosConfig, "url");

    const dataProperty = getObjectProperty(axiosConfig, "data");

    urlNode = urlProperty?.value ?? null;
    bodyNode = dataProperty?.value ?? null;
    configNode = axiosConfig;
  } else if (
    callName === "fetch" ||
    callName === "window.fetch" ||
    callName === "globalThis.fetch"
  ) {
    configNode = argumentsList[1] ?? null;
  } else {
    configNode = argumentsList[1] ?? null;
  }

  const method = extractHttpMethod(node, axiosInstances);

  evidence.push(
    createEvidence({
      evidenceType: "HTTP_REQUEST",
      relativePath,
      node,
      subject: client,
      value: {
        client,
        method,
        urlExpression: describeExpression(urlNode),
        bodyExpression: describeExpression(bodyNode),
        configExpression: describeExpression(configNode),
      },
      limitations: [
        "Request expressions are statically described and are not evaluated.",
        "Dynamic URL values cannot be resolved.",
        "The presence of a request does not prove successful execution.",
        "Request body and configuration expressions are not evaluated.",
      ],
    }),
  );
};

// --------------------------------------------------
// Authorization header detection
// --------------------------------------------------

const extractAuthorizationHeaders = (node, relativePath, evidence) => {
  const properties = getObjectProperties(node);

  for (const property of properties) {
    const propertyName = getPropertyName(property);

    if (
      typeof propertyName !== "string" ||
      propertyName.toLowerCase() !== "authorization"
    ) {
      continue;
    }

    evidence.push(
      createEvidence({
        evidenceType: "AUTHORIZATION_HEADER",
        relativePath,
        node: property,
        subject: "HTTP_AUTHORIZATION",
        value: {
          headerName: "Authorization",
          valueExpression: describeExpression(property.value),
        },
        limitations: [
          "Header presence does not prove valid authentication.",
          "Token contents are not extracted.",
          "Authentication protocol cannot be confirmed from this header alone.",
        ],
      }),
    );
  }
};

// --------------------------------------------------
// Header extraction
// --------------------------------------------------

const extractHeaders = (node, relativePath, evidence) => {
  const properties = getObjectProperties(node);

  for (const property of properties) {
    const propertyName = getPropertyName(property);

    if (
      typeof propertyName !== "string" ||
      propertyName.toLowerCase() !== "headers"
    ) {
      continue;
    }

    const headersObject = property.value;

    if (headersObject?.type !== "ObjectExpression") {
      evidence.push(
        createEvidence({
          evidenceType: "HTTP_HEADERS",
          relativePath,
          node: property,
          subject: "REQUEST_HEADERS",
          value: {
            headersExpression: describeExpression(headersObject),
          },
          limitations: [
            "Header values are dynamically constructed or otherwise unresolved.",
          ],
        }),
      );

      continue;
    }

    const headerNames = getObjectProperties(headersObject)
      .map(getPropertyName)
      .filter(Boolean);

    evidence.push(
      createEvidence({
        evidenceType: "HTTP_HEADERS",
        relativePath,
        node: property,
        subject: "REQUEST_HEADERS",
        value: {
          headerNames,
        },
        limitations: [
          "Header values are intentionally excluded.",
          "Dynamically generated headers may not be visible.",
        ],
      }),
    );

    extractAuthorizationHeaders(headersObject, relativePath, evidence);

    for (const header of getObjectProperties(headersObject)) {
      const name = getPropertyName(header);

      if (name?.toLowerCase() === "idempotency-key") {
        evidence.push(
          createEvidence({
            evidenceType: "IDEMPOTENCY_KEY",
            relativePath,
            node: header,
            subject: "IDEMPOTENCY_HEADER",
            value: {
              headerName: name,
              valueExpression: describeExpression(header.value),
            },
            limitations: [
              "Header presence does not prove provider-side idempotency enforcement.",
              "The actual key value is not extracted.",
            ],
          }),
        );
      }
    }
  }
};

// --------------------------------------------------
// Environment variable extraction
// --------------------------------------------------

const extractEnvironmentVariables = (node, relativePath, evidence) => {
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

  evidence.push(
    createEvidence({
      evidenceType: "ENVIRONMENT_VARIABLE_REFERENCE",
      relativePath,
      node,
      subject: variableName,
      value: {
        accessExpression: expression,
      },
      limitations: [
        "Reference in source code does not prove the variable exists at runtime.",
        "Environment variable values are never extracted.",
      ],
    }),
  );
};

// --------------------------------------------------
// Base URL extraction
// --------------------------------------------------

const extractBaseUrl = (node, relativePath, evidence) => {
  const properties = getObjectProperties(node);

  for (const property of properties) {
    const propertyName = getPropertyName(property);

    if (
      typeof propertyName !== "string" ||
      !["baseURL", "baseUrl", "base_url"].includes(propertyName)
    ) {
      continue;
    }

    evidence.push(
      createEvidence({
        evidenceType: "BASE_URL_CONFIGURATION",
        relativePath,
        node: property,
        subject: propertyName,
        value: {
          expression: describeExpression(property.value),
        },
        limitations: [
          "The base URL expression is not evaluated.",
          "A configured base URL does not prove that requests use it.",
        ],
      }),
    );
  }
};

// --------------------------------------------------
// Timeout extraction
// --------------------------------------------------

const extractTimeout = (node, relativePath, evidence) => {
  const properties = getObjectProperties(node);

  for (const property of properties) {
    if (getPropertyName(property) !== "timeout") {
      continue;
    }

    evidence.push(
      createEvidence({
        evidenceType: "HTTP_TIMEOUT_CONFIGURATION",
        relativePath,
        node: property,
        subject: "REQUEST_TIMEOUT",
        value: {
          expression: describeExpression(property.value),
        },
        limitations: [
          "Timeout expression is not evaluated.",
          "Actual runtime timeout behavior is not verified.",
        ],
      }),
    );
  }
};

// --------------------------------------------------
// Retry detection
// --------------------------------------------------

const extractRetryPatterns = (node, relativePath, evidence) => {
  const callName = getCallName(node);

  if (!callName) {
    return;
  }

  const normalizedName = callName.toLowerCase();

  const retryIndicators = ["retry", "retries", "retryaxios", "axiosretry"];

  if (retryIndicators.some((indicator) => normalizedName.includes(indicator))) {
    evidence.push(
      createEvidence({
        evidenceType: "RETRY_PATTERN",
        relativePath,
        node,
        subject: "RETRY_CALL",
        value: {
          callExpression: callName,
        },
        limitations: [
          "Retry configuration does not prove retries succeed.",
          "Retry safety for payment operations is not established.",
        ],
      }),
    );
  }
};

// --------------------------------------------------
// Payment-related function detection
// --------------------------------------------------

const extractPaymentFunctions = (node, relativePath, evidence) => {
  let functionName = null;

  if (node.type === "FunctionDeclaration" && node.id) {
    functionName = node.id.name;
  }

  if (
    node.type === "VariableDeclarator" &&
    node.id?.type === "Identifier" &&
    (node.init?.type === "ArrowFunctionExpression" ||
      node.init?.type === "FunctionExpression")
  ) {
    functionName = node.id.name;
  }

  if (node.type === "ClassMethod" || node.type === "ObjectMethod") {
    functionName = getNodeName(node.key);
  }

  if (!functionName || !PAYMENT_FUNCTION_PATTERN.test(functionName)) {
    return;
  }

  evidence.push(
    createEvidence({
      evidenceType: "PAYMENT_FUNCTION",
      relativePath,
      node,
      subject: functionName,
      value: {
        functionName,
      },
      limitations: [
        "Function naming indicates payment-related intent only.",
        "Function behavior is not executed or verified.",
      ],
    }),
  );
};

// --------------------------------------------------
// Error handling detection
// --------------------------------------------------

const extractErrorHandling = (node, relativePath, evidence) => {
  if (node.type !== "CatchClause") {
    return;
  }

  const parameterName = getNodeName(node.param);

  evidence.push(
    createEvidence({
      evidenceType: "ERROR_HANDLING",
      relativePath,
      node,
      subject: "CATCH_BLOCK",
      value: {
        errorVariable: parameterName,
      },
      limitations: [
        "Presence of a catch block does not prove errors are handled correctly.",
        "The catch block's runtime behavior is not evaluated.",
      ],
    }),
  );
};

// --------------------------------------------------
// Token reference detection
// --------------------------------------------------

const extractTokenReferences = (node, relativePath, evidence) => {
  const expression = getNodeName(node);

  if (!expression) {
    return;
  }

  if (
    /\b(accessToken|access_token|authToken|auth_token|bearerToken|bearer_token)\b/i.test(
      expression,
    )
  ) {
    evidence.push(
      createEvidence({
        evidenceType: "TOKEN_REFERENCE",
        relativePath,
        node,
        subject: "TOKEN_VARIABLE",
        value: {
          expression,
        },
        limitations: [
          "Variable naming does not prove token validity.",
          "Token values are never extracted.",
        ],
      }),
    );
  }
};

// --------------------------------------------------
// Main extractor
// --------------------------------------------------

export const extractCodeEvidence = (files) => {
  if (!Array.isArray(files)) {
    throw new Error("extractCodeEvidence expects an array of files.");
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

      const extension = getExtension(relativePath);

      if (!SUPPORTED_EXTENSIONS.has(extension)) {
        filesSkipped += 1;

        continue;
      }

      const source = getSourceContent(file);

      let ast;

      try {
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
      } catch (error) {
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
      const axiosInstances = getAxiosInstances(ast);
      walkAst(ast, (node) => {
        if (evidence.length >= MAX_EVIDENCE_ITEMS) {
          return;
        }

        // HTTP requests.
        if (isCallExpression(node)) {
          extractHttpRequest(node, relativePath, evidence, axiosInstances);

          extractRetryPatterns(node, relativePath, evidence);
        }

        // Request configuration.
        if (node.type === "ObjectExpression") {
          extractHeaders(node, relativePath, evidence);

          extractBaseUrl(node, relativePath, evidence);

          extractTimeout(node, relativePath, evidence);
        }

        // Environment variables.
        if (
          node.type === "MemberExpression" ||
          node.type === "OptionalMemberExpression"
        ) {
          extractEnvironmentVariables(node, relativePath, evidence);

          extractTokenReferences(node, relativePath, evidence);
        }

        // Payment-related function declarations.
        if (
          node.type === "FunctionDeclaration" ||
          node.type === "VariableDeclarator" ||
          node.type === "ClassMethod" ||
          node.type === "ObjectMethod"
        ) {
          extractPaymentFunctions(node, relativePath, evidence);
        }

        // Error handling.
        extractErrorHandling(node, relativePath, evidence);
      });
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
    evidenceType: "SOURCE_CODE",
    extractor: {
      name: "CODE_EXTRACTOR",
      version: "1.0.0",
      parser: "@babel/parser",
    },

    summary: {
      totalFiles: files.length,
      filesProcessed,
      filesSkipped,
      evidenceCount: evidence.length,
      evidenceByType,
      errorCount: errors.length,
    },

    evidence,
    errors,

    limitations: [
      "Static analysis only. Uploaded code is never executed.",
      "Dynamic expressions are not evaluated.",
      "Variable names and function names do not prove runtime behavior.",
      "External dependencies and imported function implementations are not resolved.",
      "Authentication correctness is not verified.",
      "Payment-provider compliance is not established by source-code evidence alone.",
    ],
  };
};
