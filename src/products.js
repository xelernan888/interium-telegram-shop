export const PRODUCTS = [
  {
    id: "1d",
    title: "1 Day",
    days: 1,
    usd: "6.00",
    rub: 500,
  },
  {
    id: "3d",
    title: "3 Days",
    days: 3,
    usd: "13.00",
    rub: 1100,
  },
  {
    id: "7d",
    title: "7 Days",
    days: 7,
    usd: "22.00",
    rub: 1900,
  },
  {
    id: "30d",
    title: "30 Days",
    days: 30,
    usd: "40.00",
    rub: 3500,
  },
];

export function productById(id) {
  return PRODUCTS.find((item) => item.id === id) ?? null;
}

export function defaultUsdt(productId) {
  return productById(productId)?.usd || "0";
}
