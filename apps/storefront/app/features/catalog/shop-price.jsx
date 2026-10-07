import { Price } from '@noor/ui/price'
import { useShell } from '../layout/use-shell'

/** A price drawn as the shop set it up (decimals, rounding): `Price` with the store's `priceDisplay` filled in. @param {Omit<import('react').ComponentProps<typeof Price>, 'display'>} props */
export function ShopPrice(props) {
  return <Price {...props} display={useShell()?.config.priceDisplay} />
}
