// What an order holds in stock: a bundle holds its chosen children, any other counted line holds its own variant; made-to-order and pre-order lines hold nothing.

/**
 * @param {{ id: string, quantity: number, variantId: string, kind: string, stockMode: string, customization?: { bundle?: { variantId: string }[] } }[]} lines `id` is the order line's id
 * @returns {{ orderLineId: string, variantId: string, quantity: number }[]}
 */
export function holdsOf(lines) {
  return lines.flatMap((l) =>
    l.kind === 'bundle' && l.customization?.bundle
      ? l.customization.bundle.map((b) => ({ orderLineId: l.id, variantId: b.variantId, quantity: l.quantity }))
      : l.stockMode === 'counted'
        ? [{ orderLineId: l.id, variantId: l.variantId, quantity: l.quantity }]
        : [],
  )
}
