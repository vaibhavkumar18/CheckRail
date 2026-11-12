import path from "node:path";

const CATEGORIES = {
  API_SPECIFICATION: "API_SPECIFICATION",
  PAYMENT_CLIENT: "PAYMENT_CLIENT",
  CONFIGURATION: "CONFIGURATION",
  ENVIRONMENT_TEMPLATE: "ENVIRONMENT_TEMPLATE",
  DOCUMENTATION: "DOCUMENTATION",
  OTHER: "OTHER",
};

const TEXT_EXTENSIONS = new Set([
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".mjs",
  ".cjs",
  ".json",
  ".yaml",
  ".yml",
  ".toml",
  ".xml",
  ".md",
  ".mdx",
  ".rst",
  ".txt",
  ".env",
  ".example",
  ".sample",
  ".template",
  ".py",
  ".java",
  ".go",
  ".php",
  ".rb",
  ".cs",
  ".properties",
  ".conf",
  ".ini",
]);

const SOURCE_CODE_EXTENSIONS = new Set([
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".mjs",
  ".cjs",
  ".py",
  ".java",
  ".go",
  ".php",
  ".rb",
  ".cs",
]);

const normalizePath = (relativePath) => {
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

const getContent = (file) => {
  if (file.content === undefined || file.content === null) {
    return "";
  }

  if (Buffer.isBuffer(file.content)) {
    return file.content.toString("utf8");
  }

  if (typeof file.content !== "string") {
    throw new Error(
      `Content for "${file.relativePath}" must be a string or Buffer.`,
    );
  }

  return file.content;
};

const getRules = (relativePath, content) => {
  const lowerPath = relativePath.toLowerCase();
  const filename = path.posix.basename(lowerPath);
  const extension = path.posix.extname(filename);
  const text = content.slice(0, 1_000_000);

  const rules = [];

  // OpenAPI / Swagger specifications.
  const isApiSpecification =
    /(^|\/)(openapi|swagger|api-spec|api-specification)(\/|[._-]|$)/i.test(
      lowerPath,
    ) ||
    /(^|\/)(openapi|swagger)[^/]*\.(json|ya?ml)$/i.test(lowerPath) ||
    ([".json", ".yaml", ".yml"].includes(extension) &&
      /["']?(openapi|swagger)["']?\s*:\s*["']?\d/i.test(text));

  if (isApiSpecification) {
    rules.push({
      category: CATEGORIES.API_SPECIFICATION,
      confidence: "HIGH",
      reason: "Path/name or file content indicates an API specification.",
    });
  }

  // Environment templates should be detected before general configuration.
  const isEnvironmentTemplate =
    /^\.env(\.(example|sample|template|development|production|test))?$/.test(
      filename,
    ) || /^\.env\.(example|sample|template)$/.test(filename);

  if (isEnvironmentTemplate) {
    rules.push({
      category: CATEGORIES.ENVIRONMENT_TEMPLATE,
      confidence: "HIGH",
      reason: "Filename matches an environment template convention.",
    });
  }

  // Configuration files.
  const isConfiguration =
    !isEnvironmentTemplate &&
    (/(^|\/)(config|configuration|settings)(\/|[._-]|$)/i.test(lowerPath) ||
      /(^|\/)(config|configuration|settings)[^/]*\.(js|cjs|mjs|ts|json|ya?ml|toml|ini|conf|properties)$/i.test(
        lowerPath,
      ) ||
      (["process.env", "import.meta.env", "process.env.", "baseURL"].some(
        (marker) => text.includes(marker),
      ) &&
        ["js", "cjs", "mjs", "ts", "json", "yaml", "yml", "toml"].includes(
          extension.replace(".", ""),
        )));

  if (isConfiguration) {
    rules.push({
      category: CATEGORIES.CONFIGURATION,
      confidence: "HIGH",
      reason: "Filename or content indicates configuration.",
    });
  }

  // Payment integration client/service logic.

  // Expand camelCase before matching terms.
  // Example: payoutClient -> payout-client
  const normalizedPath = relativePath
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .toLowerCase();

  // Expand camelCase identifiers in source content.
  // Example: createPayout -> create Payout
  const normalizedText = text.replace(/([a-z0-9])([A-Z])/g, "$1 $2");

  const isSourceCode = SOURCE_CODE_EXTENSIONS.has(extension);

  // Match payment-related filenames with client/service roles.
  const paymentFilename =
    isSourceCode &&
    /(^|[/_.-])(payout|payouts|payment|payments|transfer|disbursement)([/_.-]|$)/i.test(
      normalizedPath,
    ) &&
    /(^|[/_.-])(client|service|provider|api|integration|adapter)([/_.-]|$)/i.test(
      normalizedPath,
    );

  // Match payment-related terms in source content.
  const hasPaymentTerms =
    /\b(payout|payouts|payment|payments|disbursement|transfer)\b/i.test(
      normalizedText,
    );

  // Match common HTTP client implementations.
  const hasHttpClient =
    /\b(fetch|axios|http\.request|https\.request|got|request)\b/i.test(
      normalizedText,
    );

  // Match common payment operation identifiers.
  const hasPaymentOperation =
    /\b(createPayout|createPayment|executePayout|capturePayment|createTransfer|sendPayout)\b/i.test(
      text,
    );

  const isPaymentClient =
    paymentFilename ||
    (isSourceCode && hasPaymentTerms && (hasHttpClient || hasPaymentOperation));

  if (isPaymentClient) {
    rules.push({
      category: CATEGORIES.PAYMENT_CLIENT,
      confidence: "HIGH",
      reason: paymentFilename
        ? "Filename indicates payment client/service logic."
        : "Source code contains payment operations and client/API logic.",
    });
  }

  // Documentation.
  const isDocumentation =
    [".md", ".mdx", ".rst", ".txt"].includes(extension) ||
    /(^|\/)(readme|changelog|contributing|license)(\.|$)/i.test(filename) ||
    /(^|\/)(docs|documentation)(\/|$)/i.test(lowerPath);

  if (isDocumentation) {
    rules.push({
      category: CATEGORIES.DOCUMENTATION,
      confidence: "HIGH",
      reason: "Filename or extension indicates documentation.",
    });
  }

  return rules;
};

const CATEGORY_PRIORITY = [
  CATEGORIES.API_SPECIFICATION,
  CATEGORIES.PAYMENT_CLIENT,
  CATEGORIES.CONFIGURATION,
  CATEGORIES.ENVIRONMENT_TEMPLATE,
  CATEGORIES.DOCUMENTATION,
  CATEGORIES.OTHER,
];

export const classifyFiles = (files) => {
  if (!Array.isArray(files)) {
    throw new Error("classifyFiles expects an array of files.");
  }

  const seenPaths = new Set();

  const normalizedFiles = files.map((file) => {
    if (!file || typeof file !== "object") {
      throw new Error("Each file must be an object.");
    }

    const relativePath = normalizePath(file.relativePath);
    const pathKey = relativePath.toLowerCase();

    if (seenPaths.has(pathKey)) {
      throw new Error(`Duplicate file path: ${relativePath}`);
    }

    seenPaths.add(pathKey);

    return {
      relativePath,
      content: getContent(file),
    };
  });

  return normalizedFiles.map(({ relativePath, content }) => {
    const rules = getRules(relativePath, content);

    if (rules.length === 0) {
      return {
        relativePath,
        category: CATEGORIES.OTHER,
        confidence: "LOW",
        reasons: ["No known classification rule matched this file."],
        additionalCategories: [],
      };
    }

    rules.sort(
      (a, b) =>
        CATEGORY_PRIORITY.indexOf(a.category) -
        CATEGORY_PRIORITY.indexOf(b.category),
    );

    const primary = rules[0];

    return {
      relativePath,
      category: primary.category,
      confidence: primary.confidence,
      reasons: rules.map((rule) => rule.reason),
      additionalCategories: rules.slice(1).map((rule) => rule.category),
    };
  });
};

export { CATEGORIES, TEXT_EXTENSIONS };
