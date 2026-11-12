import path from "node:path";

// --------------------------------------------------
// Limits
// --------------------------------------------------

const MAX_FILE_SIZE = 1_000_000; // 1 MB per file
const MAX_FILES = 1_000;
const MAX_EVIDENCE_ITEMS = 10_000;
const MAX_EXCERPT_LENGTH = 500;
const MAX_LINES_PER_EVIDENCE = 5;

// --------------------------------------------------
// Supported extensions
// --------------------------------------------------

const SUPPORTED_EXTENSIONS = new Set([
  ".md",
  ".mdx",
  ".rst",
  ".txt",
]);

// --------------------------------------------------
// Evidence categories
// --------------------------------------------------

const DOCUMENTATION_PATTERNS = {
  PAYMENT_FLOW_DOCUMENTATION: [
    /\b(payment|payments|payout|payouts|disbursement|refund|transfer)\b/i,
    /\b(authoriz(e|ation)|capture|checkout|settlement)\b/i,
    /\b(create|execute|process|cancel|confirm)\s+(a\s+)?(payment|payout|refund|transfer)\b/i,
  ],

  AUTHENTICATION_DOCUMENTATION: [
    /\b(authentication|authenticate|authorization|authorise|authorize)\b/i,
    /\b(oauth\s*2?\.?0?|client credentials|access token|bearer token)\b/i,
    /\b(refresh token|token endpoint|credential exchange)\b/i,
  ],

  WEBHOOK_DOCUMENTATION: [
    /\b(webhook|webhooks|web hook|event notification)\b/i,
    /\b(signature verification|verify signature|webhook secret)\b/i,
    /\b(event listener|event subscription|callback endpoint)\b/i,
  ],

  ERROR_HANDLING_DOCUMENTATION: [
    /\b(error handling|error response|error code|exception handling)\b/i,
    /\b(failure handling|failed request|payment failure)\b/i,
    /\b(recovery|error recovery|graceful failure)\b/i,
  ],

  RETRY_DOCUMENTATION: [
    /\b(retry|retries|retryable|retry policy|retry strategy)\b/i,
    /\b(exponential backoff|backoff|retry delay)\b/i,
    /\b(transient failure|temporary failure)\b/i,
  ],

  IDEMPOTENCY_DOCUMENTATION: [
    /\b(idempotency|idempotent|idempotency key)\b/i,
    /\b(duplicate request|duplicate payment|prevent duplicate)\b/i,
    /\b(request deduplication|deduplicate requests)\b/i,
  ],

  ENVIRONMENT_DOCUMENTATION: [
    /\b(sandbox|production environment|live environment)\b/i,
    /\b(test environment|development environment)\b/i,
    /\b(switch to production|production credentials)\b/i,
  ],

  API_REFERENCE_DOCUMENTATION: [
    /\b(api endpoint|api reference|rest api|api version)\b/i,
    /\b(request body|response body|http method)\b/i,
    /\b(base url|endpoint url|api documentation)\b/i,
    /\b(GET|POST|PUT|PATCH|DELETE)\s+\/[a-z0-9_/{}/.-]+/i,
  ],

  SECURITY_DOCUMENTATION: [
    /\b(security|secure communication|data protection)\b/i,
    /\b(secret management|credential protection|private key)\b/i,
    /\b(ssl|tls|https|certificate validation)\b/i,
    /\b(signature validation|verify authenticity)\b/i,
  ],
};

// --------------------------------------------------
// Category descriptions
// --------------------------------------------------

const CATEGORY_DESCRIPTIONS = {
  PAYMENT_FLOW_DOCUMENTATION: "Payment flow documentation",
  AUTHENTICATION_DOCUMENTATION: "Authentication documentation",
  WEBHOOK_DOCUMENTATION: "Webhook documentation",
  ERROR_HANDLING_DOCUMENTATION: "Error handling documentation",
  RETRY_DOCUMENTATION: "Retry documentation",
  IDEMPOTENCY_DOCUMENTATION: "Idempotency documentation",
  ENVIRONMENT_DOCUMENTATION: "Environment documentation",
  API_REFERENCE_DOCUMENTATION: "API reference documentation",
  SECURITY_DOCUMENTATION: "Security documentation",
};

// --------------------------------------------------
// Sensitive information patterns
// --------------------------------------------------

const SENSITIVE_PATTERNS = [
  // Authorization headers.
  {
    pattern: /\b(Authorization\s*:\s*)(?:Bearer\s+)?[^\s,;]+/gi,
    replacement: "$1<REDACTED>",
  },

  // Bearer tokens.
  {
    pattern: /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi,
    replacement: "Bearer <REDACTED>",
  },

  // Private key blocks.
  {
    pattern:
      /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/gi,
    replacement: "<PRIVATE_KEY_REDACTED>",
  },

  // Sensitive assignments.
  {
    pattern:
      /\b(client[_-]?secret|api[_-]?key|access[_-]?token|refresh[_-]?token|password|passwd|webhook[_-]?secret|private[_-]?key)\b(\s*[:=]\s*)(?:"[^"]*"|'[^']*'|`[^`]*`|[^\s,;]+)/gi,
    replacement: "$1$2<REDACTED>",
  },

  // Common provider secret formats.
  {
    pattern: /\b(?:sk_live_|sk_test_)[A-Za-z0-9_-]{8,}\b/gi,
    replacement: "<REDACTED_SECRET>",
  },

  // JWT-like values.
  {
    pattern:
      /\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\b/g,
    replacement: "<REDACTED_TOKEN>",
  },
];

// --------------------------------------------------
// Path validation
// --------------------------------------------------

const validateRelativePath = (relativePath) => {
  if (
    typeof relativePath !== "string" ||
    !relativePath.trim()
  ) {
    throw new Error(
      "Each file must have a non-empty relativePath.",
    );
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
    segments.some(
      (segment) =>
        !segment ||
        segment === "." ||
        segment === "..",
    )
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

// --------------------------------------------------
// Content validation
// --------------------------------------------------

const getSourceContent = (file) => {
  if (
    file.content === undefined ||
    file.content === null
  ) {
    throw new Error(
      `Content is missing for "${file.relativePath}".`,
    );
  }

  if (Buffer.isBuffer(file.content)) {
    if (file.content.length > MAX_FILE_SIZE) {
      throw new Error(
        `File exceeds the ${MAX_FILE_SIZE} byte limit.`,
      );
    }

    return file.content.toString("utf8");
  }

  if (typeof file.content !== "string") {
    throw new Error(
      `Content for "${file.relativePath}" must be a string or Buffer.`,
    );
  }

  if (
    Buffer.byteLength(file.content, "utf8") >
    MAX_FILE_SIZE
  ) {
    throw new Error(
      `File exceeds the ${MAX_FILE_SIZE} byte limit.`,
    );
  }

  return file.content;
};

// --------------------------------------------------
// General helpers
// --------------------------------------------------

const getExtension = (relativePath) =>
  path.posix.extname(relativePath).toLowerCase();

const sanitizeExcerpt = (text) => {
  let sanitized = text;

  for (const item of SENSITIVE_PATTERNS) {
    sanitized = sanitized.replace(
      item.pattern,
      item.replacement,
    );
  }

  // Remove control characters.
  sanitized = sanitized.replace(
    /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g,
    "",
  );

  sanitized = sanitized.trim();

  if (sanitized.length > MAX_EXCERPT_LENGTH) {
    sanitized =
      sanitized.slice(0, MAX_EXCERPT_LENGTH - 3) + "...";
  }

  return sanitized;
};

const getHeading = (line) => {
  const trimmed = line.trim();

  // Markdown heading.
  const markdownHeading = trimmed.match(/^#{1,6}\s+(.+)$/);

  if (markdownHeading) {
    return markdownHeading[1].trim();
  }

  // reStructuredText heading underline.
  return null;
};

const getSubject = (category, heading) => {
  if (heading) {
    return heading.slice(0, 150);
  }

  return CATEGORY_DESCRIPTIONS[category];
};

// --------------------------------------------------
// Evidence creation
// --------------------------------------------------

const createEvidence = ({
  evidenceType,
  relativePath,
  subject,
  excerpt,
  line,
  endLine,
}) => ({
  evidenceType,
  subject,
  value: {
    excerpt,
  },
  interpretation: "DOCUMENTATION_STATEMENT",
  confidence: "HIGH",
  source: {
    file: relativePath,
    line,
    endLine,
  },
  limitations: [
    "This evidence represents a statement found in documentation.",
    "Documentation does not prove that the described behavior is implemented.",
    "The described behavior has not been independently verified.",
  ],
});

// --------------------------------------------------
// Evidence limit
// --------------------------------------------------

const pushEvidence = (evidence, item) => {
  if (evidence.length >= MAX_EVIDENCE_ITEMS) {
    return false;
  }

  evidence.push(item);

  return true;
};

// --------------------------------------------------
// Documentation line matching
// --------------------------------------------------

const getMatchingCategories = (line) => {
  const categories = [];

  for (const [category, patterns] of Object.entries(
    DOCUMENTATION_PATTERNS,
  )) {
    const matches = patterns.some((pattern) =>
      pattern.test(line),
    );

    if (matches) {
      categories.push(category);
    }
  }

  return categories;
};

// --------------------------------------------------
// File extraction
// --------------------------------------------------

const extractDocumentationFile = (
  source,
  relativePath,
  evidence,
) => {
  const lines = source.split(/\r?\n/);

  let currentHeading = null;

  for (
    let index = 0;
    index < lines.length;
    index += 1
  ) {
    if (evidence.length >= MAX_EVIDENCE_ITEMS) {
      break;
    }

    const originalLine = lines[index];
    const trimmedLine = originalLine.trim();

    if (!trimmedLine) {
      continue;
    }

    // Track Markdown headings.
    const heading = getHeading(originalLine);

    if (heading) {
      currentHeading = heading;
    }

    // Ignore common Markdown formatting-only lines.
    if (
      /^[-=_*]{3,}$/.test(trimmedLine) ||
      /^```/.test(trimmedLine) ||
      /^~~~/.test(trimmedLine)
    ) {
      continue;
    }

    const matchingCategories =
      getMatchingCategories(originalLine);

    if (matchingCategories.length === 0) {
      continue;
    }

    const excerpt = sanitizeExcerpt(originalLine);

    if (!excerpt) {
      continue;
    }

    for (const category of matchingCategories) {
      if (evidence.length >= MAX_EVIDENCE_ITEMS) {
        break;
      }

      pushEvidence(
        evidence,
        createEvidence({
          evidenceType: category,
          relativePath,
          subject: getSubject(
            category,
            currentHeading,
          ),
          excerpt,
          line: index + 1,
          endLine: index + 1,
        }),
      );
    }
  }
};

// --------------------------------------------------
// Main extractor
// --------------------------------------------------

export const extractDocumentationEvidence = (files) => {
  if (!Array.isArray(files)) {
    throw new Error(
      "extractDocumentationEvidence expects an array of files.",
    );
  }

  if (files.length > MAX_FILES) {
    throw new Error(
      `Maximum supported file count is ${MAX_FILES}.`,
    );
  }

  const seenPaths = new Set();

  const evidence = [];
  const errors = [];

  let filesProcessed = 0;
  let filesSkipped = 0;

  for (const file of files) {
    try {
      if (!file || typeof file !== "object") {
        throw new Error(
          "Each file must be an object.",
        );
      }

      const relativePath = validateRelativePath(
        file.relativePath,
      );

      const pathKey = relativePath.toLowerCase();

      if (seenPaths.has(pathKey)) {
        throw new Error(
          `Duplicate file path: ${relativePath}`,
        );
      }

      seenPaths.add(pathKey);

      const extension = getExtension(relativePath);

      if (!SUPPORTED_EXTENSIONS.has(extension)) {
        filesSkipped += 1;
        continue;
      }

      const source = getSourceContent(file);

      const evidenceBeforeFile = evidence.length;

      try {
        extractDocumentationFile(
          source,
          relativePath,
          evidence,
        );

        filesProcessed += 1;
      } catch (error) {
        // Avoid retaining partially extracted file evidence.
        evidence.length = evidenceBeforeFile;

        throw error;
      }
    } catch (error) {
      errors.push({
        file: file?.relativePath ?? null,
        type: "FILE_PROCESSING_ERROR",
        message: error.message,
      });

      filesSkipped += 1;
    }
  }

  // ------------------------------------------------
  // Evidence summary
  // ------------------------------------------------

  const evidenceByType = {};

  for (const item of evidence) {
    evidenceByType[item.evidenceType] =
      (evidenceByType[item.evidenceType] ?? 0) + 1;
  }

  return {
    evidenceType: "DOCUMENTATION",

    extractor: {
      name: "DOCUMENTATION_EXTRACTOR",
      version: "1.0.0",
      parser: "LINE_BASED_DOCUMENTATION_PARSER",
    },

    summary: {
      totalFiles: files.length,
      filesProcessed,
      filesSkipped,
      evidenceCount: evidence.length,
      evidenceByType,
      errorCount: errors.length,
      evidenceLimit: MAX_EVIDENCE_ITEMS,
      evidenceLimitReached:
        evidence.length >= MAX_EVIDENCE_ITEMS,
    },

    evidence,

    errors,

    limitations: [
      "Documentation is analyzed using deterministic text matching.",
      "Documentation statements do not prove actual implementation.",
      "Contextual meaning and semantic relationships are not independently verified.",
      "Markdown and MDX formatting are not fully parsed.",
      "reStructuredText formatting is not fully parsed.",
      "Code examples inside documentation are treated as documentation text.",
      "Dynamic links and external references are not followed.",
      "Sensitive values are redacted from extracted excerpts using pattern-based detection.",
      "Pattern-based secret redaction is not guaranteed to detect every secret.",
      "Only explicitly matched documentation lines are extracted.",
    ],
  };
};