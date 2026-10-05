import { useParams } from 'react-router'
import { StaffDetail } from '@/features/staff/components/staff-detail'

/** `/staff/:id`. */
export function Component() {
  const { id } = useParams()
  return <StaffDetail key={id} id={/** @type {string} */ (id)} />
}
