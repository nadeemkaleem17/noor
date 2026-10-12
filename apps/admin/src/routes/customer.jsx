import { useParams } from 'react-router'
import { CustomerDetail } from '@/features/customers/components/customer-detail'
import { CustomerOrders } from '@/features/orders/components/customer-orders'
import { useCan } from '@/lib/session'

/** `/customers/:id`: the customer, with their orders from the orders feature (features are composed here, not imported into each other). */
export function Component() {
  const { id } = useParams()
  const can = useCan()
  return <CustomerDetail key={id} id={id ?? ''} orders={can('orders:read') && id ? <CustomerOrders customerId={id} /> : null} />
}
