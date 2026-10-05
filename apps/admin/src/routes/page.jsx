import { useParams } from 'react-router'
import { HistoryPanel } from '@/components/history-panel'
import { PageEditor } from '@/features/content/components/page-editor'

/** `/content/pages/:id`. */
export function Component() {
  const { id } = useParams()
  return (
    <>
      <PageEditor key={id} id={id} />
      {id ? <HistoryPanel entityType="page" entityId={id} /> : null}
    </>
  )
}
