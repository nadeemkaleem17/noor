import { useParams } from 'react-router'
import { PersonPage } from '@/features/delivery/components/person-page'

export function Component() {
  const { id } = useParams()
  return <PersonPage key={id} id={id ?? ''} />
}
