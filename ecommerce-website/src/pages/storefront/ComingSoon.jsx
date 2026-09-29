import { Link } from 'react-router-dom'
import { EmptyState } from '../../components/ui'

export default function ComingSoon({ title }) {
  return (
    <div className="container section">
      <EmptyState
        title={title || 'Coming soon'}
        body="This page isn't built yet."
        action={<Link to="/" className="btn btn-gold btn-sm">Back to home</Link>}
      />
    </div>
  )
}
