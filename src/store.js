import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { PRODUCTS, defaultUsdt } from "./products.js";

const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "shop.json");
export const HOLD_MS = 15 * 60 * 1000;

function emptyKeys() {
  return Object.fromEntries(PRODUCTS.map((item) => [item.id, []]));
}

function emptyPrices() {
  return Object.fromEntries(
    PRODUCTS.map((item) => [item.id, defaultUsdt(item.id)])
  );
}

const empty = () => ({
  orders: {},
  keys: emptyKeys(),
  prices: emptyPrices(),
});

let db = empty();
let ready = false;

function normalizeKeys(raw) {
  const keys = emptyKeys();
  if (!raw || Array.isArray(raw)) return keys;
  for (const product of PRODUCTS) {
    const list = raw[product.id];
    keys[product.id] = Array.isArray(list)
      ? list.map((item) => String(item).trim()).filter(Boolean)
      : [];
  }
  return keys;
}

function normalizePrices(raw) {
  const prices = emptyPrices();
  if (!raw || typeof raw !== "object") return prices;
  for (const product of PRODUCTS) {
    const value = raw[product.id];
    if (value != null && Number(value) > 0) {
      prices[product.id] = Number(value).toFixed(2);
    }
  }
  return prices;
}

export async function loadStore() {
  try {
    const parsed = JSON.parse(await readFile(FILE, "utf8"));
    db = {
      orders:
        parsed.orders && typeof parsed.orders === "object" ? parsed.orders : {},
      keys: normalizeKeys(parsed.keys),
      prices: normalizePrices(parsed.prices),
    };
  } catch {
    db = empty();
  }
  ready = true;
}

async function saveStore() {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(FILE, JSON.stringify(db, null, 2), "utf8");
}

function ensure() {
  if (!ready) throw new Error("store not loaded");
}

export function getUsdt(productId) {
  ensure();
  return db.prices[productId] || defaultUsdt(productId);
}

export async function setUsdt(productId, amount) {
  ensure();
  const value = Number(String(amount).replace(",", "."));
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error("bad_price");
  }
  db.prices[productId] = value.toFixed(2);
  await saveStore();
  return db.prices[productId];
}

export function listKeys(productId) {
  ensure();
  return [...(db.keys[productId] || [])];
}

export function getOrder(invoiceId) {
  ensure();
  return db.orders[String(invoiceId)] ?? null;
}

export async function saveOrder(order) {
  ensure();
  db.orders[String(order.invoiceId)] = order;
  await saveStore();
}

function giveBack(productId, key) {
  if (!key || !productId) return;
  db.keys[productId] ??= [];
  if (!db.keys[productId].includes(key)) {
    db.keys[productId].push(key);
  }
}

export async function releaseHold(order, reason = "expired") {
  ensure();
  if (!order || order.status !== "pending") return false;
  if (order.reservedKey) giveBack(order.productId, order.reservedKey);
  order.status = reason;
  order.reservedKey = null;
  await saveStore();
  return true;
}

export async function releaseExpiredHolds() {
  ensure();
  const now = Date.now();
  const expired = [];
  for (const order of Object.values(db.orders)) {
    if (order.status !== "pending" || !order.reservedKey) continue;
    const created = Date.parse(order.createdAt || "") || 0;
    if (now - created < HOLD_MS) continue;
    giveBack(order.productId, order.reservedKey);
    order.status = "expired";
    order.reservedKey = null;
    expired.push(order.invoiceId);
  }
  if (expired.length) await saveStore();
  return expired;
}

export function pendingOrdersForUser(userId) {
  ensure();
  return Object.values(db.orders).filter(
    (order) => order.status === "pending" && Number(order.userId) === Number(userId)
  );
}

export function keyCount(productId) {
  ensure();
  if (productId) return db.keys[productId]?.length ?? 0;
  return PRODUCTS.reduce(
    (sum, item) => sum + (db.keys[item.id]?.length ?? 0),
    0
  );
}

export async function takeKey(productId) {
  ensure();
  const list = db.keys[productId];
  if (!list?.length) return null;
  const key = list.shift();
  await saveStore();
  return key;
}

export async function addKeys(productId, keys) {
  ensure();
  if (!db.keys[productId]) db.keys[productId] = [];
  db.keys[productId].push(...keys.map((item) => String(item).trim()).filter(Boolean));
  await saveStore();
  return db.keys[productId].length;
}

export async function removeKey(productId, index) {
  ensure();
  const list = db.keys[productId] || [];
  if (index < 0 || index >= list.length) return null;
  const [removed] = list.splice(index, 1);
  await saveStore();
  return removed;
}

export async function removeKeyByValue(productId, value) {
  ensure();
  const list = db.keys[productId] || [];
  const index = list.findIndex((item) => item === value);
  if (index < 0) return null;
  return removeKey(productId, index);
}

export function paidCount() {
  ensure();
  return Object.values(db.orders).filter((order) => order.status === "paid")
    .length;
}

export function stockLines() {
  ensure();
  return PRODUCTS.map((item) => {
    const keys = db.keys[item.id] || [];
    const price = getUsdt(item.id);
    if (!keys.length) {
      return `<b>${item.title}</b> — ${price} USDT — нет ключей`;
    }
    return [
      `<b>${item.title}</b> — ${price} USDT — ${keys.length} шт.`,
      ...keys.map((key, index) => `${index + 1}. <code>${key}</code>`),
    ].join("\n");
  });
}
