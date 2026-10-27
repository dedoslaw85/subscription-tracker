import { parseModelJson, SPEND_CATEGORIES, type ScannedReceipt } from "@/lib/receipts/model";

const PROMPT = `You read a photo of a receipt, bill, or subscription invoice.
Reply with JSON only. No markdown.
{
  "readable": boolean,
  "merchant": string,
  "date": "YYYY-MM-DD or empty string",
  "total": number,
  "currency": "ISO code such as GBP",
  "category": one of ${SPEND_CATEGORIES.join(", ")},
  "summary": string,
  "recurring": boolean,
  "frequency": "weekly" or "monthly" or "yearly" or "",
  "items": [{ "name": string, "quantity": number or null, "amount": number or null }]
}
Rules:
- total is the grand total as a number, without a currency symbol.
- Use GBP when the symbol is £.
- category must be exactly one of the listed names.
- summary is one or two plain sentences: who was paid, what for, and the total. No exclamation marks.
- If this is not a receipt, set readable to false, total to 0, and say so in summary.
- date is the date printed on the receipt. Use an empty string if it is missing.
- Include at most 25 line items you can actually read.
- recurring is true only when the receipt is clearly a subscription or repeating bill.`;

const PAUSED =
  "Receipt reading is paused until Grok credits are available. You can type this receipt in instead.";
const FAILED = "That photo couldn’t be read. Try again in a moment.";

type Attempt = { kind: "responses" | "chat"; model: string };

function extractText(body: unknown) {
  if (!body || typeof body !== "object") return "";
  const record = body as Record<string, unknown>;
  if (typeof record.output_text === "string" && record.output_text.trim()) return record.output_text;
  const choices = record.choices;
  if (Array.isArray(choices)) {
    const message = (choices[0] as { message?: { content?: unknown } } | undefined)?.message;
    const content = message?.content;
    if (typeof content === "string") return content;
    if (Array.isArray(content)) {
      return content
        .map((part) =>
          part && typeof part === "object" && typeof (part as { text?: unknown }).text === "string"
            ? (part as { text: string }).text
            : "",
        )
        .join("");
    }
  }
  const output = record.output;
  if (!Array.isArray(output)) return "";
  const chunks: string[] = [];
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const content = (item as { content?: unknown }).content;
    if (typeof content === "string") chunks.push(content);
    if (typeof (item as { text?: unknown }).text === "string") chunks.push((item as { text: string }).text);
    if (!Array.isArray(content)) continue;
    for (const part of content) {
      if (part && typeof part === "object" && typeof (part as { text?: unknown }).text === "string") {
        chunks.push((part as { text: string }).text);
      }
    }
  }
  return chunks.join("\n");
}

function friendlyError(status: number, body: string) {
  let code = "";
  let message = "";
  try {
    const parsed = JSON.parse(body) as { code?: unknown; error?: unknown };
    code = typeof parsed.code === "string" ? parsed.code : "";
    if (typeof parsed.error === "string") message = parsed.error;
    else if (parsed.error && typeof parsed.error === "object") {
      const nested = (parsed.error as { message?: unknown }).message;
      message = typeof nested === "string" ? nested : "";
    }
  } catch {
    message = "";
  }
  const haystack = `${code} ${message}`.toLowerCase();
  if (
    status === 401 ||
    status === 403 ||
    haystack.includes("credit") ||
    haystack.includes("spending") ||
    haystack.includes("quota")
  ) {
    return PAUSED;
  }
  return FAILED;
}

async function postJson(url: string, apiKey: string, body: unknown) {
  const send = () =>
    fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(45_000),
    });
  let response = await send();
  if (response.status === 429 || response.status >= 500) response = await send();
  const text = await response.text();
  return { response, text };
}

function requestBody(attempt: Attempt, image: string) {
  if (attempt.kind === "chat") {
    return {
      model: attempt.model,
      max_tokens: 900,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: PROMPT },
            { type: "image_url", image_url: { url: image, detail: "high" } },
          ],
        },
      ],
    };
  }
  return {
    model: attempt.model,
    max_output_tokens: 900,
    input: [
      {
        role: "user",
        content: [
          { type: "input_image", image_url: image, detail: "high" },
          { type: "input_text", text: PROMPT },
        ],
      },
    ],
  };
}

export async function readWithGrok(
  image: string,
): Promise<{ ok: true; receipt: ScannedReceipt } | { ok: false; error: string }> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) return { ok: false, error: "Receipt reading isn’t available right now." };
  const attempts: Attempt[] = [
    { kind: "responses", model: "grok-4.5" },
    { kind: "chat", model: "grok-4.5" },
  ];
  let lastStatus = 0;
  let lastBody = "";
  for (const attempt of attempts) {
    const url =
      attempt.kind === "responses" ? "https://api.x.ai/v1/responses" : "https://api.x.ai/v1/chat/completions";
    let response: Response;
    let text: string;
    try {
      const result = await postJson(url, apiKey, requestBody(attempt, image));
      response = result.response;
      text = result.text;
    } catch {
      return { ok: false, error: FAILED };
    }
    if (response.ok) {
      let json: unknown;
      try {
        json = JSON.parse(text);
      } catch {
        return { ok: false, error: FAILED };
      }
      const parsed = parseModelJson(extractText(json));
      if (!parsed) return { ok: false, error: FAILED };
      return { ok: true, receipt: parsed };
    }
    lastStatus = response.status;
    lastBody = text.slice(0, 500);
    if (response.status !== 400 && response.status !== 404) break;
  }
  return { ok: false, error: friendlyError(lastStatus, lastBody) };
}
