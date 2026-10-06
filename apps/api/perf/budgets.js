// The p95 budgets in milliseconds for `perf.test.js` (plan/13-quality.md section 6.2), on the shop at its planned size (3,000 products, 25,000 variants, 20,000 orders).
// Each is the slowest p95 of five measured runs on the development machine (2026-10-06) times 1.5 (DOC-13 Q-13-2), rounded up to 5 ms, and never under 10 ms (below that
// a timer measures noise). They guard against a regression; they are not promises about production. The last run's own numbers are written to `.data/perf-report.json`.
/** @type {Record<string, number>} */
export const budgets = {
  'catalog.listProducts': 10, // measured 1.6 to 3.6
  'catalog.getProduct': 50, // 21.3 to 32.1
  'cart.get': 10, // 0.3 to 1
  'cart.addLine': 85, // 32.4 to 54.4
  'cart.quote': 10, // 0.6 to 1.5
  'orders.create': 390, // 108 to 259.2 (3 lines, a promo code, one transaction)
  'orders.getByToken': 20, // 6.2 to 11
  'admin.orders.list': 65, // 15.9 to 42.2 (a status and a name search)
  'admin.products.list': 225, // 96 to 149.1
  'admin.dashboard.summary': 125, // 43.1 to 80.5 (30 days)
  'admin.search': 45, // 17 to 29.2
}
