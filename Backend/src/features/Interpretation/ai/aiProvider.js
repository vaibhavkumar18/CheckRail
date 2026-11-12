import { buildInterpretationMessages } from "./interpretationPrompt.js";
import { parseAIInterpretation } from "./interpretationResponse.js";
import config from "../../../config/config.js";
const DEFAULT_MODEL = "openai/gpt-oss-120b";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export const interpretEvidenceWithOpenRouter = async ({
  context,
  normalizedEvidence,
}) => {
  const apiKey = config.OPENROUTER_API_KEY?.trim();
  const model = config.OPENROUTER_MODEL || DEFAULT_MODEL;
  const timeoutMs = Number(config.AI_TIMEOUT_MS || 30000);

  console.log("[OpenRouter Config]", {
    keyPresent: Boolean(apiKey),
    keyLength: apiKey?.length ?? 0,
    hasBearerPrefix: apiKey?.startsWith("Bearer ") ?? false,
    hasWhitespace: apiKey ? apiKey !== config.OPENROUTER_API_KEY : false,
    model,
    timeoutMs,
  });

  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not configured.");
  }

  if (apiKey.startsWith("Bearer ")) {
    throw new Error(
      "OPENROUTER_API_KEY must contain only the API key, without the Bearer prefix.",
    );
  }

  if (!Number.isFinite(timeoutMs) || timeoutMs < 1000) {
    throw new Error("AI_TIMEOUT_MS must be a valid number of at least 1000.");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const headers = {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    };

    // Optional OpenRouter attribution headers.
    if (process.env.OPENROUTER_HTTP_REFERER) {
      headers["HTTP-Referer"] = process.env.OPENROUTER_HTTP_REFERER;
    }

    if (process.env.OPENROUTER_APP_NAME) {
      headers["X-Title"] = process.env.OPENROUTER_APP_NAME;
    }

    const response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        model,
        messages: buildInterpretationMessages(context),
        temperature: 0.1,
        max_tokens: 5000,
        response_format: { type: "json_object" },
      }),
    });

    const body = await response.json().catch(() => null);

    if (!response.ok) {
      const message =
        body?.error?.message ||
        `OpenRouter request failed with HTTP ${response.status}.`;

      const error = new Error(message);
      error.statusCode = response.status;
      error.retryable = response.status === 429 || response.status >= 500;
      throw error;
    }

    const content = body?.choices?.[0]?.message?.content;

    if (typeof content !== "string" || !content.trim()) {
      throw new Error("OpenRouter returned an empty interpretation response.");
    }

    return {
      data: parseAIInterpretation(content, normalizedEvidence),
      provider: "OPENROUTER",
      model: body?.model || model,
      requestId: body?.id ?? null,
      usage: body?.usage ?? null,
    };
  } catch (error) {
    if (error.name === "AbortError") {
      const timeoutError = new Error(
        "OpenRouter interpretation request timed out.",
      );
      timeoutError.code = "AI_TIMEOUT";
      throw timeoutError;
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
};

export default interpretEvidenceWithOpenRouter;
