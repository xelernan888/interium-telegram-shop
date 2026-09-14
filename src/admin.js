import { formatSalePrice } from "./copy.js";
import { PRODUCTS, productById } from "./products.js";
import {
  addKeys,
  getBaseUsdt,
  getDiscount,
  getUsdt,
  listKeys,
  removeKey,
  setDiscount,
  setUsdt,
  stockLines,
} from "./store.js";
import { sendMessage } from "./telegram.js";

/** @type {Map<number, string>} */
const waitingPrice = new Map();
const SALE_WAIT = "__sale__";

function priceLabel(productId) {
  return formatSalePrice(getUsdt(productId), getBaseUsdt(productId), getDiscount());
}

export function adminKeyboard() {
  const discount = getDiscount();
  return {
    inline_keyboard: [
      PRODUCTS.map((item) => ({
        text: `${item.id} · ${getUsdt(item.id)}`,
        callback_data: `ak:${item.id}`,
      })),
      [
        { text: "Все ключи", callback_data: "admin:all" },
        { text: "Цены USDT", callback_data: "admin:prices" },
      ],
      [
        {
          text: discount > 0 ? `Скидка ${discount}%` : "Скидка %",
          callback_data: "admin:sale",
        },
      ],
    ],
  };
}

function keyButtons(productId) {
  const keys = listKeys(productId);
  const rows = [];
  for (let i = 0; i < keys.length; i += 2) {
    const row = [
      {
        text: `🗑 ${i + 1}`,
        callback_data: `ad:${productId}:${i}`,
      },
    ];
    if (keys[i + 1]) {
      row.push({
        text: `🗑 ${i + 2}`,
        callback_data: `ad:${productId}:${i + 1}`,
      });
    }
    rows.push(row);
  }
  rows.push([
    { text: "Изменить цену", callback_data: `ap:${productId}` },
    { text: "Назад", callback_data: "admin" },
  ]);
  return { inline_keyboard: rows };
}

export function pricesKeyboard() {
  return {
    inline_keyboard: [
      ...PRODUCTS.map((item) => [
        {
          text: `${item.title}: ${getUsdt(item.id)} USDT`,
          callback_data: `ap:${item.id}`,
        },
      ]),
      [{ text: "Назад", callback_data: "admin" }],
    ],
  };
}

export function productKeysText(productId) {
  const product = productById(productId);
  const keys = listKeys(productId);
  const price = priceLabel(productId);
  if (!keys.length) {
    return `<b>${product.title}</b>\nЦена: ${price}\nБазовая: <b>${getBaseUsdt(productId)}</b> USDT\nКлючей нет.\nДобавить: <code>/keys ${productId} KEY</code>`;
  }
  return [
    `<b>${product.title}</b>`,
    `Цена: ${price}`,
    `Базовая: <b>${getBaseUsdt(productId)}</b> USDT`,
    `В наличии: <b>${keys.length}</b>`,
    "",
    ...keys.map((key, index) => `${index + 1}. <code>${key}</code>`),
    "",
    `Удалить: кнопка или <code>/del ${productId} 1</code>`,
    `Добавить: <code>/keys ${productId} KEY</code>`,
  ].join("\n");
}

function stockCounts() {
  const discount = getDiscount();
  const lines = PRODUCTS.map((item) => {
    const n = listKeys(item.id).length;
    const mark = n > 0 ? `${n} шт.` : "нет";
    return `<b>${item.title}</b> — ${priceLabel(item.id)} — ${mark}`;
  });
  if (discount > 0) {
    lines.push(`Скидка на все ключи: <b>−${discount}%</b>`);
  }
  return lines;
}

export async function showAdmin(chatId) {
  waitingPrice.delete(Number(chatId));
  await sendMessage(
    chatId,
    [
      "<b>Админка</b>",
      "Ключи лежат в отдельных пулах по сроку.",
      "",
      ...stockCounts(),
      "",
      "Открой срок, чтобы увидеть сами ключи, удалить или сменить цену.",
      "Скидка % действует на все ключи сразу.",
    ].join("\n"),
    { reply_markup: adminKeyboard() }
  );
}

export async function handleAdminCallback(query) {
  const data = query.data || "";
  const userId = query.from.id;

  if (data === "admin") {
    await showAdmin(userId);
    return true;
  }

  if (data === "admin:all") {
    await sendMessage(userId, ["<b>Все ключи</b>", "", ...stockLines()].join("\n"), {
      reply_markup: adminKeyboard(),
    });
    return true;
  }

  if (data === "admin:prices") {
    waitingPrice.delete(userId);
    await sendMessage(userId, "Нажми срок, потом напиши новую базовую цену в USDT.", {
      reply_markup: pricesKeyboard(),
    });
    return true;
  }

  if (data === "admin:sale") {
    waitingPrice.set(userId, SALE_WAIT);
    const current = getDiscount();
    await sendMessage(
      userId,
      [
        "<b>Скидка на все ключи</b>",
        current > 0 ? `Сейчас: <b>−${current}%</b>` : "Сейчас скидки нет.",
        "",
        "Напиши процент, например <code>20</code>",
        "Снять скидку: <code>0</code> или <code>/sale 0</code>",
      ].join("\n")
    );
    return true;
  }

  if (data.startsWith("ak:")) {
    const id = data.slice(3);
    if (!productById(id)) return true;
    await sendMessage(userId, productKeysText(id), {
      reply_markup: keyButtons(id),
    });
    return true;
  }

  if (data.startsWith("ad:")) {
    const [, id, indexRaw] = data.split(":");
    const removed = await removeKey(id, Number(indexRaw));
    await sendMessage(
      userId,
      removed ? `Удалён: <code>${removed}</code>` : "Ключ уже удалён."
    );
    await sendMessage(userId, productKeysText(id), {
      reply_markup: keyButtons(id),
    });
    return true;
  }

  if (data.startsWith("ap:")) {
    const id = data.slice(3);
    if (!productById(id)) return true;
    waitingPrice.set(userId, id);
    await sendMessage(
      userId,
      `Новая базовая цена для <b>${productById(id).title}</b> в USDT.\nСейчас: <b>${getBaseUsdt(id)}</b>\nСо скидкой: ${priceLabel(id)}\nНапиши число, например <code>18.5</code>`
    );
    return true;
  }

  return false;
}

export async function handleAdminMessage(message) {
  const userId = message.from.id;
  const text = (message.text || "").trim();
  const chatId = message.chat.id;

  const waiting = waitingPrice.get(userId);
  if (waiting && !text.startsWith("/")) {
    if (
      text.startsWith("/start") ||
      ["Купить", "Buy", "Помощь", "Help", "Мои покупки", "My orders", "Админка", "Admin", "Поддержка", "Support", "Язык", "Language"].includes(text)
    ) {
      waitingPrice.delete(userId);
      return false;
    }
    if (waiting === SALE_WAIT) {
      try {
        const value = await setDiscount(text);
        waitingPrice.delete(userId);
        await sendMessage(
          chatId,
          value > 0
            ? `Скидка на все ключи: <b>−${value}%</b>`
            : "Скидка снята. Стоят базовые цены."
        );
        await showAdmin(chatId);
      } catch {
        await sendMessage(chatId, "Нужно число от 0 до 99, например 20");
      }
      return true;
    }
    try {
      const price = await setUsdt(waiting, text);
      waitingPrice.delete(userId);
      await sendMessage(
        chatId,
        `${productById(waiting).title}: базовая <b>${price} USDT</b>\nСо скидкой: ${priceLabel(waiting)}`
      );
    } catch {
      await sendMessage(chatId, "Нужно число больше 0, например 12.5");
    }
    return true;
  }

  if (text === "Админка" || text === "Admin" || text === "/admin") {
    await showAdmin(chatId);
    return true;
  }

  if (text.startsWith("/keys")) {
    const extra = text.replace("/keys", "").trim();
    if (!extra) {
      await showAdmin(chatId);
      return true;
    }
    const [rawId, ...rest] = extra.split(/[\s,]+/).filter(Boolean);
    const product = productById(rawId.toLowerCase());
    if (!product || !rest.length) {
      await sendMessage(
        chatId,
        "Формат: <code>/keys 7d KEY1 KEY2</code>\nСроки: 1d · 3d · 7d · 30d"
      );
      return true;
    }
    const total = await addKeys(product.id, rest);
    await sendMessage(
      chatId,
      `В ${product.title} добавлено ${rest.length}. Сейчас: <b>${total}</b> шт.`
    );
    return true;
  }

  if (text.startsWith("/del")) {
    const extra = text.replace("/del", "").trim();
    const [rawId, rawIndex] = extra.split(/\s+/);
    const product = productById((rawId || "").toLowerCase());
    const index = Number(rawIndex) - 1;
    if (!product || !Number.isInteger(index)) {
      await sendMessage(chatId, "Формат: <code>/del 7d 1</code>");
      return true;
    }
    const removed = await removeKey(product.id, index);
    await sendMessage(
      chatId,
      removed ? `Удалён: <code>${removed}</code>` : "Нет такого номера."
    );
    return true;
  }

  if (text.startsWith("/price")) {
    const extra = text.replace("/price", "").trim();
    const [rawId, rawPrice] = extra.split(/\s+/);
    const product = productById((rawId || "").toLowerCase());
    if (!product || !rawPrice) {
      await sendMessage(chatId, "Формат: <code>/price 7d 18.5</code>");
      return true;
    }
    try {
      const price = await setUsdt(product.id, rawPrice);
      await sendMessage(
        chatId,
        `${product.title}: базовая <b>${price} USDT</b>\nСо скидкой: ${priceLabel(product.id)}`
      );
    } catch {
      await sendMessage(chatId, "Цена должна быть числом больше 0.");
    }
    return true;
  }

  if (text.startsWith("/sale") || text.startsWith("/discount")) {
    waitingPrice.delete(userId);
    const extra = text.replace(/^\/(sale|discount)/i, "").trim();
    if (!extra) {
      waitingPrice.set(userId, SALE_WAIT);
      const current = getDiscount();
      await sendMessage(
        chatId,
        [
          "<b>Скидка на все ключи</b>",
          current > 0 ? `Сейчас: <b>−${current}%</b>` : "Сейчас скидки нет.",
          "",
          "Напиши процент, например <code>20</code>",
          "Снять: <code>/sale 0</code>",
        ].join("\n")
      );
      return true;
    }
    try {
      const value = await setDiscount(extra);
      await sendMessage(
        chatId,
        value > 0
          ? `Скидка на все ключи: <b>−${value}%</b>`
          : "Скидка снята. Стоят базовые цены."
      );
      await showAdmin(chatId);
    } catch {
      await sendMessage(chatId, "Формат: <code>/sale 20</code> или <code>/sale 0</code>");
    }
    return true;
  }

  return false;
}
