import { createHmac, createHash, randomBytes, timingSafeEqual } from "node:crypto";

const HOSTS = [
  process.env.CRYPTO_PAY_API?.replace(/\/$/, ""),
  "https://pay.crypt.bot/api",
  "https://testnet-pay.crypt.bot/api",
  "https://pay.send.tg/api",
].filter(Boolean);

const HEADER_NAMES = ["Crypto-Pay-API-Token", "Crypto-Pay-API"];

/** @type {{ host: string, header: string } | null} */
let session = null;

function cleanToken(raw) {
  return String(raw || "")
    .replace(/^\uFEFF/, "")
    .replace(/[\r\n\t ]+/g, "")
    .replace(/^["']|["']$/g, "")
    .replace(/^Crypto-Pay-API-Token:/i, "")
    .replace(/^Crypto-Pay-API:/i, "")
    .replace(/^Bearer/i, "");
}

export function cryptoPayTokenName() {
  const keys = Object.keys(process.env).filter((key) =>
    /^(CRYPTO_PAY_TOKEN|CRYPTO_PAY_API_TOKEN|CRYPTOPAY_TOKEN|CRYPTO_BOT_TOKEN)$/i.test(
      key
    )
  );
  return keys[0] || null;
}

export function cryptoPayToken() {
  const named =
    process.env.CRYPTO_PAY_TOKEN ||
    process.env.CRYPTO_PAY_API_TOKEN ||
    process.env.CRYPTOPAY_TOKEN ||
    process.env.CRYPTO_BOT_TOKEN ||
    "";
  const token = cleanToken(named);
  if (!token) throw new Error("CRYPTO_PAY_TOKEN is missing");
  return token;
}

export function tokenLooksLikeTelegram() {
  const pay = cleanToken(
    process.env.CRYPTO_PAY_TOKEN || process.env.CRYPTO_PAY_API_TOKEN || ""
  );
  const tg = cleanToken(process.env.TELEGRAM_BOT_TOKEN || "");
  return Boolean(pay && tg && pay === tg);
}

async function probe() {
  const token = cryptoPayToken();
  const errors = [];
  for (const host of [...new Set(HOSTS)]) {
    for (const header of HEADER_NAMES) {
      for (const method of ["GET", "POST"]) {
        try {
          const response = await fetch(`${host}/getMe`, {
            method,
            headers: {
              [header]: token,
              ...(method === "POST"
                ? { "Content-Type": "application/json" }
                : {}),
            },
            body: method === "POST" ? "{}" : undefined,
          });
          const data = await response.json().catch(() => ({}));
          if (data?.ok) {
            session = { host, header };
            console.log(`Crypto Pay OK via ${method} ${host} header=${header}`);
            return data.result;
          }
          const name = data?.error?.name || data?.error || response.status;
          errors.push(`${method} ${host} [${header}] -> ${name}`);
        } catch (error) {
          errors.push(`${method} ${host} [${header}] -> ${error.message}`);
        }
      }
    }
  }
  throw new Error(`UNAUTHORIZED. Tried:\n${errors.join("\n")}`);
}

async function api(method, body) {
  if (!session) await probe();
  const hasBody = body && Object.keys(body).length > 0;
  const response = await fetch(`${session.host}/${method}`, {
    method: hasBody ? "POST" : "GET",
    headers: {
      [session.header]: cryptoPayToken(),
      ...(hasBody ? { "Content-Type": "application/json" } : {}),
    },
    body: hasBody ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!data?.ok) {
    session = null;
    const name = data?.error?.name || data?.error || `HTTP ${response.status}`;
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
  return probe();
}

export function createInvoice(fields) {
  return api("createInvoice", fields);
}

export function deleteInvoice(invoiceId) {
  return api("deleteInvoice", { invoice_id: Number(invoiceId) }).catch(
    () => null
  );
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
    return [
      `env=${cryptoPayTokenName() || "none"}`,
      `token_len=${token.length}`,
      `has_colon=${token.includes(":")}`,
      `same_as_telegram=${tokenLooksLikeTelegram()}`,
    ].join(" ");
  } catch (error) {
    return error.message;
  }
}
