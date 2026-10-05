import { Link } from 'react-router-dom'
import { EmptyState } from '../components/ui.jsx'

export default function NotFound() {
  return (
    <div className="page">
      <EmptyState
        title="Page not found"
        body="That admin route doesn't exist."
        action={<Link className="btn primary" to="/">Back to dashboard</Link>}
      />
    </div>
  )
}