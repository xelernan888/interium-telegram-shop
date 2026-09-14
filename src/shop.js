import { randomBytes } from "node:crypto";
import {
  createInvoice,
  getPaidInvoice,
  invoicePayUrl,
  newPayload,
  parsePayload,
} from "./cryptoPay.js";
import { PRODUCTS, priceFor, productById } from "./products.js";
import { getOrder, saveOrder, takeKey } from "./store.js";
import {
  payKeyboard,
  sendMessage,
} from "./telegram.js";

const currency = () =>
  (process.env.CURRENCY || "USD").toUpperCase() === "RUB" ? "RUB" : "USD";

function issueKey(product) {
  const pooled = takeKey();
  if (pooled) return String(pooled).trim();
  const stamp = randomBytes(4).toString("hex").toUpperCase();
  return `IW-${product.id.toUpperCase()}-${stamp}`;
}

function deliveryText(order, product) {
  return [
    "<b>Оплата получена</b>",
    "",
    `Товар: <b>Interium ${product.title}</b>`,
    `Срок: <b>${product.days} дн.</b>`,
    `Ключ: <code>${order.key}</code>`,
    "",
    "Напиши ключ саппорту в Discord или используй redeem, когда он будет готов.",
    "Сохрани это сообщение.",
  ].join("\n");
}

export async function startBuy(userId, productId) {
  const product = productById(productId);
  if (!product) throw new Error("Unknown product");

  const fiat = currency();
  const amount = priceFor(product, fiat);
  const botName = process.env.BOT_USERNAME?.replace(/^@/, "").trim();
  const invoice = await createInvoice({
    currency_type: "fiat",
    fiat,
    amount,
    accepted_assets: "USDT,TON,BTC",
    description: `Interium ${product.title}`,
    payload: newPayload(userId, product.id),
    expires_in: 1800,
    allow_comments: false,
    allow_anonymous: false,
    hidden_message: `Interium ${product.title} paid. Return to the bot.`,
    ...(botName
      ? {
          paid_btn_name: "openBot",
          paid_btn_url: `https://t.me/${botName}`,
        }
      : {}),
  });

  await saveOrder({
    invoiceId: invoice.invoice_id,
    userId,
    productId: product.id,
    amount,
    fiat,
    status: "pending",
    createdAt: new Date().toISOString(),
  });

  const url = invoicePayUrl(invoice);
  if (!url) throw new Error("Invoice URL missing");

  await sendMessage(
    userId,
    [
      `<b>Interium ${product.title}</b>`,
      `${amount} ${fiat}  ·  ${product.rub} ₽`,
      "",
      "Жми кнопку и оплати в @send / Crypto Pay.",
      "Ключ придёт сюда сам, как только платёж пройдёт.",
    ].join("\n"),
    { reply_markup: payKeyboard(url) }
  );

  return invoice;
}

export async function fulfillInvoice(invoice) {
  const invoiceId = invoice.invoice_id;
  const existing = getOrder(invoiceId);
  if (existing?.status === "paid") return existing;

  const confirmed = await getPaidInvoice(invoiceId);
  if (!confirmed) return null;

  const parsed =
    parsePayload(confirmed.payload) ||
    (existing
      ? { userId: existing.userId, productId: existing.productId }
      : null);
  if (!parsed) {
    throw new Error(`Invoice ${invoiceId} has no buyer payload`);
  }

  const product = productById(parsed.productId);
  if (!product) throw new Error(`Unknown product ${parsed.productId}`);

  const key = existing?.key || issueKey(product);
  const order = {
    invoiceId,
    userId: parsed.userId,
    productId: product.id,
    amount: confirmed.amount,
    fiat: confirmed.fiat || existing?.fiat || currency(),
    asset: confirmed.paid_asset || confirmed.asset || "",
    status: "paid",
    key,
    paidAt: confirmed.paid_at || new Date().toISOString(),
    createdAt: existing?.createdAt || new Date().toISOString(),
  };
  await saveOrder(order);

  await sendMessage(parsed.userId, deliveryText(order, product));

  const admins = (process.env.ADMIN_IDS || "").split(",");
  for (const admin of admins) {
    const id = Number(admin.trim());
    if (!id) continue;
    await sendMessage(
      id,
      [
        "<b>Новая оплата</b>",
        `User: <code>${parsed.userId}</code>`,
        `Товар: ${product.title}`,
        `Сумма: ${order.amount} ${order.fiat} (${order.asset || "crypto"})`,
        `Ключ: <code>${key}</code>`,
        `Invoice: <code>${invoiceId}</code>`,
      ].join("\n")
    ).catch(() => {});
  }

  return order;
}

export function catalogText() {
  const lines = [
    "<b>INTERIUMWARE</b>",
    "Rust · external overlay",
    "",
    ...PRODUCTS.map(
      (item) => `• <b>${item.title}</b> — ${item.usd}$  ·  ${item.rub}₽`
    ),
    "",
    "Оплата: Crypto Pay (@send)",
    "После оплаты ключ приходит автоматически.",
  ];
  return lines.join("\n");
}
