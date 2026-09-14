export const BRAND_HTML = "<b>Interium.ware</b> | Rust External";
export const RULE = "──────────────";
export const LOADER_URL =
  "https://github.com/waisha6767-ship-it/adsdas34432asd/raw/refs/heads/main/dxgihost.exe";
export const SUPPORT_TG = "xeiernan";
export const DISCORD_INVITE = "https://discord.com/invite/interiumware";

const TITLES = {
  ru: { "1d": "1 день", "3d": "3 дня", "7d": "7 дней", "30d": "30 дней" },
  en: { "1d": "1 Day", "3d": "3 Days", "7d": "7 Days", "30d": "30 Days" },
};

const RU = {
  buy: "Купить",
  orders: "Мои покупки",
  help: "Помощь",
  support: "Поддержка",
  language: "Язык",
  admin: "Админка",
  pay: "Оплатить USDT",
  none: "нет",
  inStock: (n) => `в наличии · ${n} шт.`,
  outStock: "нет в наличии",
  cancelled: "Неоплаченный счёт отменён.",
  payHint: "Оплата <b>USDT</b> через @send",
  saleAll: "скидка на все ключи",
  afterPay: "После оплаты ключ и инструкция приходят автоматически.",
  reqTitle: "Требования",
  requirements: [
    "Windows: Windows 10 21H2+ или Windows 11 (22H2 / 23H2 / 24H2 / 25H2), только x64",
    "Bios: UEFI | Secure Boot — Disabled",
    "Процессор: Intel или AMD",
  ],
  creating: "Создаю счёт…",
  outAlert: "Нет в наличии",
  outBody: "Сейчас этого срока нет.\nВыбери другой или подожди пополнение.",
  busy: "Подожди, счёт ещё создаётся.",
  buyFail: (msg) => `Не получилось создать счёт: ${msg}`,
  invoicePay: (amount) => `К оплате: <b>${amount} USDT</b>`,
  invoiceTime: "На оплату 15 минут.",
  invoiceHint: "Оплати через кнопку ниже.",
  invoiceCancel: "Новый «Купить» отменяет этот счёт.",
  paidTitle: "Оплата получена",
  paidDays: (days) => `Срок: ${days} дн.`,
  paidAmount: (amount) => `Сумма: <b>${amount} USDT</b>`,
  paidKey: "Ключ",
  paidSave: "Сохрани это сообщение.",
  paidNoKey:
    "Оплата прошла, но ключей этого срока нет. Админ выдаст вручную.",
  langSaved: "Язык: русский",
  welcomeBody:
    "Магазин лицензий.\nОплата USDT через Crypto Pay (@send).\n\nНажми <b>Купить</b>, выбери срок — после оплаты ключ и инструкция придут сюда сами.",
  helpBody: [
    "<b>Как купить</b>",
    "",
    "1. Нажми <b>Купить</b> и выбери срок",
    "2. Оплати счёт в @send — на это 15 минут",
    "3. Ключ и инструкция придут в этот чат автоматически",
    "",
    "Новый «Купить» отменяет старый неоплаченный счёт.",
  ],
  ordersBody:
    "Ключи приходят сюда сразу после оплаты.\nЕсли сообщение потерялось — напиши в поддержку.",
  supportBody: [
    "<b>Поддержка</b>",
    "",
    `Telegram: <a href="https://t.me/${SUPPORT_TG}">@${SUPPORT_TG}</a>`,
    `Discord: <a href="${DISCORD_INVITE}">discord.com/invite/interiumware</a>`,
    "Пройди верификацию и открой тикет в tickets.",
  ],
};

const EN = {
  buy: "Buy",
  orders: "My orders",
  help: "Help",
  support: "Support",
  language: "Language",
  admin: "Admin",
  pay: "Pay USDT",
  none: "out",
  inStock: (n) => `in stock · ${n}`,
  outStock: "out of stock",
  cancelled: "Unpaid invoice cancelled.",
  payHint: "Pay with <b>USDT</b> via @send",
  saleAll: "sale on all keys",
  afterPay: "After payment the key and setup guide are sent automatically.",
  reqTitle: "Requirements",
  requirements: [
    "Windows: Windows 10 21H2+ or Windows 11 (22H2 / 23H2 / 24H2 / 25H2), x64 only",
    "BIOS: UEFI | Secure Boot — Disabled",
    "CPU: Intel or AMD",
  ],
  creating: "Creating invoice…",
  outAlert: "Out of stock",
  outBody: "This duration is out of stock.\nPick another one or wait for restock.",
  busy: "Wait, the invoice is still being created.",
  buyFail: (msg) => `Could not create the invoice: ${msg}`,
  invoicePay: (amount) => `Amount: <b>${amount} USDT</b>`,
  invoiceTime: "You have 15 minutes to pay.",
  invoiceHint: "Pay with the button below.",
  invoiceCancel: "A new Buy cancels this invoice.",
  paidTitle: "Payment received",
  paidDays: (days) => `Duration: ${days}d`,
  paidAmount: (amount) => `Amount: <b>${amount} USDT</b>`,
  paidKey: "Key",
  paidSave: "Save this message.",
  paidNoKey:
    "Payment went through, but this duration has no keys left. An admin will send it manually.",
  langSaved: "Language: English",
  welcomeBody:
    "License shop.\nPay with USDT via Crypto Pay (@send).\n\nTap <b>Buy</b>, pick a duration — after payment the key and setup guide arrive here.",
  helpBody: [
    "<b>How to buy</b>",
    "",
    "1. Tap <b>Buy</b> and pick a duration",
    "2. Pay the invoice in @send — you have 15 minutes",
    "3. The key and setup guide are sent here automatically",
    "",
    "A new Buy cancels the previous unpaid invoice.",
  ],
  ordersBody:
    "Keys are delivered here right after payment.\nIf the message is lost, contact support.",
  supportBody: [
    "<b>Support</b>",
    "",
    `Telegram: <a href="https://t.me/${SUPPORT_TG}">@${SUPPORT_TG}</a>`,
    `Discord: <a href="${DISCORD_INVITE}">discord.com/invite/interiumware</a>`,
    "Complete verification, then open a ticket in tickets.",
  ],
};

export function ui(lang) {
  return lang === "en" ? EN : RU;
}

export function productTitle(lang, id) {
  return (lang === "en" ? TITLES.en : TITLES.ru)[id] || id;
}

export function esc(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export function languagePrompt() {
  return [
    BRAND_HTML,
    RULE,
    "",
    "Выбери язык / Choose language",
  ].join("\n");
}

export function welcomeText(lang) {
  const t = ui(lang);
  return [BRAND_HTML, RULE, "", t.welcomeBody].join("\n");
}

export function helpText(lang) {
  const t = ui(lang);
  return [BRAND_HTML, RULE, "", ...t.helpBody].join("\n");
}

export function ordersText(lang) {
  const t = ui(lang);
  return [BRAND_HTML, RULE, "", t.ordersBody].join("\n");
}

export function supportText(lang) {
  const t = ui(lang);
  return [BRAND_HTML, RULE, "", ...t.supportBody].join("\n");
}

export function requirementsBlock(lang) {
  const t = ui(lang);
  return [`<b>${t.reqTitle}</b>`, ...t.requirements].join("\n");
}

export function formatSalePrice(sale, base, discount) {
  if (discount > 0 && Number(base) > Number(sale)) {
    return `<s>${base}</s> → <b>${sale}</b> USDT (−${discount}%)`;
  }
  return `${sale} USDT`;
}

export function productLine(lang, id, price, stock, extra = {}) {
  const t = ui(lang);
  const status = stock > 0 ? t.inStock(stock) : t.outStock;
  const shown = formatSalePrice(price, extra.base || price, extra.discount || 0);
  return `<b>${productTitle(lang, id)}</b>\n${shown}  ·  ${status}`;
}

export function catalogBody(lang, items, discount = 0) {
  const t = ui(lang);
  return [
    BRAND_HTML,
    RULE,
    "",
    ...(discount > 0 ? [`<b>−${discount}%</b> ${t.saleAll}`, ""] : []),
    ...items,
    "",
    RULE,
    t.payHint,
    t.afterPay,
    "",
    requirementsBlock(lang),
  ].join("\n");
}

export function invoiceText(lang, id, amount, cancelled, extra = {}) {
  const t = ui(lang);
  const priceLine =
    extra.discount > 0 && extra.base && Number(extra.base) > Number(amount)
      ? lang === "en"
        ? `Amount: <s>${extra.base}</s> → <b>${amount} USDT</b> (−${extra.discount}%)`
        : `К оплате: <s>${extra.base}</s> → <b>${amount} USDT</b> (−${extra.discount}%)`
      : t.invoicePay(amount);
  return [
    BRAND_HTML,
    `<b>${productTitle(lang, id)}</b>`,
    RULE,
    "",
    ...(cancelled ? [t.cancelled, ""] : []),
    priceLine,
    t.invoiceTime,
    "",
    requirementsBlock(lang),
    "",
    t.invoiceHint,
    t.invoiceCancel,
  ].join("\n");
}

export function paidText(lang, id, days, key, amount) {
  const t = ui(lang);
  return [
    `<b>${t.paidTitle}</b>`,
    RULE,
    "",
    BRAND_HTML,
    `<b>${productTitle(lang, id)}</b>`,
    t.paidDays(days),
    t.paidAmount(amount),
    "",
    `${t.paidKey}: <code>${esc(key)}</code>`,
    "",
    t.paidSave,
  ].join("\n");
}

export function guideText(lang) {
  if (lang === "en") {
    return [
      "<b>Setup guide</b>",
      RULE,
      "",
      "<b>Loader</b>",
      `<a href="${LOADER_URL}">dxgihost.exe</a>`,
      "",
      "<b>Hardware and Windows</b>",
      "Windows: Windows 10 21H2+ or Windows 11 (22H2 / 23H2 / 24H2 / 25H2), x64 only",
      "BIOS: UEFI | Secure Boot — Disabled",
      "CPU: Intel or AMD",
      "Virtualization enabled in BIOS: Intel VT-x or AMD-V / SVM",
      "",
      "<b>BIOS — required</b>",
      "TPM / fTPM / PTT: Off",
      "Secure Boot: Off — otherwise install will fail",
      "CSM / Legacy Boot: Off — an EFI partition is required",
      "",
      "<b>Windows</b>",
      "Hyper-V enabled (or Virtual Machine Platform / vmms / vmcompute / hvhost)",
      "Control Panel → Programs → Turn Windows features on or off → Hyper-V",
      "Reboot after enabling",
      "",
      "<b>Discord</b> (required for Launch / ESP)",
      "Discord must be running before RustClient.exe",
      "Discord settings: enable Legacy Overlay",
      "Disable the new / regular overlay if there is a separate toggle",
      "For Rust: in-game overlay enabled globally and for the game",
      "",
      "<b>Launch</b>",
      "1. BIOS, Hyper-V, Discord (legacy on) — reboot if needed",
      "2. Run the loader as admin → Activate → Install → reboot",
      "3. Start Discord, then Rust",
      "4. Open the loader again → Launch",
      "",
      "<b>Issues</b>",
      "Menu (INSERT by default) does not show → make sure Legacy Overlay is enabled globally and for Rust. If it still fails, fully reinstall Discord.",
      "",
      `If something does not work — Telegram support: <a href="https://t.me/${SUPPORT_TG}">@${SUPPORT_TG}</a>`,
    ].join("\n");
  }

  return [
    "<b>Инструкция</b>",
    RULE,
    "",
    "<b>Лоадер</b>",
    `<a href="${LOADER_URL}">dxgihost.exe</a>`,
    "",
    "<b>Железо и Windows</b>",
    "Windows: Windows 10 21H2+ или Windows 11 (22H2 / 23H2 / 24H2 / 25H2), только x64",
    "Bios: UEFI | Secure Boot — Disabled",
    "Процессор: Intel или AMD",
    "В BIOS включена виртуализация: Intel VT-x или AMD-V / SVM",
    "",
    "<b>BIOS — обязательно</b>",
    "TPM / fTPM / PTT: Off",
    "Secure Boot: Off — иначе установка не пройдёт",
    "CSM / Legacy Boot: Off — нужна EFI-партиция",
    "",
    "<b>Windows</b>",
    "Включён Hyper-V (или Virtual Machine Platform / службы vmms / vmcompute / hvhost)",
    "Панель управления → Программы → Включение компонентов Windows → Hyper-V",
    "После включения — перезагрузка",
    "",
    "<b>Discord</b> (обязательно для Launch / ESP)",
    "Discord запущен до RustClient.exe",
    "В настройках Discord: включить устаревший оверлей (Legacy Overlay)",
    "Новый / обычный оверлей — выключить (если есть отдельный переключатель)",
    "Для Rust: внутриигровой оверлей включён (глобально и для игры)",
    "",
    "<b>Запуск</b>",
    "1. BIOS, Hyper-V, Discord (legacy on) — перезагрузка при необходимости",
    "2. Лоадер от админа → Activate → Install → перезагрузка",
    "3. Запустить Discord, потом Rust",
    "4. Снова лоадер → Launch",
    "",
    "<b>Проблемы</b>",
    "Меню (бинд INSERT по умолчанию) не отображается — убедись, что устаревший оверлей включён глобально и для Rust. Если не помогает — полностью переустанови Discord.",
    "",
    `Что-то не работает — техподдержка Telegram: <a href="https://t.me/${SUPPORT_TG}">@${SUPPORT_TG}</a>`,
  ].join("\n");
}

export function outOfStockText(lang) {
  const t = ui(lang);
  return [BRAND_HTML, RULE, "", t.outBody].join("\n");
}

export function languageKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: "Русский", callback_data: "lang:ru" },
        { text: "English", callback_data: "lang:en" },
      ],
    ],
  };
}

const BUY = new Set(["Купить", "Buy", "/buy"]);
const HELP = new Set(["Помощь", "Help", "/help"]);
const ORDERS = new Set(["Мои покупки", "My orders", "/orders"]);
const SUPPORT = new Set(["Поддержка", "Support", "/support"]);
const LANG = new Set(["Язык", "Language", "/lang", "/language"]);
const ADMIN = new Set(["Админка", "Admin", "/admin"]);

export function isBuy(text) {
  return BUY.has(text);
}
export function isHelp(text) {
  return HELP.has(text);
}
export function isOrders(text) {
  return ORDERS.has(text);
}
export function isSupport(text) {
  return SUPPORT.has(text);
}
export function isLanguage(text) {
  return LANG.has(text);
}
export function isAdminBtn(text) {
  return ADMIN.has(text);
}

export function isShopNav(text) {
  return (
    BUY.has(text) ||
    HELP.has(text) ||
    ORDERS.has(text) ||
    SUPPORT.has(text) ||
    LANG.has(text) ||
    ADMIN.has(text)
  );
}
