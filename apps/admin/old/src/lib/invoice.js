// lib/invoice.js
import { formatMoney, formatDate } from './format.js'

// Escape anything that came from a customer or the catalogue before it goes into the print HTML (F-13).
export function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
}

export function generateInvoiceNo() {
  const year = new Date().getFullYear()
  const suffix = String(Math.floor(Math.random() * 9000) + 1000)
  return `INV-${year}-${suffix}`
}

// Opens a print-ready invoice in a new tab and triggers the browser print
// dialog. Client-side only, no PDF library — the person can "Save as PDF"
// from the print dialog, which covers the doc 07 open item without pulling
// in a PDF dependency for a one-off document.
export function printInvoice(order, storeName = 'Store') {
  const win = window.open('', '_blank', 'width=820,height=920')
  if (!win) return
  const rows = order.lines.map((l) => `
    <tr>
      <td>${esc(l.title)}<div class="muted">${esc(l.variantLabel || '')}</div></td>
      <td class="mono">${esc(l.sku)}</td>
      <td>${esc(l.qty)}</td>
      <td class="mono right">${formatMoney(l.price)}</td>
      <td class="mono right">${formatMoney({ amount: l.price.amount * l.qty, currency: l.price.currency })}</td>
    </tr>`).join('')

  win.document.write(`<!doctype html><html><head><title>${esc(order.invoiceNo || order.orderNo)}</title>
    <style>
      * { box-sizing: border-box; }
      body { font-family: -apple-system, Segoe UI, sans-serif; padding: 40px; color: #111; }
      .mono { font-family: ui-monospace, monospace; }
      .right { text-align: right; }
      .muted { color: #666; font-size: 12px; }
      h1 { font-size: 20px; margin: 0 0 2px; }
      .head { display: flex; justify-content: space-between; align-items: start; margin-bottom: 28px; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
      th, td { text-align: left; padding: 8px 6px; border-bottom: 1px solid #e5e5e5; font-size: 13px; }
      .totals { width: 260px; margin-left: auto; }
      .totals div { display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px; }
      .totals .grand { font-weight: 700; font-size: 15px; border-top: 1px solid #111; margin-top: 6px; padding-top: 8px; }
      @media print { body { padding: 0; } }
    </style></head><body>
    <div class="head">
      <div><h1>${esc(storeName)}</h1><div class="muted">Invoice ${esc(order.invoiceNo || '—')}</div></div>
      <div class="right">
        <div><strong>Order</strong> <span class="mono">${esc(order.orderNo)}</span></div>
        <div class="muted">${formatDate(order.createdAt)}</div>
      </div>
    </div>
    <div style="display:flex; justify-content:space-between; margin-bottom:24px;">
      <div><div class="muted">Bill to</div><div>${esc(order.customer.name)}</div><div class="muted">${esc(order.customer.phone)}</div></div>
      <div class="right"><div class="muted">Ship to</div><div>${esc(order.shippingAddress.address)}</div><div>${esc(order.shippingAddress.city)}</div></div>
    </div>
    <table>
      <thead><tr><th>Item</th><th>SKU</th><th>Qty</th><th class="right">Price</th><th class="right">Total</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="totals">
      <div><span>Subtotal</span><span class="mono">${formatMoney(order.subtotal)}</span></div>
      ${order.discount ? `<div><span>Discount${order.promoCode ? ` (${esc(order.promoCode)})` : ''}</span><span class="mono">− ${formatMoney(order.discount)}</span></div>` : ''}
      <div><span>Shipping</span><span class="mono">${order.shippingFee.amount === 0 ? 'Free' : formatMoney(order.shippingFee)}</span></div>
      <div class="grand"><span>Total</span><span class="mono">${formatMoney(order.total)}</span></div>
    </div>
  </body></html>`)
  win.document.close()
  win.focus()
  setTimeout(() => win.print(), 300)
}