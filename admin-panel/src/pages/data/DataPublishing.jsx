import { useRef, useState } from 'react'
import { Download, Upload, RefreshCw, ShieldCheck, TriangleAlert, CircleAlert } from 'lucide-react'
import PageHeader from '../../components/PageHeader.jsx'
import { ConfirmDialog, Pill } from '../../components/ui.jsx'
import { exportAll, importAll } from '../../lib/db.js'
import { runHealthCheck } from '../../lib/health.js'
import { buildBundle, parseBundle } from '../../lib/bundle.js'
import { syncCollectionMembership } from '../../lib/collections.js'
import { useToast } from '../../context/toastContext.js'
import { useCollection } from '../../hooks/useCollection.js'
import { ContractError, summarizeFailures } from '../../lib/validate.js'

const AREAS_ORDER = ['Contract', 'References', 'Handles', 'Collections']

export default function DataPublishing() {
  const push = useToast()
  // Subscribing keeps the page fresh after a fix or import, without a manual refresh.
  useCollection('products'); useCollection('collectionsList'); useCollection('categories')
  const [report, setReport] = useState(() => runHealthCheck(exportAll()))
  const [pendingImport, setPendingImport] = useState(null)
  const [importError, setImportError] = useState(null)
  const fileRef = useRef(null)

  const recheck = () => setReport(runHealthCheck(exportAll()))

  function download() {
    const bundle = buildBundle(exportAll())
    const url = URL.createObjectURL(new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' }))
    const a = Object.assign(document.createElement('a'), { href: url, download: `admin-bundle-${bundle.exportedAt.slice(0, 10)}.json` })
    a.click()
    URL.revokeObjectURL(url)
    push('Bundle downloaded', 'success')
  }

  async function onFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const parsed = parseBundle(await file.text())
    if (!parsed.ok) { setImportError(parsed.error); setPendingImport(null); return }
    setImportError(null)
    setPendingImport(parsed)
  }

  function confirmImport() {
    if (!pendingImport) return
    try {
      importAll(pendingImport.bundle)
    } catch (e) {
      if (!(e instanceof ContractError)) throw e
      setImportError(`Nothing was imported. ${summarizeFailures(e.failures)}`)
      setPendingImport(null)
      return
    }
    setPendingImport(null)
    recheck()
    push('Bundle imported', 'success')
  }

  function fix(kind) {
    if (kind === 'sync-collections') syncCollectionMembership()
    recheck()
    push('Collections re-synced', 'success')
  }

  const grouped = AREAS_ORDER.map((area) => ({ area, items: report.issues.filter((i) => i.area === area) })).filter((g) => g.items.length)

  return (
    <div className="page">
      <PageHeader
        title="Data & publishing"
        description="Check that everything matches the shared contract before the storefront reads it, and move data in or out as one JSON bundle."
        actions={<button className="btn secondary" onClick={recheck}><RefreshCw size={14} /> Re-run check</button>}
      />

      <div className="card card-pad" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {report.ok ? <ShieldCheck size={22} style={{ color: 'var(--success)' }} /> : <TriangleAlert size={22} style={{ color: report.errors ? 'var(--danger)' : 'var(--warning)' }} />}
          <div>
            <div style={{ fontWeight: 600 }}>{report.ok ? 'All data passes the contract' : `${report.errors} error${report.errors === 1 ? '' : 's'}, ${report.warnings} warning${report.warnings === 1 ? '' : 's'}`}</div>
            <div style={{ fontSize: 13, color: 'var(--muted)' }}>Errors would break the storefront; warnings are safe to publish but worth tidying.</div>
          </div>
        </div>

        {grouped.map(({ area, items }) => (
          <div key={area} style={{ marginTop: 18 }}>
            <div className="section-title">{area}</div>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {items.map((i, n) => (
                <li key={n} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13 }}>
                  {i.level === 'error' ? <CircleAlert size={15} style={{ color: 'var(--danger)', marginTop: 2, flex: 'none' }} /> : <TriangleAlert size={15} style={{ color: 'var(--warning)', marginTop: 2, flex: 'none' }} />}
                  <span style={{ flex: 1 }}>{i.message}</span>
                  {i.fix && <button className="btn secondary sm" onClick={() => fix(i.fix)}>Fix</button>}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="form-grid" style={{ alignItems: 'start' }}>
        <div className="card card-pad">
          <div className="section-title">Export</div>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 14 }}>Downloads every collection plus store settings as one versioned JSON file.</p>
          <button className="btn primary" onClick={download}><Download size={14} /> Download bundle</button>
          {report.errors > 0 && <p style={{ fontSize: 12, marginTop: 10, color: 'var(--warning)' }}>The data has contract errors; the export will include them.</p>}
        </div>

        <div className="card card-pad">
          <div className="section-title">Import</div>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 14 }}>Replaces the matching collections with the contents of a bundle. Download an export first if you might want to go back.</p>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={onFile} aria-label="Choose bundle file" />
          <button className="btn secondary" onClick={() => fileRef.current?.click()}><Upload size={14} /> Choose bundle…</button>
          {importError && <p role="alert" style={{ fontSize: 13, marginTop: 10, color: 'var(--danger)' }}>{importError}</p>}
        </div>
      </div>

      {pendingImport && (
        <ConfirmDialog
          title="Replace current data?"
          body="These collections will be overwritten with the bundle's contents:"
          confirmLabel="Import and replace"
          onCancel={() => setPendingImport(null)}
          onConfirm={confirmImport}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {pendingImport.summary.map((s) => <Pill key={s.name}>{s.name}: {s.count}</Pill>)}
          </div>
        </ConfirmDialog>
      )}
    </div>
  )
}
