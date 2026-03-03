/**
 * x402 buyer: wrap fetch to auto handle 402 → pay → retry (Option B1).
 * Uses @x402/fetch + @x402/evm with Base Sepolia (eip155:84532).
 */
import { wrapFetchWithPaymentFromConfig } from "@x402/fetch";
import { ExactEvmScheme } from "@x402/evm";
import { privateKeyToAccount } from "viem/accounts";

const BASE_SEPOLIA_NETWORK = "eip155:84532";

let cachedPaidFetch: typeof fetch | null = null;

function getPaidFetch(): typeof fetch | null {
  const key = process.env.X402_BUYER_EVM_PRIVATE_KEY;
  if (!key || !key.startsWith("0x")) return null;
  if (cachedPaidFetch) return cachedPaidFetch;
  try {
    const account = privateKeyToAccount(key as `0x${string}`);
    cachedPaidFetch = wrapFetchWithPaymentFromConfig(fetch, {
      schemes: [
        {
          network: BASE_SEPOLIA_NETWORK,
          client: new ExactEvmScheme(account),
        },
      ],
    });
    return cachedPaidFetch;
  } catch (e) {
    console.error("x402 paid fetch init failed:", e);
    return null;
  }
}

export type PaidGatewayResult = {
  data: Record<string, unknown>;
  paymentResponseHeader: string | null;
  status: number;
};

/**
 * POST to x402 gateway; on 402 the wrapped fetch pays and retries, returns 200 + body.
 * If X402_BUYER_EVM_PRIVATE_KEY is not set, returns null and caller should fall back.
 */
export async function paidGatewayPost(
  url: string,
  body: Record<string, unknown>,
  log?: (msg: string) => void
): Promise<PaidGatewayResult | null> {
  const paidFetch = getPaidFetch();
  if (!paidFetch) return null;

  const res = await paidFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const paymentResponseHeader = res.headers.get("PAYMENT-RESPONSE") ?? res.headers.get("payment-response") ?? null;
  if (log) {
    if (res.status === 402) log("AI Gateway returned 402 (PAYMENT-REQUIRED); paid fetch will retry with PAYMENT-SIGNATURE");
    if (res.ok && paymentResponseHeader) log("AI Gateway 200 with PAYMENT-RESPONSE (x402 settlement)");
  }

  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { data, paymentResponseHeader, status: res.status };
}
