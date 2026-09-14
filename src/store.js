import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { PRODUCTS } from "./products.js";

const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "shop.json");
const HOLD_MS = 30 * 60 * 1000;

function emptyKeys() {
  return Object.fromEntries(PRODUCTS.map((item) => [item.id, []]));
}

const empty = () => ({
  orders: {},
  keys: emptyKeys(),
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

export async function loadStore() {
  try {
    const parsed = JSON.parse(await readFile(FILE, "utf8"));
    db = {
      orders: parsed.orders && typeof parsed.orders === "object" ? parsed.orders : {},
      keys: normalizeKeys(parsed.keys),
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

export function getOrder(invoiceId) {
  ensure();
  return db.orders[String(invoiceId)] ?? null;
}

export async function saveOrder(order) {
  ensure();
  db.orders[String(order.invoiceId)] = order;
  await saveStore();
}

export async function releaseExpiredHolds() {
  ensure();
  const now = Date.now();
  let changed = false;
  for (const order of Object.values(db.orders)) {
    if (order.status !== "pending" || !order.reservedKey) continue;
    const created = Date.parse(order.createdAt || "") || 0;
    if (now - created < HOLD_MS) continue;
    db.keys[order.productId] ??= [];
    db.keys[order.productId].push(order.reservedKey);
    order.status = "expired";
    order.reservedKey = null;
    changed = true;
  }
  if (changed) await saveStore();
}

export function keyCount(productId) {
  ensure();
  if (productId) return db.keys[productId]?.length ?? 0;
  return PRODUCTS.reduce((sum, item) => sum + (db.keys[item.id]?.length ?? 0), 0);
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
  db.keys[productId].push(...keys);
  await saveStore();
  return db.keys[productId].length;
}

export function paidCount() {
  ensure();
  return Object.values(db.orders).filter((order) => order.status === "paid")
    .length;
}

export function stockLines() {
  ensure();
  return PRODUCTS.map(
    (item) => `${item.title} (${item.id}): ${db.keys[item.id]?.length ?? 0} шт.`
  );
}
