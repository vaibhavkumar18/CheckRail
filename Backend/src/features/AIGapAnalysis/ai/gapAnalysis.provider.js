
import config from "../../../config/config.js";
import { buildGapAnalysisMessages } from "./gapAnalysis.prompt.js";
import { parseGapAnalysisResponse } from "./gapAnalysis.schema.js";

const OPENROUTER_URL =
  "https://openrouter.ai/api/v1/chat/completions";

const getError = (message, code, statusCode = 502) => {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
};

const extractContent = (content) => {
  if (typeof content === "string") {
    return content.trim();
  }

  // Some API-compatible responses may return content blocks.
  if (Array.isArray(content)) {
    return content
      .filter((item) => item?.type === "text" && typeof item.text === "string")
      .map((item) => item.text)
      .join("\n")
      .trim();
  }

  return "";
};

export const generateGapAnalysisWithOpenRouter = async ({
  context,
  validEvidenceRefs,
}) => {
  const enabled =
    String(config.AI_ENABLED).toLowerCase() === "true";

  if (!enabled) {
    throw getError(
      "AI Gap Analysis is disabled by AI_ENABLED configuration.",
      "AI_DISABLED",
      503,
    );
  }

  const provider = String(config.AI_PROVIDER || "")
    .trim()
    .toLowerCase();

  if (provider !== "openrouter") {
    throw getError(
      `Unsupported AI_PROVIDER: ${provider || "not configured"}.`,
      "UNSUPPORTED_AI_PROVIDER",
      503,
    );
  }

  const apiKey = config.OPENROUTER_API_KEY?.trim();

  if (!apiKey || apiKey.startsWith("Bearer ")) {
    throw getError(
      "OPENROUTER_API_KEY is missing or incorrectly configured.",
      "OPENROUTER_CONFIGURATION_ERROR",
      503,
    );
  }

  const model =
    config.OPENROUTER_MODEL || "openai/gpt-oss-120b";

  // Allow enough time for larger evidence-based assessments.
  const timeoutMs = Number(config.AI_TIMEOUT_MS || 60000);

  if (!Number.isFinite(timeoutMs) || timeoutMs < 1000) {
    throw getError(
      "AI_TIMEOUT_MS must be a valid number of at least 1000.",
      "AI_CONFIGURATION_ERROR",
      500,
    );
  }

  const controller = new AbortController();

  const timeout = setTimeout(
    () => controller.abort(),
    timeoutMs,
  );

  try {
    const headers = {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    };

    if (process.env.OPENROUTER_HTTP_REFERER) {
      headers["HTTP-Referer"] =
        process.env.OPENROUTER_HTTP_REFERER;
    }

    if (process.env.OPENROUTER_APP_NAME) {
      headers["X-Title"] =
        process.env.OPENROUTER_APP_NAME;
    }

    const messages = buildGapAnalysisMessages(
      context,
      validEvidenceRefs,
    );

    const response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        model,
        messages,
        temperature: 0,
        max_tokens: 7000,
        response_format: {
          type: "json_object",
        },
      }),
    });

    const body = await response.json().catch(() => null);

    if (!response.ok) {
      console.error("OpenRouter HTTP request failed:", {
        httpStatus: response.status,
        model,
        error: body?.error || null,
        requestId: body?.id || null,
      });

      throw getError(
        body?.error?.message ||
          `OpenRouter request failed with HTTP ${response.status}.`,
        "OPENROUTER_REQUEST_FAILED",
        response.status >= 500 ? 502 : response.status,
      );
    }

    const choice = body?.choices?.[0];
    const message = choice?.message;
    const finishReason = choice?.finish_reason || null;

    const content = extractContent(message?.content);

    // Log metadata only. Never log credentials, prompts, or full evidence.
    if (!content) {
      const diagnostic = {
        model: body?.model || model,
        requestId: body?.id || null,
        provider: body?.provider || null,
        finishReason,
        messageKeys: message
          ? Object.keys(message)
          : [],
        contentType: typeof message?.content,
        contentLength:
          typeof message?.content === "string"
            ? message.content.length
            : Array.isArray(message?.content)
              ? message.content.length
              : 0,
        reasoningPresent: Boolean(
          message?.reasoning || message?.reasoning_details,
        ),
        reasoningLength:
          typeof message?.reasoning === "string"
            ? message.reasoning.length
            : null,
        usage: body?.usage || null,
      };

      console.error(
        "OpenRouter returned no usable Gap Analysis content:",
        diagnostic,
      );

      if (finishReason === "length") {
        throw getError(
          "OpenRouter exhausted the output token limit before producing the Gap Analysis JSON. Increase the output budget or reduce the assessment context.",
          "AI_OUTPUT_TRUNCATED",
          502,
        );
      }

      if (body?.error) {
        throw getError(
          body.error.message ||
            "OpenRouter returned a provider error.",
          "OPENROUTER_PROVIDER_ERROR",
          502,
        );
      }

      throw getError(
        "OpenRouter returned no usable Gap Analysis content. Check the provider response diagnostics.",
        "AI_EMPTY_RESPONSE",
        502,
      );
    }

    let parsedData;

    try {
      parsedData = parseGapAnalysisResponse(
        content,
        validEvidenceRefs,
      );
    } catch (error) {
      if (error.code === "AI_INVALID_EVIDENCE_REFERENCE") {
        console.error(
          "AI returned invalid evidence references:",
          error.invalidEvidenceRefs || [],
        );
      }

      if (error.code === "AI_SCHEMA_VALIDATION_FAILED") {
        console.error(
          "AI Gap Analysis schema validation failed:",
          error.details || null,
        );
      }

      throw error;
    }

    return {
      data: parsedData,
      provider: "OPENROUTER",
      model: body?.model || model,
      requestId: body?.id || null,
      usage: body?.usage || null,
    };
  } catch (error) {
    if (error.name === "AbortError") {
      console.error("OpenRouter Gap Analysis timed out:", {
        model,
        timeoutMs,
      });

      throw getError(
        `OpenRouter Gap Analysis request timed out after ${timeoutMs}ms.`,
        "AI_TIMEOUT",
        504,
      );
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
};
