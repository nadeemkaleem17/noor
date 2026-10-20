import { useParams } from 'react-router'
import { RunPage } from '@/features/delivery/components/run-page'

export function Component() {
  const { id } = useParams()
  return <RunPage key={id} id={id ?? ''} />
}
