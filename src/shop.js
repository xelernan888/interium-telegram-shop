import {
  createInvoice,
  getPaidInvoice,
  invoicePayUrl,
  newPayload,
  parsePayload,
} from "./cryptoPay.js";
import { PRODUCTS, priceFor, productById } from "./products.js";
import {
  addKeys,
  getOrder,
  keyCount,
  releaseExpiredHolds,
  saveOrder,
  takeKey,
} from "./store.js";
import { payKeyboard, sendMessage } from "./telegram.js";

const currency = () =>
  (process.env.CURRENCY || "USD").toUpperCase() === "RUB" ? "RUB" : "USD";

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

  await releaseExpiredHolds();
  const reservedKey = await takeKey(product.id);
  if (!reservedKey) {
    throw new Error("out_of_stock");
  }

  const fiat = currency();
  const amount = priceFor(product, fiat);
  const botName = process.env.BOT_USERNAME?.replace(/^@/, "").trim();

  let invoice;
  try {
    invoice = await createInvoice({
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
  } catch (error) {
    await addKeys(product.id, [reservedKey]);
    throw error;
  }

  await saveOrder({
    invoiceId: invoice.invoice_id,
    userId,
    productId: product.id,
    amount,
    fiat,
    status: "pending",
    reservedKey,
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

  const key = existing?.reservedKey || (await takeKey(product.id));
  if (!key) {
    await sendMessage(
      parsed.userId,
      "Оплата прошла, но ключей этого срока нет. Админ выдаст вручную."
    ).catch(() => {});
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
      invoiceId,
      userId: parsed.userId,
      productId: product.id,
      amount: confirmed.amount,
      fiat: confirmed.fiat || existing?.fiat || currency(),
      status: "paid_no_key",
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
    fiat: confirmed.fiat || existing?.fiat || currency(),
    asset: confirmed.paid_asset || confirmed.asset || "",
    status: "paid",
    key,
    reservedKey: null,
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

export async function catalogText() {
  await releaseExpiredHolds();
  const lines = [
    "<b>INTERIUMWARE</b>",
    "Rust · external overlay",
    "",
    ...PRODUCTS.map((item) => {
      const stock = keyCount(item.id);
      const mark = stock > 0 ? `${stock} шт.` : "нет в наличии";
      return `• <b>${item.title}</b> — ${item.usd}$  ·  ${item.rub}₽  ·  ${mark}`;
    }),
    "",
    "Оплата: Crypto Pay (@send)",
    "После оплаты ключ этого срока приходит автоматически.",
  ];
  return lines.join("\n");
}

export { keyCount };
