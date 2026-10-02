import { Link } from 'react-router-dom'
import { safeHref } from '../utils/api'

// A call-to-action button whose text/link come from admin-managed settings. Internal paths use the
// router; http(s) links open normally; anything else (e.g. "javascript:") renders nothing.
export default function CtaLink({ text, href, className = 'btn btn-gold' }) {
  const target = safeHref(href)
  if (!text || !target) return null
  return target.startsWith('/')
    ? <Link to={target} className={className}>{text}</Link>
    : <a href={target} className={className} rel="noopener noreferrer">{text}</a>
}
