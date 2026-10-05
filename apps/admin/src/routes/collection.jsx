import { useParams } from 'react-router'
import { HistoryPanel } from '@/components/history-panel'
import { CollectionEditor } from '@/features/catalog/components/collection-editor'

/** `/collections/:id`. */
export function Component() {
  const { id } = useParams()
  return (
    <>
      <CollectionEditor key={id} id={id} />
      {id ? <HistoryPanel entityType="collection" entityId={id} /> : null}
    </>
  )
}
