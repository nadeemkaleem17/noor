import { useParams } from 'react-router'
import { OrderDeliveryPanel } from '@/features/delivery/components/order-panel'
import { OrderDetail } from '@/features/orders/components/order-detail'
import { OrderReturnsPanel } from '@/features/returns/components/order-panel'

/** `/orders/:id`: the id is the UUID or the number on the screen. The delivery history and the return requests are composed in here (a feature does not import another); it asks by the UUID, which the order gives once loaded. */
export function Component() {
  const { id } = useParams()
  return <OrderDetail key={id} id={id ?? ''} delivery={(orderId) => (
        <>
          <OrderDeliveryPanel orderId={orderId} />
          <OrderReturnsPanel orderId={orderId} />
        </>
      )} />
}
