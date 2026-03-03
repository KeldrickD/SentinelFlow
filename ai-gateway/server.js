/**
 * AI Gateway: real x402 seller (Option B1).
 * Uses x402-express paymentMiddleware: 402 + PAYMENT-REQUIRED, facilitator settlement, 200 + PAYMENT-RESPONSE.
 */
import "dotenv/config";
import express from "express";
import { paymentMiddleware } from "x402-express";

const app = express();
app.use(express.json());

const PORT = Number(process.env.PORT ?? "8080");
const PAY_TO_ADDRESS = process.env.PAY_TO_ADDRESS;
const X402_PRICE = process.env.X402_PRICE ?? "0.01";
const X402_FACILITATOR_URL = process.env.X402_FACILITATOR_URL ?? "https://x402.org/facilitator";

if (!PAY_TO_ADDRESS || !PAY_TO_ADDRESS.startsWith("0x")) {
  console.error("Set PAY_TO_ADDRESS (0x...) in .env");
  process.exit(1);
}

// x402 middleware: only applied to /analyze so /health stays free
const x402 = paymentMiddleware(
  /** @type {`0x${string}`} */ (PAY_TO_ADDRESS),
  {
    "/analyze": {
      price: X402_PRICE,
      network: "base-sepolia",
      config: {
        description: "SentinelFlow AI risk analysis (CRE & AI)",
        resource: "/analyze",
      },
    },
  },
  { url: X402_FACILITATOR_URL }
);

async function callOpenAI(body) {
  const apiKey = process.env.OPENAI_API_KEY ?? process.env.AI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not set");

  const { deviationBps, riskThreshold, pauseThreshold, signalType, executionMode } = body;
  const model = process.env.AI_MODEL ?? "gpt-4o-mini";
  const start = Date.now();

  const systemPrompt = `You are a risk monitoring AI. Return ONLY valid JSON with no prose.
Keys: severity, recommendedAction, confidence, rationale.
severity: one of LOW, MEDIUM, HIGH, CRITICAL.
recommendedAction: one of NO_ACTION, SET_RISK_MODE, PAUSE.
confidence: number between 0.0 and 1.0.`;

  const userPrompt = `Signal: ${signalType ?? "PRICE_DEVIATION_BPS"}
Deviation BPS: ${deviationBps ?? 0}
Risk Threshold: ${riskThreshold ?? 250}
Pause Threshold: ${pauseThreshold ?? 700}
ExecutionMode: ${executionMode ?? "EXECUTE"}
Return JSON only.`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      max_tokens: 250,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI ${res.status}: ${err.slice(0, 200)}`);
  }

  const json = await res.json();
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error("No content in AI response");

  const parsed = JSON.parse(content);
  const latencyMs = Date.now() - start;
  return {
    severity: ["LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(String(parsed.severity).toUpperCase())
      ? String(parsed.severity).toUpperCase()
      : "LOW",
    recommendedAction: ["NO_ACTION", "SET_RISK_MODE", "PAUSE"].includes(
      String(parsed.recommendedAction).toUpperCase()
    )
      ? String(parsed.recommendedAction).toUpperCase()
      : "NO_ACTION",
    confidence: Math.min(1, Math.max(0, Number(parsed.confidence) || 0)),
    rationale: String(parsed.rationale ?? "").slice(0, 500),
    provider: "openai",
    model,
    latencyMs,
  };
}

app.post("/analyze", x402, async (req, res) => {
  try {
    const result = await callOpenAI(req.body);
    return res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("AI Gateway error:", message);
    return res.status(500).json({ error: "AI inference failed", message });
  }
});

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    x402: true,
    facilitator: X402_FACILITATOR_URL,
    payTo: PAY_TO_ADDRESS,
    price: X402_PRICE,
    network: "base-sepolia",
  });
});

app.listen(PORT, () => {
  console.log(
    `SentinelFlow AI Gateway on port ${PORT} (x402 seller, payTo=${PAY_TO_ADDRESS}, facilitator=${X402_FACILITATOR_URL})`
  );
});
