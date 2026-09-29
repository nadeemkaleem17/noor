import { Component } from 'react'
import { AlertTriangle, RotateCcw, Trash2 } from 'lucide-react'
import { resetAllData } from '../lib/db.js'

// Route-level errors (a bad JSON.parse, a null dereference in one page) would
// otherwise unmount the whole React tree and leave a blank white screen with
// nothing but a console stack trace — the admin has no built-in recovery UI.
// This boundary catches render/lifecycle errors anywhere below it, shows the
// real message + component stack (so it's actually debuggable), and offers
// two recovery paths: reload, or wipe the localStorage-backed "admin API"
// (lib/db.js) back to the seed fixtures, since a corrupted/stale record in
// one collection is the most likely cause of a page-specific crash.
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null, info: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    this.setState({ info })
    console.error('Admin panel crashed:', error, info?.componentStack)
  }

  render() {
    const { error, info } = this.state
    if (!error) return this.props.children

    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--bg, #FBF9F6)', color: 'var(--ink, #231F1C)', padding: 24,
      }}>
        <div style={{
          maxWidth: 640, width: '100%', background: 'var(--surface, #fff)',
          border: '1px solid var(--line, #e5e0d8)', borderRadius: 'var(--radius-l, 16px)',
          padding: 28, boxShadow: 'var(--shadow-modal, 0 24px 64px rgba(20,16,14,0.28))',
        }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <AlertTriangle size={22} style={{ color: 'var(--danger, #B23A3A)', flexShrink: 0, marginTop: 2 }} />
            <div style={{ minWidth: 0 }}>
              <h2 style={{ margin: 0, fontSize: 'var(--text-xl, 1.25rem)' }}>Something went wrong on this screen</h2>
              <p style={{ color: 'var(--muted, #6b6459)', marginTop: 6, fontSize: 'var(--text-sm, 0.8125rem)' }}>
                The error below is what actually crashed — copy it along if you're reporting this.
              </p>
              <pre style={{
                marginTop: 14, padding: 12, background: 'var(--bg, #FBF9F6)', border: '1px solid var(--line, #e5e0d8)',
                borderRadius: 'var(--radius-s, 6px)', fontSize: 12, overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              }}>
                {error?.message || String(error)}
                {info?.componentStack ? `\n${info.componentStack}` : ''}
              </pre>
              <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
                <button
                  className="btn primary"
                  onClick={() => { this.setState({ error: null, info: null }); window.location.reload() }}
                >
                  <RotateCcw size={14} /> Reload
                </button>
                <button
                  className="btn danger"
                  onClick={() => {
                    if (window.confirm('This clears all admin data in this browser back to the sample fixtures. Continue?')) {
                      resetAllData()
                      window.location.reload()
                    }
                  }}
                >
                  <Trash2 size={14} /> Reset admin data &amp; reload
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }
}

export default ErrorBoundary
