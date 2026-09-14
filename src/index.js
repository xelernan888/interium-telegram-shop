import "dotenv/config";
import express from "express";
import { getMe, verifyPaySignature } from "./cryptoPay.js";
import { PRODUCTS, productById } from "./products.js";
import { catalogText, fulfillInvoice, startBuy } from "./shop.js";
import {
  addKeys,
  keyCount,
  loadStore,
  paidCount,
  releaseExpiredHolds,
  stockLines,
} from "./store.js";
import {
  answerCallback,
  catalogKeyboard,
  deleteWebhook,
  getUpdates,
  isAdmin,
  mainKeyboard,
  sendMessage,
  setWebhook,
} from "./telegram.js";

const PORT = Number.parseInt(process.env.PORT || "3000", 10) || 3000;
const PUBLIC_URL = (process.env.PUBLIC_URL || "").replace(/\/$/, "");

async function catalogMarkup() {
  await releaseExpiredHolds();
  return catalogKeyboard(
    Object.fromEntries(PRODUCTS.map((item) => [item.id, keyCount(item.id)]))
  );
}

function welcome() {
  return [
    "<b>INTERIUM</b>",
    "Магазин лицензий. Оплата через @send / Crypto Pay.",
    "",
    "Жми <b>Купить</b> — бот выставит счёт и после оплаты сам пришлёт ключ.",
  ].join("\n");
}

async function handleCommand(message) {
  const userId = message.from?.id;
  const chatId = message.chat?.id;
  const text = (message.text || "").trim();
  if (!userId || !chatId) return;

  if (text.startsWith("/start") || text === "Купить") {
    const markup = await catalogMarkup();
    if (text === "Купить") {
      await sendMessage(chatId, await catalogText(), { reply_markup: markup });
    } else {
      await sendMessage(chatId, welcome(), { reply_markup: mainKeyboard() });
      await sendMessage(chatId, await catalogText(), { reply_markup: markup });
    }
    return;
  }

  if (text === "Помощь" || text === "/help") {
    await sendMessage(
      chatId,
      [
        "1. Купить → выбери срок",
        "2. Оплати счёт в @send",
        "3. Ключ придёт в этот чат сам",
        "",
        "Если ключ не пришёл — напиши сюда invoice id, админ проверит.",
      ].join("\n"),
      { reply_markup: mainKeyboard() }
    );
    return;
  }

  if (text === "Мои покупки" || text === "/orders") {
    await sendMessage(
      chatId,
      "Ключи приходят сюда после оплаты. Если потерял — напиши админу.",
      { reply_markup: mainKeyboard() }
    );
    return;
  }

  if (text.startsWith("/keys") && isAdmin(userId)) {
    const extra = text.replace("/keys", "").trim();
    if (!extra) {
      await sendMessage(
        chatId,
        ["<b>Сток</b>", ...stockLines(), "", "Добавить: <code>/keys 7d KEY1 KEY2</code>"].join(
          "\n"
        )
      );
      return;
    }
    const [rawId, ...rest] = extra.split(/[\s,]+/).filter(Boolean);
    const product = productById(rawId.toLowerCase());
    if (!product || !rest.length) {
      await sendMessage(
        chatId,
        "Формат: <code>/keys 1d KEY1 KEY2</code>\nСроки: 1d · 3d · 7d · 30d"
      );
      return;
    }
    const total = await addKeys(product.id, rest);
    await sendMessage(
      chatId,
      `В ${product.title} добавлено ${rest.length}. Сейчас: <b>${total}</b> шт.`
    );
    return;
  }

  if (text === "/stats" && isAdmin(userId)) {
    await sendMessage(
      chatId,
      [`Оплачено заказов: <b>${paidCount()}</b>`, "", ...stockLines()].join("\n")
    );
  }
}

async function handleCallback(query) {
  const data = query.data || "";
  const userId = query.from?.id;
  if (!userId) return;
  if (!data.startsWith("buy:")) return;
  const productId = data.slice(4);
  await releaseExpiredHolds();
  if (keyCount(productId) < 1) {
    await answerCallback(query.id, "Нет в наличии");
    await sendMessage(userId, "Этого срока сейчас нет. Выбери другой или подожди сток.");
    return;
  }
  try {
    await answerCallback(query.id, "Создаю счёт…");
    await startBuy(userId, productId);
  } catch (error) {
    console.error("buy failed:", error.message);
    const text =
      error.message === "out_of_stock"
        ? "Нет в наличии."
        : `Не получилось создать счёт: ${error.message}`;
    await sendMessage(userId, text).catch(() => {});
  }
}

async function handleTelegramUpdate(update) {
  if (update.callback_query) {
    await handleCallback(update.callback_query);
    return;
  }
  if (update.message) {
    await handleCommand(update.message);
  }
}

async function handlePay(req, res) {
  const raw = Buffer.isBuffer(req.body)
    ? req.body
    : Buffer.from(String(req.body || ""), "utf8");
  const signature =
    req.get("crypto-pay-api-signature") ||
    req.get("Crypto-Pay-Api-Signature") ||
    "";

  if (!verifyPaySignature(raw, signature)) {
    console.warn("pay webhook: bad signature");
    res.status(401).json({ ok: false });
    return;
  }

  let body;
  try {
    body = JSON.parse(raw.toString("utf8"));
  } catch {
    res.status(400).json({ ok: false });
    return;
  }

  if (body.update_type === "invoice_paid" && body.payload) {
    try {
      await fulfillInvoice(body.payload);
    } catch (error) {
      console.error("fulfill failed:", error.message);
      res.status(500).json({ ok: false });
      return;
    }
  }

  res.json({ ok: true });
}

async function startPolling() {
  await deleteWebhook().catch(() => {});
  console.log("Telegram: long polling (set PUBLIC_URL for webhook)");
  let offset = 0;
  const loop = async () => {
    try {
      const updates = await getUpdates(offset);
      for (const update of updates) {
        offset = update.update_id + 1;
        await handleTelegramUpdate(update).catch((error) => {
          console.error("update failed:", error.message);
        });
      }
    } catch (error) {
      console.error("polling:", error.message);
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
    setImmediate(loop);
  };
  loop();
}

const app = express();
app.get("/", (_req, res) => {
  res.json({ ok: true, service: "interium-shop", pay: "/pay" });
});
app.get("/pay", (_req, res) => {
  res.json({ ok: true, hook: "crypto-pay", method: "POST" });
});
app.post("/pay", express.raw({ type: "*/*", limit: "1mb" }), (req, res) => {
  handlePay(req, res).catch((error) => {
    console.error("pay route:", error.message);
    res.status(500).json({ ok: false });
  });
});
app.post("/telegram", express.json({ limit: "1mb" }), (req, res) => {
  res.json({ ok: true });
  handleTelegramUpdate(req.body || {}).catch((error) => {
    console.error("telegram webhook:", error.message);
  });
});

await loadStore();

app.listen(PORT, async () => {
  console.log(`HTTP on :${PORT}`);
  try {
    const me = await getMe();
    console.log(`Crypto Pay app: ${me.name || me.app_id || "ok"}`);
  } catch (error) {
    console.error("Crypto Pay getMe failed:", error.message);
  }

  if (PUBLIC_URL) {
    const payUrl = `${PUBLIC_URL}/pay`;
    const tgUrl = `${PUBLIC_URL}/telegram`;
    try {
      await setWebhook(tgUrl);
      console.log(`Telegram webhook: ${tgUrl}`);
    } catch (error) {
      console.error("setWebhook failed:", error.message);
    }
    console.log(`Put this URL in Crypto Pay Webhooks: ${payUrl}`);
  } else {
    await startPolling();
  }
});
