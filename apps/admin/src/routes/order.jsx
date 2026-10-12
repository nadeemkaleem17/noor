import { useParams } from 'react-router'
import { OrderDetail } from '@/features/orders/components/order-detail'

/** `/orders/:id`: the id is the UUID or the number on the screen. */
export function Component() {
  const { id } = useParams()
  return <OrderDetail key={id} id={id ?? ''} />
}
