export const BRAND_HTML = "<b>Interium.ware</b> | Rust External";
export const RULE = "──────────────";

export function catalogBody(items) {
  return [
    BRAND_HTML,
    RULE,
    "",
    ...items,
    "",
    RULE,
    "Оплата <b>USDT</b> через @send",
    "После оплаты ключ приходит автоматически.",
  ].join("\n");
}

export function productLine(title, price, stock) {
  const status = stock > 0 ? `в наличии · ${stock} шт.` : "нет в наличии";
  return `<b>${title}</b>\n${price} USDT  ·  ${status}`;
}

export function welcomeText() {
  return [
    BRAND_HTML,
    RULE,
    "",
    "Магазин лицензий.",
    "Оплата USDT через Crypto Pay (@send).",
    "",
    "Нажми <b>Купить</b>, выбери срок — после оплаты ключ придёт сюда сам.",
  ].join("\n");
}

export function helpText() {
  return [
    BRAND_HTML,
    RULE,
    "",
    "<b>Как купить</b>",
    "",
    "1. Нажми <b>Купить</b> и выбери срок",
    "2. Оплати счёт в @send — на это 15 минут",
    "3. Ключ придёт в этот чат автоматически",
    "",
    "Новый «Купить» отменяет старый неоплаченный счёт.",
  ].join("\n");
}

export function ordersText() {
  return [
    BRAND_HTML,
    RULE,
    "",
    "Ключи приходят сюда сразу после оплаты.",
    "Если сообщение потерялось — напиши админу.",
  ].join("\n");
}

export function invoiceText(title, amount, cancelled) {
  return [
    BRAND_HTML,
    `<b>${title}</b>`,
    RULE,
    "",
    ...(cancelled ? ["Неоплаченный счёт отменён.", ""] : []),
    `К оплате: <b>${amount} USDT</b>`,
    "На оплату 15 минут.",
    "",
    "Оплати через кнопку ниже.",
    "Новый «Купить» отменяет этот счёт.",
  ].join("\n");
}

export function paidText(title, days, key, amount) {
  return [
    "<b>Оплата получена</b>",
    RULE,
    "",
    BRAND_HTML,
    `<b>${title}</b>`,
    `Срок: ${days} дн.`,
    `Сумма: <b>${amount} USDT</b>`,
    "",
    `Ключ: <code>${key}</code>`,
    "",
    "Сохрани это сообщение.",
  ].join("\n");
}

export function outOfStockText() {
  return [
    BRAND_HTML,
    RULE,
    "",
    "Сейчас этого срока нет.",
    "Выбери другой или подожди пополнение.",
  ].join("\n");
}
