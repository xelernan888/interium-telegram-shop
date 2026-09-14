import "dotenv/config";
import express from "express";
import { handleAdminCallback, handleAdminMessage } from "./admin.js";
import { getMe, tokenDebugInfo, verifyPaySignature } from "./cryptoPay.js";
import { PRODUCTS } from "./products.js";
import {
  cancelPendingForUser,
  catalogText,
  expireStaleInvoices,
  fulfillInvoice,
  startBuy,
} from "./shop.js";
import {
  getUsdt,
  keyCount,
  loadStore,
  paidCount,
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
  await expireStaleInvoices();
  return catalogKeyboard(
    Object.fromEntries(PRODUCTS.map((item) => [item.id, keyCount(item.id)])),
    Object.fromEntries(PRODUCTS.map((item) => [item.id, getUsdt(item.id)]))
  );
}

function welcome() {
  return [
    "<b>INTERIUM</b>",
    "Магазин лицензий. Оплата USDT через @send / Crypto Pay.",
    "",
    "Жми <b>Купить</b> — бот выставит счёт и после оплаты сам пришлёт ключ.",
  ].join("\n");
}

async function handleCommand(message) {
  const userId = message.from?.id;
  const chatId = message.chat?.id;
  const text = (message.text || "").trim();
  if (!userId || !chatId) return;

  if (isAdmin(userId) && (await handleAdminMessage(message))) return;

  if (text.startsWith("/start") || text === "Купить") {
    let cancelled = 0;
    if (text === "Купить") {
      cancelled = await cancelPendingForUser(userId);
    }
    const markup = await catalogMarkup();
    const kb = mainKeyboard(isAdmin(userId));
    if (cancelled > 0) {
      await sendMessage(
        chatId,
        "Неоплаченный счёт отменён. Ключ снова в наличии."
      );
    }
    if (text === "Купить") {
      await sendMessage(chatId, await catalogText(), { reply_markup: markup });
    } else {
      await sendMessage(chatId, welcome(), { reply_markup: kb });
      await sendMessage(chatId, await catalogText(), { reply_markup: markup });
    }
    return;
  }

  if (text === "Помощь" || text === "/help") {
    await sendMessage(
      chatId,
      [
        "1. Купить → выбери срок",
        "2. Оплати счёт в @send (USDT, 15 минут)",
        "3. Ключ придёт в этот чат сам",
        "",
        "Новый «Купить» отменяет старый неоплаченный счёт.",
      ].join("\n"),
      { reply_markup: mainKeyboard(isAdmin(userId)) }
    );
    return;
  }

  if (text === "Мои покупки" || text === "/orders") {
    await sendMessage(
      chatId,
      "Ключи приходят сюда после оплаты. Если потерял — напиши админу.",
      { reply_markup: mainKeyboard(isAdmin(userId)) }
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

  if (isAdmin(userId) && (data === "admin" || data.startsWith("admin:") || data.startsWith("ak:") || data.startsWith("ad:") || data.startsWith("ap:"))) {
    await answerCallback(query.id, "");
    await handleAdminCallback(query);
    return;
  }

  if (!data.startsWith("buy:")) return;
  const productId = data.slice(4);
  await expireStaleInvoices();
  if (keyCount(productId) < 1) {
    await answerCallback(query.id, "Нет в наличии");
    await sendMessage(
      userId,
      "Этого срока сейчас нет. Выбери другой или подожди сток."
    );
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
        : error.message === "busy"
          ? "Подожди, счёт ещё создаётся."
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
setInterval(() => {
  expireStaleInvoices().catch((error) =>
    console.error("expire holds:", error.message)
  );
}, 30_000);

if (!globalThis.__interiumHttp) {
  globalThis.__interiumHttp = true;
  app.listen(PORT, async () => {
    console.log(`HTTP on :${PORT}`);
    console.log("Crypto Pay debug:", tokenDebugInfo());
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
}
