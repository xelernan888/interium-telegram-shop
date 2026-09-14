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

export function answerCallback(id, text) {
  return api("answerCallbackQuery", {
    callback_query_id: id,
    text,
    show_alert: Boolean(text && text !== "Создаю счёт…"),
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

export function mainKeyboard(admin = false) {
  const rows = [[{ text: "Купить" }], [{ text: "Мои покупки" }, { text: "Помощь" }]];
  if (admin) rows.push([{ text: "Админка" }]);
  return {
    keyboard: rows,
    resize_keyboard: true,
  };
}

export function catalogKeyboard(stock = {}, prices = {}) {
  const label = (id, short) => {
    const count = stock[id] ?? 0;
    const price = prices[id] || "";
    const base = `${short} · ${price} USDT`;
    return count > 0 ? base : `${base} · нет`;
  };
  return {
    inline_keyboard: [
      [
        { text: label("1d", "1 Day"), callback_data: "buy:1d" },
        { text: label("3d", "3 Days"), callback_data: "buy:3d" },
      ],
      [
        { text: label("7d", "7 Days"), callback_data: "buy:7d" },
        { text: label("30d", "30 Days"), callback_data: "buy:30d" },
      ],
    ],
  };
}

export function payKeyboard(url) {
  return {
    inline_keyboard: [[{ text: "Оплатить USDT", url }]],
  };
}
