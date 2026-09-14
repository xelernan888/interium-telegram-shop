import { createHmac, createHash, randomBytes, timingSafeEqual } from "node:crypto";

const API =
  process.env.CRYPTO_PAY_API?.trim() || "https://pay.crypt.bot/api";

export function cryptoPayToken() {
  const token = process.env.CRYPTO_PAY_TOKEN?.trim();
  if (!token) throw new Error("CRYPTO_PAY_TOKEN is missing");
  return token;
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

async function api(method, body) {
  const response = await fetch(`${API}/${method}`, {
    method: body ? "POST" : "GET",
    headers: {
      "Crypto-Pay-API": cryptoPayToken(),
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json();
  if (!data?.ok) {
    throw new Error(data?.error?.name || data?.error || `Crypto Pay ${method} failed`);
  }
  return data.result;
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
    (invoice.hash ? `https://t.me/CryptoBot?start=${invoice.hash}` : null)
  );
}
