import { useParams } from 'react-router'
import { HistoryPanel } from '@/components/history-panel'
import { ProductEditor } from '@/features/products/components/product-editor'

/** `/products/:id`. */
export function Component() {
  const { id } = useParams()
  return (
    <>
      <ProductEditor key={id} id={id} />
      {id ? <HistoryPanel entityType="product" entityId={id} /> : null}
    </>
  )
}
