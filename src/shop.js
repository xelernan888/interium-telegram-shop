import {
  createInvoice,
  deleteInvoice,
  getPaidInvoice,
  invoicePayUrl,
  newPayload,
  parsePayload,
} from "./cryptoPay.js";
import {
  catalogBody,
  guideText,
  invoiceText,
  paidText,
  productLine,
  ui,
} from "./copy.js";
import { PRODUCTS, productById } from "./products.js";
import {
  addKeys,
  getOrder,
  getUsdt,
  keyCount,
  pendingOrdersForUser,
  releaseExpiredHolds,
  releaseHold,
  saveOrder,
  takeKey,
  userLang,
} from "./store.js";
import { payKeyboard, sendMessage } from "./telegram.js";

/** @type {Set<number>} */
const buying = new Set();

function deliveryText(lang, order, product) {
  return paidText(lang, product.id, product.days, order.key, order.amount);
}

export async function expireStaleInvoices() {
  const expiredIds = await releaseExpiredHolds();
  for (const invoiceId of expiredIds) {
    await deleteInvoice(invoiceId);
  }
  return expiredIds.length;
}

export async function cancelPendingForUser(userId) {
  const pending = pendingOrdersForUser(userId);
  for (const order of pending) {
    await deleteInvoice(order.invoiceId);
    await releaseHold(order, "cancelled");
  }
  return pending.length;
}

export async function startBuy(userId, productId) {
  const product = productById(productId);
  if (!product) throw new Error("Unknown product");
  if (buying.has(userId)) throw new Error("busy");
  buying.add(userId);

  try {
  await expireStaleInvoices();
  const cancelled = await cancelPendingForUser(userId);
  const reservedKey = await takeKey(product.id);
  if (!reservedKey) {
    throw new Error("out_of_stock");
  }

  const amount = getUsdt(product.id);
  const lang = userLang(userId);
  const botName = process.env.BOT_USERNAME?.replace(/^@/, "").trim();

  let invoice;
  try {
    invoice = await createInvoice({
      currency_type: "crypto",
      asset: "USDT",
      amount,
      description: `Interium.ware ${product.title}`,
      payload: newPayload(userId, product.id),
      expires_in: 900,
      allow_comments: false,
      allow_anonymous: false,
      hidden_message: `Interium.ware ${product.title} paid. Return to the bot.`,
      ...(botName
        ? {
            paid_btn_name: "openBot",
            paid_btn_url: `https://t.me/${botName}`,
          }
        : {}),
    });
  } catch (error) {
    await addKeys(product.id, [reservedKey]);
    throw error;
  }

  const url = invoicePayUrl(invoice);
  if (!url) {
    await deleteInvoice(invoice.invoice_id);
    await addKeys(product.id, [reservedKey]);
    throw new Error("Invoice URL missing");
  }

  await saveOrder({
    invoiceId: invoice.invoice_id,
    userId,
    productId: product.id,
    amount,
    fiat: "USDT",
    status: "pending",
    reservedKey,
    createdAt: new Date().toISOString(),
  });

  await sendMessage(
    userId,
    invoiceText(lang, product.id, amount, cancelled > 0),
    { reply_markup: payKeyboard(url, lang) }
  );

  return invoice;
  } finally {
    buying.delete(userId);
  }
}

export async function fulfillInvoice(invoice) {
  const invoiceId = invoice.invoice_id;
  const existing = getOrder(invoiceId);
  if (existing?.status === "paid") return existing;

  const confirmed = await getPaidInvoice(invoiceId);
  if (!confirmed) return null;

  if (existing && existing.status !== "pending") {
    // Paid after cancel/expire: try to still deliver from pool.
  }

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
  const lang = userLang(parsed.userId);

  const key =
    (existing?.status === "pending" ? existing.reservedKey : null) ||
    (await takeKey(product.id));
  if (!key) {
    await sendMessage(parsed.userId, ui(lang).paidNoKey).catch(() => {});
    const admins = (process.env.ADMIN_IDS || "").split(",");
    for (const admin of admins) {
      const id = Number(admin.trim());
      if (!id) continue;
      await sendMessage(
        id,
        `ОПЛАЧЕНО БЕЗ КЛЮЧА\nUser: ${parsed.userId}\n${product.title}\nInvoice: ${invoiceId}`
      ).catch(() => {});
    }
    await saveOrder({
      ...(existing || {}),
      invoiceId,
      userId: parsed.userId,
      productId: product.id,
      amount: confirmed.amount,
      fiat: "USDT",
      status: "paid_no_key",
      reservedKey: null,
      paidAt: confirmed.paid_at || new Date().toISOString(),
      createdAt: existing?.createdAt || new Date().toISOString(),
    });
    return null;
  }

  const order = {
    invoiceId,
    userId: parsed.userId,
    productId: product.id,
    amount: confirmed.amount,
    fiat: "USDT",
    asset: confirmed.paid_asset || confirmed.asset || "USDT",
    status: "paid",
    key,
    reservedKey: null,
    paidAt: confirmed.paid_at || new Date().toISOString(),
    createdAt: existing?.createdAt || new Date().toISOString(),
  };
  await saveOrder(order);

  await sendMessage(parsed.userId, deliveryText(lang, order, product));
  await sendMessage(parsed.userId, guideText(lang));

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
        `Сумма: ${order.amount} USDT`,
        `Ключ: <code>${key}</code>`,
        `Invoice: <code>${invoiceId}</code>`,
      ].join("\n")
    ).catch(() => {});
  }

  return order;
}

export async function catalogText(lang, { cancelled = false } = {}) {
  await expireStaleInvoices();
  const items = PRODUCTS.map((item, index) => {
    const line = productLine(lang, item.id, getUsdt(item.id), keyCount(item.id));
    return index === PRODUCTS.length - 1 ? line : `${line}\n`;
  });
  const body = catalogBody(lang, items);
  return cancelled ? `${ui(lang).cancelled}\n\n${body}` : body;
}

export { keyCount };
