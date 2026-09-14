import "dotenv/config";
import express from "express";
import { getMe, verifyPaySignature } from "./cryptoPay.js";
import { catalogText, fulfillInvoice, startBuy } from "./shop.js";
import { addKeys, keyCount, loadStore, paidCount } from "./store.js";
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
    await sendMessage(chatId, text === "Купить" ? catalogText() : welcome(), {
      reply_markup: text === "Купить" ? catalogKeyboard() : mainKeyboard(),
    });
    if (text.startsWith("/start")) {
      await sendMessage(chatId, catalogText(), {
        reply_markup: catalogKeyboard(),
      });
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
      await sendMessage(chatId, `В пуле ключей: <b>${keyCount()}</b>`);
      return;
    }
    const keys = extra.split(/[\s,]+/).filter(Boolean);
    const total = await addKeys(keys);
    await sendMessage(chatId, `Добавлено ${keys.length}. Сейчас в пуле: ${total}`);
    return;
  }

  if (text === "/stats" && isAdmin(userId)) {
    await sendMessage(
      chatId,
      `Оплачено заказов: <b>${paidCount()}</b>\nКлючей в пуле: <b>${keyCount()}</b>`
    );
  }
}

async function handleCallback(query) {
  const data = query.data || "";
  const userId = query.from?.id;
  if (!userId) return;
  if (!data.startsWith("buy:")) return;
  const productId = data.slice(4);
  try {
    await answerCallback(query.id, "Создаю счёт…");
    await startBuy(userId, productId);
  } catch (error) {
    console.error("buy failed:", error.message);
    await sendMessage(
      userId,
      `Не получилось создать счёт: ${error.message}`
    ).catch(() => {});
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
