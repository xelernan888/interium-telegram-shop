import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "shop.json");

const empty = () => ({
  orders: {},
  keys: [],
});

let db = empty();
let ready = false;

export async function loadStore() {
  try {
    db = { ...empty(), ...JSON.parse(await readFile(FILE, "utf8")) };
    if (!db.orders) db.orders = {};
    if (!Array.isArray(db.keys)) db.keys = [];
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

export function takeKey() {
  ensure();
  if (!db.keys.length) return null;
  const key = db.keys.shift();
  return key;
}

export async function addKeys(keys) {
  ensure();
  db.keys.push(...keys);
  await saveStore();
  return db.keys.length;
}

export function keyCount() {
  ensure();
  return db.keys.length;
}

export function paidCount() {
  ensure();
  return Object.values(db.orders).filter((order) => order.status === "paid")
    .length;
}
