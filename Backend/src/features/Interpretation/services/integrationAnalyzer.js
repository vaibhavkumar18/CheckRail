const PROVIDER_SIGNALS = {
  PAYPAL: {
    hostnames: [
      "api-m.paypal.com",
      "api-m.sandbox.paypal.com",
      "api.paypal.com",
      "api.sandbox.paypal.com",
    ],
    configPattern: /paypal/i,
    sdkPackages: ["@paypal/checkout-server-sdk", "@paypal/paypal-server-sdk"],
  },
  HYPERWALLET: {
    hostnames: ["api.hyperwallet.com", "api.sandbox.hyperwallet.com"],
    configPattern: /hyperwallet/i,
    sdkPackages: [],
  },
};

const CAPABILITY_DEFINITIONS = [
  {
    name: "PAYMENT_COLLECTION",
    patterns: [
      /payment[_\s-]?collection/i,
      /create[_\s-]?payment/i,
      /capture[_\s-]?payment/i,
      /authorize[_\s-]?payment/i,
      /payment[_\s-]?intent/i,
    ],
  },
  {
    name: "PAYOUT",
    patterns: [/payout/i, /disbursement/i, /send[_\s-]?payment/i],
  },
  {
    name: "REFUND",
    patterns: [/refund/i],
  },
  {
    name: "TRANSFER",
    patterns: [/transfer/i],
  },
  {
    name: "WEBHOOK",
    patterns: [/webhook/i, /notification[_\s-]?callback/i],
  },
];

const PROVIDER_CONFIGURATION_TYPES = new Set([
  "CONFIGURATION_KEY",
  "CONFIGURATION_DEFAULT",
  "URL_CONFIGURATION",
  "BASE_URL_CONFIGURATION",
  "ENVIRONMENT_VARIABLE_REFERENCE",
  "ENVIRONMENT_VARIABLE_DECLARATION",
]);

const DOCUMENTATION_TYPES = new Set([
  "PAYMENT_FLOW_DOCUMENTATION",
  "IDEMPOTENCY_DOCUMENTATION",
  "AUTHENTICATION_DOCUMENTATION",
  "WEBHOOK_DOCUMENTATION",
]);

const CAPABILITY_EVIDENCE_TYPES = new Set([
  "PAYMENT_FUNCTION",
  "API_OPERATION",
  ...DOCUMENTATION_TYPES,
  "PAYMENT_COLLECTION_CAPABILITY",
  "PAYOUT_CAPABILITY",
  "REFUND_CAPABILITY",
  "TRANSFER_CAPABILITY",
  "WEBHOOK_CAPABILITY",
]);

const LIFECYCLE_EVIDENCE_TYPES = {
  CREATION: new Set([
    "TRANSACTION_CREATION",
    "PAYMENT_CREATION",
    "PAYOUT_CREATION",
  ]),

  AUTHORIZATION: new Set(["AUTHORIZATION", "PAYMENT_AUTHORIZATION"]),

  CAPTURE: new Set(["CAPTURE", "PAYMENT_CAPTURE"]),

  PAYOUT: new Set(["PAYOUT_STATUS", "PAYOUT_LIFECYCLE"]),

  REFUND: new Set(["REFUND_STATUS", "REFUND_LIFECYCLE"]),

  STATUS_HANDLING: new Set([
    "TRANSACTION_STATUS",
    "PAYMENT_STATUS",
    "STATUS_TRANSITION",
    "TRANSACTION_STATE",
  ]),
};

const uniqueEvidence = (items) => {
  const map = new Map();

  for (const item of items) {
    if (item?.evidenceId) {
      map.set(item.evidenceId, item);
    }
  }

  return [...map.values()];
};

const createFinding = ({
  description,
  assessment,
  confidence,
  evidence = [],
  limitations = [],
}) => ({
  description,
  assessment,
  confidence,
  evidenceIds: [
    ...new Set(evidence.map((item) => item.evidenceId).filter(Boolean)),
  ],
  limitations,
});

const getEvidenceUrl = (item) => {
  if (item?.evidenceType === "API_SERVER") {
    const url = item.value?.url ?? item.subject;

    return typeof url === "string" ? url : null;
  }

  if (item?.evidenceType === "HTTP_REQUEST") {
    // Only literal URLs are considered.
    // Dynamic expressions are not evaluated.
    return typeof item.value?.url === "string" ? item.value.url : null;
  }

  return null;
};

const matchesProviderHostname = (url, hostnames) => {
  if (typeof url !== "string") {
    return false;
  }

  try {
    const hostname = new URL(url).hostname.toLowerCase();

    return hostnames.some(
      (providerHostname) =>
        hostname === providerHostname ||
        hostname.endsWith(`.${providerHostname}`),
    );
  } catch {
    return false;
  }
};

const getProviderEvidence = (evidence) => {
  const candidates = Object.fromEntries(
    Object.keys(PROVIDER_SIGNALS).map((name) => [
      name,
      {
        strongEvidence: [],
        weakEvidence: [],
      },
    ]),
  );

  for (const [providerName, rules] of Object.entries(PROVIDER_SIGNALS)) {
    for (const item of evidence) {
      const type = item.evidenceType;

      // A literal provider-owned URL in source code is strong
      // static evidence of the integration destination.
      if (type === "HTTP_REQUEST" && item.sourceCategory === "SOURCE_CODE") {
        const url = getEvidenceUrl(item);

        if (matchesProviderHostname(url, rules.hostnames)) {
          candidates[providerName].strongEvidence.push(item);
          continue;
        }
      }

      // OpenAPI server declarations are weaker evidence.
      // They do not prove the application actually uses that server.
      if (
        type === "API_SERVER" &&
        item.sourceCategory === "API_SPECIFICATION"
      ) {
        const url = getEvidenceUrl(item);

        if (matchesProviderHostname(url, rules.hostnames)) {
          candidates[providerName].weakEvidence.push(item);
          continue;
        }
      }

      // Provider-related configuration names are weak evidence.
      if (PROVIDER_CONFIGURATION_TYPES.has(type)) {
        const searchableConfig = [
          item.subject,
          item.value?.key,
          item.value?.name,
          item.value?.expression,
          item.value?.accessExpression,
        ]
          .filter((value) => typeof value === "string")
          .join(" ");

        if (rules.configPattern.test(searchableConfig)) {
          candidates[providerName].weakEvidence.push(item);
          continue;
        }
      }

      // SDK/package presence is weak evidence because a dependency
      // may be installed without being used.
      if (["SDK_REFERENCE", "DEPENDENCY"].includes(type)) {
        const dependencyText = [
          item.subject,
          item.value?.name,
          item.value?.package,
        ]
          .filter((value) => typeof value === "string")
          .join(" ")
          .toLowerCase();

        if (
          rules.sdkPackages.some((packageName) =>
            dependencyText.includes(packageName.toLowerCase()),
          )
        ) {
          candidates[providerName].weakEvidence.push(item);
        }
      }
    }
  }

  return candidates;
};

const analyzeProvider = (evidence) => {
  const candidates = getProviderEvidence(evidence);

  const strongCandidates = Object.entries(candidates).filter(
    ([, signals]) => signals.strongEvidence.length > 0,
  );

  const weakCandidates = Object.entries(candidates).filter(
    ([, signals]) => signals.weakEvidence.length > 0,
  );

  const allCandidateNames = [
    ...new Set([
      ...strongCandidates.map(([name]) => name),
      ...weakCandidates.map(([name]) => name),
    ]),
  ];

  const allEvidenceIds = (entries) => [
    ...new Set(
      entries
        .flatMap(([, signals]) => [
          ...signals.strongEvidence,
          ...signals.weakEvidence,
        ])
        .map((item) => item.evidenceId)
        .filter(Boolean),
    ),
  ];

  if (allCandidateNames.length === 0) {
    return {
      name: null,
      identificationStatus: "UNKNOWN",
      confidence: "UNKNOWN",
      evidenceIds: [],
      alternatives: [],
    };
  }

  // Never arbitrarily select one provider when evidence conflicts.
  if (allCandidateNames.length > 1) {
    return {
      name: null,
      identificationStatus: "POSSIBLE",
      confidence: "LOW",
      evidenceIds: allEvidenceIds(Object.entries(candidates)),
      alternatives: allCandidateNames,
    };
  }

  const [onlyProvider] = allCandidateNames;
  const providerSignals = candidates[onlyProvider];

  if (strongCandidates.length === 1) {
    return {
      name: onlyProvider,
      identificationStatus: "IDENTIFIED",
      confidence: "HIGH",
      evidenceIds: [
        ...new Set(
          providerSignals.strongEvidence
            .map((item) => item.evidenceId)
            .filter(Boolean),
        ),
      ],
      alternatives: [],
    };
  }

  return {
    name: onlyProvider,
    identificationStatus: "POSSIBLE",
    confidence: "LOW",
    evidenceIds: [
      ...new Set(
        providerSignals.weakEvidence
          .map((item) => item.evidenceId)
          .filter(Boolean),
      ),
    ],
    alternatives: [],
  };
};

const getCapabilityText = (item) => {
  const type = item.evidenceType;

  // Do not use filenames, evidence types, or generic metadata.
  // They can create false positives such as payoutClient.js.

  if (type === "PAYMENT_FUNCTION") {
    return [item.value?.functionName, item.subject]
      .filter((value) => typeof value === "string")
      .join(" ");
  }

  if (type === "API_OPERATION") {
    return [
      item.value?.operationId,
      item.value?.summary,
      item.value?.description,
      item.value?.path,
      ...(Array.isArray(item.value?.tags) ? item.value.tags : []),
    ]
      .filter((value) => typeof value === "string")
      .join(" ");
  }

  if (DOCUMENTATION_TYPES.has(type)) {
    return typeof item.value?.excerpt === "string" ? item.value.excerpt : "";
  }

  return "";
};

const getCapabilityAssessment = (item) => {
  if (DOCUMENTATION_TYPES.has(item.evidenceType)) {
    return {
      assessment: "INFERRED",
      confidence: "LOW",
      limitation:
        "Documentation describes intended or recommended behavior; it does not prove implementation.",
    };
  }

  if (item.evidenceType === "API_OPERATION") {
    return {
      assessment: "INFERRED",
      confidence: "LOW",
      limitation:
        "The API operation is declared in a specification; this does not prove that source code implements it.",
    };
  }

  if (item.evidenceType === "PAYMENT_FUNCTION") {
    return {
      assessment: "INFERRED",
      confidence: "LOW",
      limitation:
        "Function naming suggests payment-related intent only; function behavior is not executed or verified.",
    };
  }

  return {
    assessment: "INFERRED",
    confidence: "LOW",
    limitation:
      "The evidence indicates a capability declaration, but runtime behavior has not been verified.",
  };
};

const detectCapabilities = (evidence) => {
  const matches = new Map();

  for (const item of evidence) {
    if (!CAPABILITY_EVIDENCE_TYPES.has(item.evidenceType)) {
      continue;
    }

    const searchableText = getCapabilityText(item);

    if (!searchableText) {
      continue;
    }

    for (const definition of CAPABILITY_DEFINITIONS) {
      const matched = definition.patterns.some((pattern) =>
        pattern.test(searchableText),
      );

      if (!matched) {
        continue;
      }

      if (!matches.has(definition.name)) {
        matches.set(definition.name, []);
      }

      matches.get(definition.name).push(item);
    }
  }

  // Explicit capability evidence types.
  const explicitTypeMap = {
    PAYMENT_COLLECTION_CAPABILITY: "PAYMENT_COLLECTION",
    PAYOUT_CAPABILITY: "PAYOUT",
    REFUND_CAPABILITY: "REFUND",
    TRANSFER_CAPABILITY: "TRANSFER",
    WEBHOOK_CAPABILITY: "WEBHOOK",
  };

  for (const item of evidence) {
    const capabilityName = explicitTypeMap[item.evidenceType];

    if (!capabilityName) {
      continue;
    }

    if (!matches.has(capabilityName)) {
      matches.set(capabilityName, []);
    }

    matches.get(capabilityName).push(item);
  }

  return [...matches.entries()].map(([name, items]) => ({
    name,
    evidence: uniqueEvidence(items),
  }));
};

const analyzeCapabilities = (evidence) =>
  detectCapabilities(evidence).map(({ name, evidence: matchedEvidence }) => {
    const assessments = matchedEvidence.map(getCapabilityAssessment);

    const confidence = assessments.some((item) => item.confidence === "MEDIUM")
      ? "MEDIUM"
      : "LOW";

    return {
      name,
      finding: createFinding({
        description: `Evidence suggests a ${name
          .replace(/_/g, " ")
          .toLowerCase()} capability. Implementation has not been established.`,

        assessment: "INFERRED",
        confidence,

        evidence: matchedEvidence,

        limitations: [
          ...new Set(assessments.map((item) => item.limitation)),
          "Static analysis does not establish successful runtime execution.",
        ],
      }),
    };
  });

const analyzeIntegrationType = (capabilities) => {
  // Integration type is a classification inferred from detected
  // capabilities. It does not establish runtime implementation.

  const detectedCapabilities = new Set(capabilities.map((item) => item.name));

  const hasCollection = detectedCapabilities.has("PAYMENT_COLLECTION");

  const hasDisbursement = detectedCapabilities.has("PAYOUT");

  if (hasCollection && hasDisbursement) {
    return "BOTH";
  }

  if (hasCollection) {
    return "COLLECTION";
  }

  if (hasDisbursement) {
    return "DISBURSEMENT";
  }

  return "UNKNOWN";
};
// --------------------------------------------------
// API Operation Evidence Helpers
// --------------------------------------------------

const hasLineOverlap = (first, second) => {
  if (
    !first?.source?.file ||
    !second?.source?.file ||
    first.source.file !== second.source.file
  ) {
    return false;
  }

  const firstStart = first.source.line;
  const firstEnd = first.source.endLine ?? firstStart;
  const secondStart = second.source.line;
  const secondEnd = second.source.endLine ?? secondStart;

  if (!Number.isInteger(firstStart) || !Number.isInteger(secondStart)) {
    return false;
  }

  return firstStart <= secondEnd && secondStart <= firstEnd;
};

const isSameOpenApiOperation = (operation, relatedEvidence) => {
  const operationFile = operation.source?.file;
  const operationReference = operation.source?.reference;
  const relatedFile = relatedEvidence.source?.file;
  const relatedReference = relatedEvidence.source?.reference;

  if (
    !operationFile ||
    !operationReference ||
    !relatedFile ||
    !relatedReference
  ) {
    return false;
  }

  if (operationFile !== relatedFile) {
    return false;
  }

  return (
    relatedReference === operationReference ||
    relatedReference.startsWith(`${operationReference}.`) ||
    relatedReference.startsWith(`${operationReference}[`)
  );
};

const getSourceRequestEvidence = (request, evidence) => {
  return evidence.filter((item) => {
    if (!["HTTP_HEADERS", "AUTHORIZATION_HEADER"].includes(item.evidenceType)) {
      return false;
    }

    return hasLineOverlap(request, item);
  });
};

const getOpenApiRelatedEvidence = (operation, evidence) => {
  const relatedTypes = new Set([
    "API_OPERATION_PARAMETER",
    "API_REQUEST_BODY",
    "API_RESPONSE",
    "API_OPERATION_SECURITY",
  ]);

  return evidence.filter(
    (item) =>
      relatedTypes.has(item.evidenceType) &&
      isSameOpenApiOperation(operation, item),
  );
};

const uniqueEvidenceIds = (items) => [
  ...new Set(items.map((item) => item.evidenceId).filter(Boolean)),
];
// --------------------------------------------------
// API Operations
// --------------------------------------------------

const analyzeApiOperations = (evidence) => {
  const operationEvidence = evidence.filter((item) =>
    ["HTTP_REQUEST", "API_OPERATION"].includes(item.evidenceType),
  );

  return operationEvidence.map((item) => {
    const isSpecification = item.evidenceType === "API_OPERATION";

    // --------------------------------------------------
    // SOURCE CODE HTTP REQUEST
    // --------------------------------------------------

    if (!isSpecification) {
      const requestEvidence = getSourceRequestEvidence(item, evidence);

      const headerEvidence = requestEvidence.filter(
        (record) => record.evidenceType === "HTTP_HEADERS",
      );

      const authenticationEvidence = requestEvidence.filter(
        (record) => record.evidenceType === "AUTHORIZATION_HEADER",
      );

      const headerNames = [
        ...new Set(
          headerEvidence.flatMap((record) =>
            Array.isArray(record.value?.headerNames)
              ? record.value.headerNames
              : [],
          ),
        ),
      ];

      const method = item.value?.method || item.value?.httpMethod || null;

      const request = {
        client: item.value?.client ?? null,

        bodyExpression: item.value?.bodyExpression ?? null,

        configExpression: item.value?.configExpression ?? null,

        headers: headerNames,

        evidenceIds: uniqueEvidenceIds([item, ...requestEvidence]),
      };

      const findingEvidence = [item, ...requestEvidence];

      return {
        name:
          [item.value?.client, method].filter(Boolean).join(" ") ||
          item.subject ||
          "Unnamed HTTP request",

        method,

        endpoint: item.value?.url ?? item.value?.urlExpression ?? null,

        request,

        response: null,

        authentication:
          authenticationEvidence.length > 0
            ? {
                detected: true,
                mechanism: null,
                evidenceIds: uniqueEvidenceIds(authenticationEvidence),
              }
            : null,

        operationType: "SOURCE_HTTP_REQUEST",

        finding: createFinding({
          description:
            "An HTTP request declaration and its associated static request evidence were detected in source code.",

          assessment: "OBSERVED",
          confidence: "HIGH",

          evidence: findingEvidence,

          limitations: [
            "Request expressions are not evaluated by static analysis.",

            "Dynamic URL and request body expressions cannot be resolved.",

            "Header names may be detected, but header values are intentionally excluded.",

            "An Authorization header does not establish a valid authentication mechanism.",

            "No actual response can be established from the request declaration alone.",

            "The request declaration does not prove successful execution.",
          ],
        }),
      };
    }

    // --------------------------------------------------
    // OPENAPI SPECIFICATION
    // --------------------------------------------------

    const relatedEvidence = getOpenApiRelatedEvidence(item, evidence);

    const parameters = relatedEvidence
      .filter((record) => record.evidenceType === "API_OPERATION_PARAMETER")
      .map((record) => ({
        name: record.subject ?? null,
        definition: record.value ?? null,
        evidenceIds: uniqueEvidenceIds([record]),
      }));

    const requestBodyEvidence = relatedEvidence.filter(
      (record) => record.evidenceType === "API_REQUEST_BODY",
    );

    const responseEvidence = relatedEvidence.filter(
      (record) => record.evidenceType === "API_RESPONSE",
    );

    const securityEvidence = relatedEvidence.filter(
      (record) => record.evidenceType === "API_OPERATION_SECURITY",
    );

    const request =
      requestBodyEvidence.length > 0 || parameters.length > 0
        ? {
            parameters,

            bodies: requestBodyEvidence.map((record) => ({
              definition: record.value ?? null,
              evidenceIds: uniqueEvidenceIds([record]),
            })),

            evidenceIds: uniqueEvidenceIds([
              ...requestBodyEvidence,
              ...relatedEvidence.filter(
                (record) => record.evidenceType === "API_OPERATION_PARAMETER",
              ),
            ]),
          }
        : null;

    const response =
      responseEvidence.length > 0
        ? {
            responses: responseEvidence.map((record) => ({
              statusCode: record.value?.statusCode ?? null,

              description: record.value?.description ?? null,

              definition: record.value ?? null,

              evidenceIds: uniqueEvidenceIds([record]),
            })),

            evidenceIds: uniqueEvidenceIds(responseEvidence),
          }
        : null;

    const declaredSecurity = item.value?.security;

    const hasOperationSecurityDeclaration =
      declaredSecurity?.source === "OPERATION";

    const hasEffectiveGlobalSecurity =
      declaredSecurity?.source === "GLOBAL" &&
      Array.isArray(declaredSecurity.requirements) &&
      declaredSecurity.requirements.length > 0;

    const securityDeclaration = hasOperationSecurityDeclaration
      ? declaredSecurity
      : hasEffectiveGlobalSecurity
        ? declaredSecurity
        : null;

    const authentication = securityDeclaration
      ? {
          declared: true,
          source: securityDeclaration.source,
          requirements: securityDeclaration.requirements ?? [],
          evidenceIds: uniqueEvidenceIds([item, ...securityEvidence]),
        }
      : null;

    const findingEvidence = [item, ...relatedEvidence];

    return {
      name:
        item.value?.operationId ||
        item.value?.summary ||
        item.subject ||
        "Unnamed API operation",

      method: item.value?.method ?? item.value?.httpMethod ?? null,

      endpoint: item.value?.path ?? null,

      request,

      response,

      authentication,

      operationType: "SPECIFICATION_DECLARATION",

      finding: createFinding({
        description:
          "An API operation and its associated request, response and security declarations were extracted from an API specification.",

        assessment: "OBSERVED",
        confidence: "HIGH",

        evidence: findingEvidence,

        limitations: [
          "An API specification describes a declared API contract; it does not prove source-code implementation.",

          "Request parameters and schemas are extracted declarations, not verified runtime request values.",

          "Response schemas and status codes describe documented responses, not actual provider responses.",

          "Declared security requirements do not prove runtime authentication or authorization enforcement.",

          "Runtime behavior and provider compliance have not been verified.",
        ],
      }),
    };
  });
};

const analyzeAuthentication = (evidence) => {
  const authenticationTypes = new Set([
    "AUTHORIZATION_HEADER",
    "AUTHENTICATION_CONFIGURATION",
    "TOKEN_REFERENCE",
    "API_SECURITY_SCHEME",
    "API_OPERATION_SECURITY",
    "API_GLOBAL_SECURITY",
  ]);

  const authenticationEvidence = evidence.filter((item) =>
    authenticationTypes.has(item.evidenceType),
  );

  const schemes = authenticationEvidence.filter(
    (item) => item.evidenceType === "API_SECURITY_SCHEME",
  );

  const operationSecurity = authenticationEvidence.filter(
    (item) => item.evidenceType === "API_OPERATION_SECURITY",
  );

  const globalSecurity = authenticationEvidence.filter(
    (item) => item.evidenceType === "API_GLOBAL_SECURITY",
  );

  const authorizationHeaders = authenticationEvidence.filter(
    (item) => item.evidenceType === "AUTHORIZATION_HEADER",
  );

  const authenticationConfigurations = authenticationEvidence.filter(
    (item) => item.evidenceType === "AUTHENTICATION_CONFIGURATION",
  );

  const tokenReferences = authenticationEvidence.filter(
    (item) => item.evidenceType === "TOKEN_REFERENCE",
  );

  const schemeMap = new Map(
    schemes.map((item) => [item.value?.name ?? item.subject, item]),
  );

  // Only schemes referenced by an API security requirement
  // are treated as applied to an operation or globally.
  const referencedSchemeNames = new Set();

  for (const item of [...operationSecurity, ...globalSecurity]) {
    const requirements = item.value?.requirements ?? [];

    for (const requirement of requirements) {
      for (const scheme of requirement.schemes ?? []) {
        if (scheme.schemeName) {
          referencedSchemeNames.add(scheme.schemeName);
        }
      }
    }
  }

  const referencedSchemes = [...referencedSchemeNames]
    .map((name) => schemeMap.get(name))
    .filter(Boolean);

  const getDeclaredMethod = (scheme) => {
    const type = scheme.value?.type?.toLowerCase();
    const mechanism = scheme.value?.scheme?.toLowerCase();

    if (type === "http" && mechanism === "bearer") {
      return "HTTP Bearer (OpenAPI declaration)";
    }

    if (type === "http" && mechanism === "basic") {
      return "HTTP Basic (OpenAPI declaration)";
    }

    if (type === "apikey") {
      const location = scheme.value?.in ?? "unknown";
      const parameterName = scheme.value?.parameterName ?? "unknown";

      return `API Key (OpenAPI declaration; ${location}: ${parameterName})`;
    }

    if (type === "oauth2") {
      return "OAuth 2.0 (OpenAPI declaration)";
    }

    if (type === "openidconnect") {
      return "OpenID Connect (OpenAPI declaration)";
    }

    return null;
  };

  const declaredMethods = [
    ...new Set(referencedSchemes.map(getDeclaredMethod).filter(Boolean)),
  ];

  const evidenceIds = [
    ...new Set(
      authenticationEvidence.map((item) => item.evidenceId).filter(Boolean),
    ),
  ];

  if (authenticationEvidence.length === 0) {
    return {
      method: null,
      tokenEndpoint: null,
      tokenAcquisition: null,
      tokenRefresh: null,
      finding: createFinding({
        description: "No matching authentication evidence was detected.",
        assessment: "UNKNOWN",
        confidence: "UNKNOWN",
        evidence: [],
        limitations: [
          "No matching authentication evidence was detected.",
          "Absence in the supplied evidence does not prove authentication is absent.",
        ],
      }),
    };
  }

  const descriptions = [];

  if (declaredMethods.length > 0) {
    descriptions.push(
      `The API specification declares: ${declaredMethods.join(", ")}.`,
    );
  }

  if (authorizationHeaders.length > 0) {
    descriptions.push(
      "Source code contains an Authorization header, but its authentication mechanism is unknown.",
    );
  }

  if (authenticationConfigurations.length > 0) {
    descriptions.push(
      "Authentication-related configuration declarations were detected.",
    );
  }

  if (tokenReferences.length > 0) {
    descriptions.push("Token-related references were detected.");
  }

  return {
    method:
      declaredMethods.length === 1
        ? declaredMethods[0]
        : declaredMethods.length > 1
          ? "Multiple declared authentication mechanisms"
          : null,

    // Do not infer OAuth token endpoints or token lifecycle
    // from client credentials or Authorization headers.
    tokenEndpoint: null,
    tokenAcquisition: null,
    tokenRefresh: null,

    finding: createFinding({
      description: descriptions.join(" "),

      // The evidence establishes declarations and source patterns,
      // not successful runtime authentication.
      assessment: "INFERRED",
      confidence: "LOW",

      evidence: authenticationEvidence,

      limitations: [
        "An Authorization header does not establish a valid authentication protocol.",
        "An OpenAPI security scheme establishes a specification declaration, not runtime implementation.",
        "Authentication configuration does not establish successful credential use.",
        "Token acquisition and refresh behavior have not been established.",
        "Runtime authentication behavior has not been verified.",
      ],
    }),
  };
};

const analyzeConfiguration = (evidence) => {
  const configurationTypes = new Set([
    "CONFIGURATION",
    "CONFIGURATION_KEY",
    "CONFIGURATION_DEFAULT",
    "ENVIRONMENT_VARIABLE_DECLARATION",
    "ENVIRONMENT_VARIABLE_REFERENCE",
    "BASE_URL_CONFIGURATION",
    "URL_CONFIGURATION",
    "HTTP_TIMEOUT_CONFIGURATION",
    "TIMEOUT_CONFIGURATION",
    "RETRY_CONFIGURATION",
    "RETRY_PATTERN",
    "IDEMPOTENCY_CONFIGURATION",
    "AUTHENTICATION_CONFIGURATION",
  ]);

  return evidence
    .filter((item) => configurationTypes.has(item.evidenceType))
    .map((item) => ({
      name: item.subject || item.evidenceType,

      evidenceId: item.evidenceId,
      evidenceType: item.evidenceType,

      value: item.value,

      assessment: "OBSERVED",
    }));
};

const analyzeSecurity = (evidence) => {
  const securityTypes = new Set([
    "AUTHORIZATION_HEADER",
    "AUTHENTICATION_CONFIGURATION",
    "TOKEN_REFERENCE",
    "API_SECURITY_SCHEME",
    "API_OPERATION_SECURITY",
    "API_GLOBAL_SECURITY",
    "IDEMPOTENCY_KEY",
    "IDEMPOTENCY_CONFIGURATION",
    "WEBHOOK_SIGNATURE",
    "SECRET_EXPOSURE",
    "SECURITY_CONFIGURATION",
  ]);

  return evidence
    .filter((item) => securityTypes.has(item.evidenceType))
    .map((item) => ({
      name: item.evidenceType,

      finding: createFinding({
        description: `Security-related evidence ${item.evidenceType} was detected.`,

        assessment: "OBSERVED",
        confidence: "MEDIUM",

        evidence: [item],

        limitations: [
          "Detection does not establish that the security control is correctly implemented or effective.",
        ],
      }),
    }));
};

const getLifecycleEvidence = (evidence) => {
  const matches = new Map();

  for (const [state, allowedTypes] of Object.entries(
    LIFECYCLE_EVIDENCE_TYPES,
  )) {
    const matched = evidence.filter((item) =>
      allowedTypes.has(item.evidenceType),
    );

    if (matched.length > 0) {
      matches.set(state, matched);
    }
  }

  // An OpenAPI POST operation may declare a creation operation.
  // It does not prove runtime transaction creation.

  const declaredCreation = evidence.filter((item) => {
    if (item.evidenceType !== "API_OPERATION") {
      return false;
    }

    const method = item.value?.method || item.value?.httpMethod;

    const operationText = [
      item.value?.operationId,
      item.value?.summary,
      item.value?.path,
    ]
      .filter((value) => typeof value === "string")
      .join(" ");

    return (
      method?.toUpperCase() === "POST" &&
      /create|payment|payout|transfer/i.test(operationText)
    );
  });

  if (declaredCreation.length > 0) {
    matches.set("CREATION", [
      ...(matches.get("CREATION") || []),
      ...declaredCreation,
    ]);
  }

  return matches;
};

const analyzeTransactionLifecycle = (evidence) => {
  const lifecycleEvidence = getLifecycleEvidence(evidence);

  return [...lifecycleEvidence.entries()].map(([state, items]) => {
    const uniqueItems = uniqueEvidence(items);

    const isSpecificationOnly = uniqueItems.every(
      (item) => item.sourceCategory === "API_SPECIFICATION",
    );

    return {
      state,

      finding: createFinding({
        description: isSpecificationOnly
          ? `An API specification declares an operation related to the ${state.toLowerCase()} lifecycle stage.`
          : `Evidence associated with the ${state.toLowerCase()} lifecycle stage was detected.`,

        assessment: "INFERRED",
        confidence: "LOW",

        evidence: uniqueItems,

        limitations: [
          "Lifecycle-stage evidence does not establish a complete or successful transaction lifecycle.",

          ...(isSpecificationOnly
            ? [
                "An API specification declaration does not prove source-code implementation or runtime behavior.",
              ]
            : [
                "Static evidence does not establish that the lifecycle stage executes successfully.",
              ]),
        ],
      }),
    };
  });
};

const analyzeIntegration = (groupedResult) => {
  if (!groupedResult?.groups || typeof groupedResult.groups !== "object") {
    throw new Error("Valid grouped evidence is required.");
  }

  // Evidence can belong to multiple groups.
  // Deduplicate before analysis to avoid duplicate findings.

  const evidenceMap = new Map();

  for (const group of Object.values(groupedResult.groups)) {
    if (!Array.isArray(group)) {
      continue;
    }

    for (const item of group) {
      if (item?.evidenceId) {
        evidenceMap.set(item.evidenceId, item);
      }
    }
  }

  const evidence = [...evidenceMap.values()];

  const capabilities = analyzeCapabilities(evidence);

  const apiOperations = analyzeApiOperations(evidence);

  return {
    provider: analyzeProvider(evidence),

    integration: {
      type: analyzeIntegrationType(capabilities),
    },

    capabilities,

    apiOperations,

    authentication: analyzeAuthentication(evidence),

    configuration: analyzeConfiguration(evidence),

    securityFindings: analyzeSecurity(evidence),

    transactionLifecycle: analyzeTransactionLifecycle(evidence),

    summary: {
      totalEvidence: evidence.length,
      detectedCapabilities: capabilities.length,
      detectedApiOperations: apiOperations.length,
    },
  };
};

export default analyzeIntegration;
