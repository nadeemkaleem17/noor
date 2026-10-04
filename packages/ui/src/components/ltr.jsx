
/**
 * Keeps order numbers, SKUs, phone numbers and prices left-to-right inside right-to-left text.
 * @param {{ children: import('react').ReactNode; }} props
 */
export function Ltr({ children }) {
  return <bdi dir="ltr">{children}</bdi>
}
