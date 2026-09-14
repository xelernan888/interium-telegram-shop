import "dotenv/config";
import express from "express";
import { handleAdminCallback, handleAdminMessage } from "./admin.js";
import {
  helpText,
  isBuy,
  isHelp,
  isLanguage,
  isOrders,
  isSupport,
  languageKeyboard,
  languagePrompt,
  ordersText,
  outOfStockText,
  supportText,
  ui,
  welcomeText,
} from "./copy.js";
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
  getLang,
  getUsdt,
  keyCount,
  loadStore,
  paidCount,
  setLang,
  stockLines,
  userLang,
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

async function catalogMarkup(lang) {
  await expireStaleInvoices();
  return catalogKeyboard(
    lang,
    Object.fromEntries(PRODUCTS.map((item) => [item.id, keyCount(item.id)])),
    Object.fromEntries(PRODUCTS.map((item) => [item.id, getUsdt(item.id)]))
  );
}

async function askLanguage(chatId) {
  await sendMessage(chatId, languagePrompt(), {
    reply_markup: languageKeyboard(),
  });
}

async function sendWelcomeShop(chatId, userId) {
  const lang = userLang(userId);
  await sendMessage(chatId, welcomeText(lang), {
    reply_markup: mainKeyboard(lang, isAdmin(userId)),
  });
  await sendMessage(chatId, await catalogText(lang), {
    reply_markup: await catalogMarkup(lang),
  });
}

async function handleCommand(message) {
  const userId = message.from?.id;
  const chatId = message.chat?.id;
  const text = (message.text || "").trim();
  if (!userId || !chatId) return;

  if (isAdmin(userId) && (await handleAdminMessage(message))) return;

  if (isLanguage(text) || !getLang(userId)) {
    await askLanguage(chatId);
    return;
  }

  const lang = userLang(userId);

  if (text.startsWith("/start") || isBuy(text)) {
    let cancelled = 0;
    if (isBuy(text)) {
      cancelled = await cancelPendingForUser(userId);
    }
    const markup = await catalogMarkup(lang);
    const kb = mainKeyboard(lang, isAdmin(userId));
    if (isBuy(text)) {
      await sendMessage(chatId, await catalogText(lang, { cancelled: cancelled > 0 }), {
        reply_markup: markup,
      });
    } else {
      await sendMessage(chatId, welcomeText(lang), { reply_markup: kb });
      await sendMessage(chatId, await catalogText(lang), { reply_markup: markup });
    }
    return;
  }

  if (isHelp(text)) {
    await sendMessage(chatId, helpText(lang), {
      reply_markup: mainKeyboard(lang, isAdmin(userId)),
    });
    return;
  }

  if (isOrders(text)) {
    await sendMessage(chatId, ordersText(lang), {
      reply_markup: mainKeyboard(lang, isAdmin(userId)),
    });
    return;
  }

  if (isSupport(text)) {
    await sendMessage(chatId, supportText(lang), {
      reply_markup: mainKeyboard(lang, isAdmin(userId)),
    });
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

  if (data.startsWith("lang:")) {
    const lang = data === "lang:en" ? "en" : "ru";
    await setLang(userId, lang);
    await answerCallback(query.id, ui(lang).langSaved);
    await sendWelcomeShop(userId, userId);
    return;
  }

  if (isAdmin(userId) && (data === "admin" || data.startsWith("admin:") || data.startsWith("ak:") || data.startsWith("ad:") || data.startsWith("ap:"))) {
    await answerCallback(query.id, "");
    await handleAdminCallback(query);
    return;
  }

  if (!data.startsWith("buy:")) return;

  if (!getLang(userId)) {
    await answerCallback(query.id, "");
    await askLanguage(userId);
    return;
  }

  const lang = userLang(userId);
  const t = ui(lang);
  const productId = data.slice(4);
  await expireStaleInvoices();
  if (keyCount(productId) < 1) {
    await answerCallback(query.id, t.outAlert, true);
    await sendMessage(userId, outOfStockText(lang));
    return;
  }
  try {
    await answerCallback(query.id, t.creating);
    await startBuy(userId, productId);
  } catch (error) {
    console.error("buy failed:", error.message);
    const text =
      error.message === "out_of_stock"
        ? t.outAlert
        : error.message === "busy"
          ? t.busy
          : t.buyFail(error.message);
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
