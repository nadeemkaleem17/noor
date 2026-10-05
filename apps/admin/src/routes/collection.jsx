import { useParams } from 'react-router'
import { CollectionEditor } from '@/features/catalog/components/collection-editor'

/** `/collections/:id`. */
export function Component() {
  const { id } = useParams()
  return <CollectionEditor key={id} id={id} />
}
