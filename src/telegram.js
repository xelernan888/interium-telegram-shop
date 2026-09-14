const API = "https://api.telegram.org";

export function telegramToken() {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is missing");
  return token;
}

export function adminIds() {
  return (process.env.ADMIN_IDS || "")
    .split(",")
    .map((id) => Number(id.trim()))
    .filter((id) => Number.isFinite(id) && id > 0);
}

export function isAdmin(id) {
  return adminIds().includes(Number(id));
}

async function api(method, body) {
  const response = await fetch(`${API}/bot${telegramToken()}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!data.ok) {
    throw new Error(data.description || `Telegram ${method} failed`);
  }
  return data.result;
}

export function sendMessage(chatId, text, extra = {}) {
  return api("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    ...extra,
  });
}

export function answerCallback(id, text = "", alert = false) {
  return api("answerCallbackQuery", {
    callback_query_id: id,
    text,
    show_alert: Boolean(alert && text),
  });
}

export function setWebhook(url) {
  return api("setWebhook", {
    url,
    drop_pending_updates: false,
    allowed_updates: ["message", "callback_query"],
  });
}

export function deleteWebhook() {
  return api("deleteWebhook", { drop_pending_updates: false });
}

export function getUpdates(offset) {
  return api("getUpdates", {
    offset,
    timeout: 25,
    allowed_updates: ["message", "callback_query"],
  });
}

export function mainKeyboard(lang = "ru", admin = false) {
  const t = lang === "en"
    ? {
        buy: "Buy",
        orders: "My orders",
        help: "Help",
        support: "Support",
        language: "Language",
        admin: "Admin",
      }
    : {
        buy: "Купить",
        orders: "Мои покупки",
        help: "Помощь",
        support: "Поддержка",
        language: "Язык",
        admin: "Админка",
      };
  const rows = [
    [{ text: t.buy }],
    [{ text: t.orders }, { text: t.help }],
    [{ text: t.support }, { text: t.language }],
  ];
  if (admin) rows.push([{ text: t.admin }]);
  return {
    keyboard: rows,
    resize_keyboard: true,
  };
}

export function catalogKeyboard(lang = "ru", stock = {}, prices = {}, discount = 0) {
  const none = lang === "en" ? "out" : "нет";
  const titles =
    lang === "en"
      ? { "1d": "1 Day", "3d": "3 Days", "7d": "7 Days", "30d": "30 Days" }
      : { "1d": "1 день", "3d": "3 дня", "7d": "7 дней", "30d": "30 дней" };
  const label = (id) => {
    const count = stock[id] ?? 0;
    const price = prices[id] || "";
    const sale = discount > 0 ? ` −${discount}%` : "";
    const base = `${titles[id]} · ${price} USDT${sale}`;
    return count > 0 ? base : `${base} · ${none}`;
  };
  return {
    inline_keyboard: [
      [
        { text: label("1d"), callback_data: "buy:1d" },
        { text: label("3d"), callback_data: "buy:3d" },
      ],
      [
        { text: label("7d"), callback_data: "buy:7d" },
        { text: label("30d"), callback_data: "buy:30d" },
      ],
    ],
  };
}

export function payKeyboard(url, lang = "ru") {
  return {
    inline_keyboard: [
      [{ text: lang === "en" ? "Pay USDT" : "Оплатить USDT", url }],
    ],
  };
}
