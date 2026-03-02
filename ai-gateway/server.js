/**
 * AI Gateway: x402 payment-gated POST /analyze for CRE & AI track.
 * CRE workflow can call this endpoint with X402_PAYMENT_TOKEN header instead of OpenAI directly.
 * Set OPENAI_API_KEY in .env; for x402 pass token in x402-payment header.
 */
import express from "express";

const app = express();
app.use(express.json());

const PORT = Number(process.env.PORT ?? "8080");
const X402_REQUIRED = process.env.X402_REQUIRE_PAYMENT !== "false";

function verifyX402Payment(req) {
  const token = req.headers["x402-payment"];
  if (!X402_REQUIRED) return true;
  return Boolean(token && String(token).length > 0);
}

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

app.post("/analyze", async (req, res) => {
  if (!verifyX402Payment(req)) {
    return res.status(402).json({
      error: "Payment Required (x402)",
      message: "Include x402-payment header with valid token.",
    });
  }

  try {
    const result = await callOpenAI(req.body);
    return res.json(result);
  } catch (err) {
    console.error("AI Gateway error:", err.message);
    return res.status(500).json({ error: "AI inference failed", message: err.message });
  }
});

app.get("/health", (req, res) => {
  res.json({ status: "ok", x402Required: X402_REQUIRED });
});

app.listen(PORT, () => {
  console.log(`SentinelFlow AI Gateway on port ${PORT} (x402 required: ${X402_REQUIRED})`);
});
