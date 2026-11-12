import config from "../config/config.js";

const apiKey = config.OPENROUTER_API_KEY?.trim();

console.log("Environment diagnostics:", {
  keyExists: Boolean(apiKey),
  keyLength: apiKey?.length ?? 0,
  startsWithBearer: apiKey?.startsWith("Bearer ") ?? false,
  model: config.OPENROUTER_MODEL,
});
console.log("Key format:", {
  prefix: apiKey?.slice(0, 9),
  length: apiKey?.length,
});

if (!apiKey) {
  throw new Error("OPENROUTER_API_KEY is missing.");
}

const headers = new Headers({
  Authorization: `Bearer ${apiKey}`,
  "Content-Type": "application/json",
});

console.log("Request header diagnostics:", {
  authorizationExists: headers.has("authorization"),
  authorizationStartsWithBearer:
    headers.get("authorization")?.startsWith("Bearer ") ?? false,
  authorizationLength:
    headers.get("authorization")?.length ?? 0,
});

const response = await fetch(
  "https://openrouter.ai/api/v1/chat/completions",
  {
    method: "POST",
    headers,
    redirect: "manual",
    body: JSON.stringify({
      model: config.OPENROUTER_MODEL,
      messages: [
        {
          role: "user",
          content: 'Return JSON only: {"status":"ok"}',
        },
      ],
      response_format: { type: "json_object" },
    }),
  },
);

console.log("Response diagnostics:", {
  status: response.status,
  redirected: response.redirected,
  responseUrl: response.url,
});

const result = await response.json().catch(() => null);

if (!response.ok) {
  console.error("OpenRouter error:", result?.error?.message ?? result);
} else {
  console.log("OpenRouter success:", result?.choices?.[0]?.message?.content);
}