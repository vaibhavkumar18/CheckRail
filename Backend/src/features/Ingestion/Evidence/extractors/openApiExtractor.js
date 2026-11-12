const HTTP_METHODS = new Set([
  "get",
  "post",
  "put",
  "patch",
  "delete",
  "options",
  "head",
  "trace",
]);

const escapeJsonPathKey = (key) =>
  String(key).replace(/\\/g, "\\\\").replace(/'/g, "\\'");

const makePathReference = (path, method, section) => {
  const base = `$.paths['${escapeJsonPathKey(path)}'].${method}`;

  return section ? `${base}.${section}` : base;
};

const normalizeSecuritySchemes = (document, version) => {
  if (version === "OPENAPI_3") {
    return document.components?.securitySchemes ?? {};
  }

  return document.securityDefinitions ?? {};
};

const extractServers = (document, version) => {
  if (version === "OPENAPI_3") {
    return (document.servers ?? []).map((server, index) => ({
      url: server.url ?? null,
      description: server.description ?? null,
      variables: server.variables ?? {},
      sourceReference: `$.servers[${index}]`,
    }));
  }

  const schemes = document.schemes?.length
    ? document.schemes
    : ["https", "http"];

  const host = document.host ?? null;
  const basePath = document.basePath ?? "";

  if (!host) {
    return basePath
      ? [
          {
            url: basePath,
            description: "Swagger base path; host was not specified.",
            sourceReference: "$.basePath",
          },
        ]
      : [];
  }

  return schemes.map((scheme) => ({
    url: `${scheme}://${host}${basePath}`,
    description: null,
    sourceReference: "$.host",
  }));
};

const extractSecuritySchemeDetails = (securitySchemes) => {
  return Object.entries(securitySchemes).map(([name, scheme]) => ({
    name,
    type: scheme.type ?? null,
    scheme: scheme.scheme ?? null,
    bearerFormat: scheme.bearerFormat ?? null,
    in: scheme.in ?? null,
    parameterName: scheme.name ?? null,
    openIdConnectUrl: scheme.openIdConnectUrl ?? null,
    flows: scheme.flows ?? null,
    description: scheme.description ?? null,
    sourceReference: null,
  }));
};

const extractSecurityRequirements = (security) => {
  if (!Array.isArray(security)) {
    return [];
  }

  return security.map((requirement, index) => ({
    alternative: index + 1,
    schemes: Object.entries(requirement ?? {}).map(([schemeName, scopes]) => ({
      schemeName,
      scopes: Array.isArray(scopes) ? scopes : [],
    })),
  }));
};

const extractParameters = (parameters, sourceReference) => {
  if (!Array.isArray(parameters)) {
    return [];
  }

  return parameters.map((parameter, index) => ({
    name: parameter.name ?? null,
    in: parameter.in ?? null,
    required: Boolean(parameter.required),
    description: parameter.description ?? null,
    type: parameter.type ?? parameter.schema?.type ?? null,
    format: parameter.format ?? parameter.schema?.format ?? null,
    schema: parameter.schema ?? null,
    reference: parameter.$ref ?? null,
    sourceReference: `${sourceReference}[${index}]`,
  }));
};

const extractOpenApiRequestBody = (operation, operationReference) => {
  const requestBody = operation.requestBody;

  if (!requestBody) {
    return null;
  }

  const content = Object.entries(requestBody.content ?? {}).map(
    ([mediaType, mediaTypeObject]) => ({
      mediaType,
      schema: mediaTypeObject.schema ?? null,
      example: mediaTypeObject.example ?? null,
      examples: mediaTypeObject.examples ?? null,
    }),
  );

  return {
    required: Boolean(requestBody.required),
    description: requestBody.description ?? null,
    reference: requestBody.$ref ?? null,
    content,
    sourceReference: `${operationReference}.requestBody`,
  };
};

const extractSwaggerRequestBody = (parameters, operationReference) => {
  const bodyParameter = parameters.find((parameter) => parameter.in === "body");

  if (bodyParameter) {
    return {
      required: Boolean(bodyParameter.required),
      description: bodyParameter.description ?? null,
      content: [
        {
          mediaType: "application/json",
          schema: bodyParameter.schema ?? null,
        },
      ],
      sourceReference: `${operationReference}.parameters`,
    };
  }

  const formParameters = parameters.filter(
    (parameter) => parameter.in === "formData",
  );

  if (formParameters.length > 0) {
    return {
      required: formParameters.some((parameter) => parameter.required),
      description: "Form-data parameters from Swagger 2.0.",
      content: [
        {
          mediaType: "multipart/form-data",
          schema: null,
        },
      ],
      formParameters: extractParameters(
        formParameters,
        `${operationReference}.parameters`,
      ),
      sourceReference: `${operationReference}.parameters`,
    };
  }

  return null;
};

const extractResponses = (responses, operationReference, version) => {
  if (!responses || typeof responses !== "object") {
    return [];
  }

  return Object.entries(responses).map(([statusCode, response]) => {
    const content =
      version === "OPENAPI_3"
        ? Object.entries(response.content ?? {}).map(
            ([mediaType, mediaTypeObject]) => ({
              mediaType,
              schema: mediaTypeObject.schema ?? null,
              example: mediaTypeObject.example ?? null,
            }),
          )
        : response.schema
          ? [
              {
                mediaType: "application/json",
                schema: response.schema,
              },
            ]
          : [];

    return {
      statusCode,
      description: response.description ?? null,
      reference: response.$ref ?? null,
      headers: Object.keys(response.headers ?? {}),
      content,
      sourceReference: `${operationReference}.responses['${escapeJsonPathKey(statusCode)}']`,
    };
  });
};

const detectVersion = (document) => {
  if (typeof document.openapi === "string" && /^3\./.test(document.openapi)) {
    return "OPENAPI_3";
  }

  if (typeof document.swagger === "string" && document.swagger === "2.0") {
    return "SWAGGER_2";
  }

  throw new Error(
    "Unsupported API specification. Expected OpenAPI 3.x or Swagger 2.0.",
  );
};

export const extractOpenApiEvidence = (
  document,
  relativePath = "openapi.json",
) => {
  if (!document || typeof document !== "object" || Array.isArray(document)) {
    throw new Error("API specification must be a valid parsed object.");
  }

  const version = detectVersion(document);

  const securitySchemes = normalizeSecuritySchemes(document, version);

  const operations = [];

  for (const [apiPath, pathItem] of Object.entries(document.paths ?? {})) {
    if (!pathItem || typeof pathItem !== "object") {
      continue;
    }

    const pathParameters = pathItem.parameters ?? [];

    for (const [method, operation] of Object.entries(pathItem)) {
      const normalizedMethod = method.toLowerCase();

      if (
        !HTTP_METHODS.has(normalizedMethod) ||
        !operation ||
        typeof operation !== "object"
      ) {
        continue;
      }

      const operationReference = makePathReference(apiPath, normalizedMethod);

      const operationParameters = operation.parameters ?? [];

      const parameters = [
        ...extractParameters(
          pathParameters,
          `$.paths['${escapeJsonPathKey(apiPath)}'].parameters`,
        ),
        ...extractParameters(
          operationParameters,
          `${operationReference}.parameters`,
        ),
      ];

      const security = Object.prototype.hasOwnProperty.call(
        operation,
        "security",
      )
        ? operation.security
        : document.security;

      const requestBody =
        version === "OPENAPI_3"
          ? extractOpenApiRequestBody(operation, operationReference)
          : extractSwaggerRequestBody(operationParameters, operationReference);

      operations.push({
        path: apiPath,
        method: normalizedMethod.toUpperCase(),
        operationId: operation.operationId ?? null,
        summary: operation.summary ?? null,
        description: operation.description ?? null,
        tags: operation.tags ?? [],
        deprecated: Boolean(operation.deprecated),

        parameters,

        requestBody,

        responses: extractResponses(
          operation.responses,
          operationReference,
          version,
        ),

        security: {
          source: Object.prototype.hasOwnProperty.call(operation, "security")
            ? "OPERATION"
            : Object.prototype.hasOwnProperty.call(document, "security")
              ? "GLOBAL"
              : "UNSPECIFIED",
          requirements: extractSecurityRequirements(security),
        },

        sourceReference: operationReference,
      });
    }
  }

  return {
    evidenceType: "API_SPECIFICATION",
    specificationVersion: version,
    specification: {
      title: document.info?.title ?? null,
      version: document.info?.version ?? null,
      description: document.info?.description ?? null,
    },

    source: {
      file: relativePath,
      format: "PARSED_API_SPECIFICATION",
    },

    servers: extractServers(document, version),

    securitySchemes: extractSecuritySchemeDetails(securitySchemes),

    globalSecurity: extractSecurityRequirements(document.security),

    operations,

    summary: {
      endpointCount: operations.length,
      methods: [...new Set(operations.map((operation) => operation.method))],
      securitySchemeCount: Object.keys(securitySchemes).length,
    },
  };
};
