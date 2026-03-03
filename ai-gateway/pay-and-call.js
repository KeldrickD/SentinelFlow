/**
 * Paid x402 proof: calls the AI gateway with @x402/fetch (auto pay + retry).
 * Run with gateway up: npm start (in another terminal), then node pay-and-call.js
 * Requires: .env with X402_BUYER_EVM_PRIVATE_KEY (0x...) funded on Base Sepolia.
 * Uses v1 scheme to match x402-express (server) 402 response.
 */
import "dotenv/config";
import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { ExactEvmSchemeV1 } from "@x402/evm/v1";
import { privateKeyToAccount } from "viem/accounts";

function tryDecodePaymentResponse(v) {
  if (!v) return null;
  try {
    const buf = Buffer.from(v, "base64");
    const txt = buf.toString("utf8");
    if (txt.trim().startsWith("{")) return JSON.parse(txt);
    return null;
  } catch {
    return null;
  }
}

const GATEWAY_URL = process.env.GATEWAY_URL ?? "http://localhost:8080/analyze";
// x402-express sends "base-sepolia" in 402 accepts; use v1 scheme which supports that
const BASE_SEPOLIA = "base-sepolia";

const keyRaw = (process.env.X402_BUYER_EVM_PRIVATE_KEY ?? "").trim();
const key = keyRaw.startsWith("0x") ? keyRaw : keyRaw ? `0x${keyRaw}` : "";
if (!key || !key.startsWith("0x")) {
  console.error("Set X402_BUYER_EVM_PRIVATE_KEY (0x...) in ai-gateway/.env");
  process.exit(1);
}

const deviationBps = Number(process.env.DEVIATION_BPS ?? 100);
const account = privateKeyToAccount(key);

const paidFetch = wrapFetchWithPaymentFromConfig(fetch, {
  schemes: [
    { x402Version: 1, network: BASE_SEPOLIA, client: new ExactEvmSchemeV1(account) },
  ],
});

const body = {
  deviationBps,
  riskThreshold: 250,
  pauseThreshold: 700,
  signalType: "PRICE_DEVIATION_BPS",
  executionMode: "EXECUTE",
};

console.log("Calling", GATEWAY_URL, "with x402 paid fetch...");
console.log("Payload:", body);

const res = await paidFetch(GATEWAY_URL, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

console.log("\nStatus:", res.status);
console.log("=== Headers ===");
for (const [k, v] of res.headers.entries()) {
  console.log(`${k}: ${v}`);
}

const paymentResponse =
  res.headers.get("PAYMENT-RESPONSE") ??
  res.headers.get("X-PAYMENT-RESPONSE") ??
  res.headers.get("payment-response") ??
  res.headers.get("x-payment-response") ??
  res.headers.get("Payment-Response");

if (paymentResponse) {
  const decoded = tryDecodePaymentResponse(paymentResponse);
  if (decoded) console.log("PAYMENT-RESPONSE (decoded):", decoded);
  else console.log("PAYMENT-RESPONSE (raw):", paymentResponse);
} else {
  console.log("PAYMENT-RESPONSE: <missing>");
}

const data = await res.json().catch(() => ({}));
console.log("\nBody:", JSON.stringify(data, null, 2));

if (res.ok) {
  console.log("\n✅ 200 + PAYMENT-RESPONSE — paid x402 proof complete.");
} else {
  console.error("\n❌ Unexpected status:", res.status);
  process.exit(1);
}
