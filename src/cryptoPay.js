import { createHmac, createHash, randomBytes, timingSafeEqual } from "node:crypto";

const API = (
  process.env.CRYPTO_PAY_API ||
  "https://pay.crypt.bot/api"
).replace(/\/$/, "");

export function cryptoPayToken() {
  const raw =
    process.env.CRYPTO_PAY_TOKEN ||
    process.env.CRYPTO_PAY_API_TOKEN ||
    process.env.CRYPTOPAY_TOKEN ||
    process.env.CRYPTO_BOT_TOKEN ||
    "";
  const token = String(raw)
    .replace(/^\uFEFF/, "")
    .replace(/[\r\n\t ]+/g, "")
    .replace(/^["']|["']$/g, "")
    .replace(/^Crypto-Pay-API-Token:/i, "")
    .replace(/^Crypto-Pay-API:/i, "")
    .replace(/^Bearer/i, "");
  if (!token) throw new Error("CRYPTO_PAY_TOKEN is missing");
  return token;
}

function authHeaders() {
  const token = cryptoPayToken();
  return {
    "Crypto-Pay-API-Token": token,
    "Crypto-Pay-API": token,
  };
}

async function api(method, body) {
  const hasBody = body && Object.keys(body).length > 0;
  const response = await fetch(`${API}/${method}`, {
    method: hasBody ? "POST" : "GET",
    headers: {
      ...authHeaders(),
      ...(hasBody ? { "Content-Type": "application/json" } : {}),
    },
    body: hasBody ? JSON.stringify(body) : undefined,
  });
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error(`Crypto Pay ${method} HTTP ${response.status}`);
  }
  if (!data?.ok) {
    const name = data?.error?.name || data?.error || `HTTP ${response.status}`;
    if (String(name).toUpperCase().includes("UNAUTHORIZED")) {
      throw new Error(
        "UNAUTHORIZED: Crypto Pay не принял токен. В @send / @CryptoBot открой Crypto Pay → своё приложение → API Token. Вставь в CRYPTO_PAY_TOKEN целиком (цифры:буквы). Не токен BotFather."
      );
    }
    throw new Error(String(name));
  }
  return data.result;
}

export function verifyPaySignature(rawBody, signature) {
  if (!signature) return false;
  const secret = createHash("sha256").update(cryptoPayToken()).digest();
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const left = Buffer.from(expected, "utf8");
  const right = Buffer.from(String(signature), "utf8");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function getMe() {
  return api("getMe");
}

export function createInvoice(fields) {
  return api("createInvoice", fields);
}

export async function getPaidInvoice(invoiceId) {
  const result = await api("getInvoices", {
    invoice_ids: String(invoiceId),
  });
  const invoice = result?.items?.[0] ?? result?.[0] ?? null;
  if (!invoice) return null;
  if (invoice.status !== "paid") return null;
  return invoice;
}

export function newPayload(userId, productId) {
  return JSON.stringify({
    u: userId,
    p: productId,
    n: randomBytes(6).toString("hex"),
  });
}

export function parsePayload(payload) {
  try {
    const data = JSON.parse(payload);
    if (!data?.u || !data?.p) return null;
    return { userId: Number(data.u), productId: String(data.p) };
  } catch {
    return null;
  }
}

export function invoicePayUrl(invoice) {
  return (
    invoice.bot_invoice_url ||
    invoice.mini_app_invoice_url ||
    invoice.pay_url ||
    (invoice.hash ? `https://t.me/send?start=${invoice.hash}` : null)
  );
}

export function tokenDebugInfo() {
  try {
    const token = cryptoPayToken();
    const colon = token.includes(":");
    return `token_len=${token.length} has_colon=${colon} host=${API}`;
  } catch (error) {
    return error.message;
  }
}
