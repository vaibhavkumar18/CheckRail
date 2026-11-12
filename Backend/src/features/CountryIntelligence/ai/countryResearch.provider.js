
import config from "../../../config/config.js";

import {
  buildCountryResearchMessages,
} from "./countryResearch.prompt.js";

import {
  CountryResearchStructuredOutputSchema,
  parseCountryResearchResponse,
} from "../extraction/countryResearch.schema.js";

const OPENROUTER_URL =
  "https://openrouter.ai/api/v1/chat/completions";

const extractTextContent = (content) => {
  if (typeof content === "string") {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === "string") return item;

        if (typeof item?.text === "string") {
          return item.text;
        }

        return "";
      })
      .filter(Boolean)
      .join("\n")
      .trim();
  }

  return "";
};

export const interpretCountrySources = async ({
  countryName,
  countryCode,
  sources,
}) => {
  const apiKey = config.OPENROUTER_API_KEY?.trim();

  const model = config.OPENROUTER_MODEL;

  const timeoutMs = Number(
    config.AI_TIMEOUT_MS || 45000
  );

  if (!apiKey) {
    throw new Error(
      "OPENROUTER_API_KEY is not configured."
    );
  }

  if (apiKey.startsWith("Bearer ")) {
    throw new Error(
      "OPENROUTER_API_KEY must contain only the API key, without the Bearer prefix."
    );
  }

  if (!model) {
    throw new Error(
      "OPENROUTER_MODEL is not configured."
    );
  }

  if (!Number.isFinite(timeoutMs) || timeoutMs < 1000) {
    throw new Error(
      "AI_TIMEOUT_MS must be at least 1000."
    );
  }

  if (!Array.isArray(sources) || sources.length < 2) {
    throw new Error(
      "Insufficient source evidence for country research."
    );
  }

  console.log(
    "[Country Intelligence: OpenRouter]",
    {
      countryCode,
      countryName,
      model,
      sourceCount: sources.length,
      timeoutMs,
      structuredOutput: true,
    }
  );

  const response = await fetch(
    OPENROUTER_URL,
    {
      method: "POST",

      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",

        ...(process.env.OPENROUTER_HTTP_REFERER
          ? {
              "HTTP-Referer":
                process.env.OPENROUTER_HTTP_REFERER,
            }
          : {}),

        ...(process.env.OPENROUTER_APP_NAME
          ? {
              "X-Title":
                process.env.OPENROUTER_APP_NAME,
            }
          : {}),
      },

      body: JSON.stringify({
        model,

        messages: buildCountryResearchMessages({
          countryName,
          countryCode,
          sources,
        }),

        temperature: 0.1,
        max_tokens: 7000,

        // Structured Outputs generated from Zod.
        response_format: {
          type: "json_schema",

          json_schema: {
            name: "corridorgate_country_intelligence",
            strict: true,
            schema:
              CountryResearchStructuredOutputSchema,
          },
        },

        // Require a provider endpoint that supports the parameters.
        provider: {
          require_parameters: true,
        },
      }),

      signal: AbortSignal.timeout(timeoutMs),
    }
  );

  const rawResponse = await response.text();

  let body;

  try {
    body = rawResponse
      ? JSON.parse(rawResponse)
      : null;
  } catch {
    console.error(
      "[OpenRouter: Non-JSON response]",
      {
        httpStatus: response.status,
        statusText: response.statusText,
        responseBody: rawResponse.slice(0, 3000),
      }
    );

    throw new Error(
      `OpenRouter returned a non-JSON response. HTTP ${response.status}.`
    );
  }

  if (!response.ok) {
    console.error(
      "[OpenRouter: Structured output request failed]",
      {
        httpStatus: response.status,
        model,
        error: body?.error || null,
      }
    );

    const error = new Error(
      body?.error?.message ||
        `OpenRouter country research failed with HTTP ${response.status}.`
    );

    error.statusCode = response.status;

    error.retryable =
      response.status === 429 ||
      response.status >= 500;

    error.code =
      "OPENROUTER_STRUCTURED_OUTPUT_FAILED";

    throw error;
  }

  const choice = body?.choices?.[0];

  const message = choice?.message;

  const content = extractTextContent(
    message?.content
  );

  if (!content) {
    const error = new Error(
      `OpenRouter returned no structured content. Finish reason: ${
        choice?.finish_reason || "unknown"
      }.`
    );

    error.code = "OPENROUTER_EMPTY_CONTENT";

    error.refusal = message?.refusal || null;

    throw error;
  }

  let parsedData;

  try {
    parsedData = parseCountryResearchResponse(
      content,
      sources,
      {
        countryCode,
        countryName,
      }
    );
  } catch (parseError) {
    console.error(
      "[Country Intelligence: Structured output validation failed]",
      {
        requestId: body?.id || null,
        model: body?.model || model,
        finishReason: choice?.finish_reason || null,
        contentLength: content.length,
        parseError: parseError.message,
        validationIssues: parseError.details || [],
        invalidSourceIds:
          parseError.invalidSourceIds || [],
        expectedCountry: {
          countryCode,
          countryName,
        },
        actualCountry:
          parseError.actualCountry || null,
      }
    );

    throw parseError;
  }

  return {
    data: parsedData,
    model: body?.model || model,
    requestId: body?.id || null,
    usage: body?.usage || null,
  };
};
