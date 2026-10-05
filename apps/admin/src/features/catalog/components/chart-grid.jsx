import { Button, IconButton } from '@noor/ui/button'
import { Input } from '@noor/ui/input'
import { Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'

/** @typedef {{ id: string; title: string; columns: string[]; rows: { label: string; values: (number | undefined)[]; }[]; }} GridTable */

/** A pasted cell as a number, or nothing. @param {string} text */
const toNumber = (text) => {
  const n = Number(text.trim().replace(',', '.'))
  return text.trim() === '' || Number.isNaN(n) ? undefined : n
}

/**
 * Pasted spreadsheet text laid over a table, starting at one cell: rows by line, columns by tab. Rows and columns the table does not have yet are added.
 * @param {GridTable} table @param {number} row @param {number} col @param {string} text
 * @returns {GridTable}
 */
export function pasteBlock(table, row, col, text) {
  const lines = text.replace(/\r/g, '').split('\n')
  if (lines.at(-1) === '') lines.pop()
  const block = lines.map((l) => l.split('\t'))
  const width = Math.max(...block.map((b) => b.length))
  const columns = [...table.columns]
  while (columns.length < col + width) columns.push('')
  const rows = table.rows.map((r) => ({ ...r, values: [...r.values] }))
  block.forEach((cells, i) => {
    while (rows.length <= row + i) rows.push({ label: '', values: [] })
    const target = /** @type {GridTable['rows'][number]} */ (rows[row + i])
    cells.forEach((cell, j) => {
      while (target.values.length < col + j) target.values.push(undefined)
      target.values[col + j] = toNumber(cell)
    })
  })
  return { ...table, columns, rows }
}

/** One numeric cell. It keeps what is being typed ("34.") while the form holds the number. @param {{ value: number | undefined; onValue: (n: number | undefined) => void; } & Omit<import('react').ComponentProps<'input'>, 'value' | 'onChange' | 'size'>} props */
function Cell({ value, onValue, ...props }) {
  const [text, setText] = useState(value === undefined ? '' : String(value))
  if (toNumber(text) !== value) setText(value === undefined ? '' : String(value)) // changed from outside, for instance by a paste
  return (
    <Input
      {...props}
      inputMode="decimal"
      value={text}
      onChange={(e) => {
        setText(e.target.value)
        onValue(toNumber(e.target.value))
      }}
    />
  )
}

/** Moves the focus to a neighbouring cell of the same grid. @param {HTMLElement} from @param {number} dr @param {number} dc */
function focusNeighbour(from, dr, dc) {
  const grid = from.closest('[data-grid]')
  const r = Number(from.dataset.row) + dr
  const c = Number(from.dataset.col) + dc
  const next = grid?.querySelector(`[data-row="${r}"][data-col="${c}"]`)
  if (next instanceof HTMLElement) {
    next.focus()
    if (next instanceof HTMLInputElement) next.select()
  }
}

/**
 * A spreadsheet-like editor for the tables of a size chart (plan/07-admin/04-catalog.md section 5.2): arrow keys and Enter move between cells,
 * pasting from a spreadsheet fills a block.
 * @param {{ tables: GridTable[]; onChange: (tables: GridTable[]) => void; rowLabels?: string[]; }} props - `rowLabels` fills new tables' rows, for example from a size system
 */
export function ChartGrid({ tables, onChange, rowLabels = [] }) {
  /** @param {number} i @param {(t: GridTable) => GridTable} change */
  const edit = (i, change) => onChange(tables.map((t, j) => (j === i ? change(t) : t)))
  return (
    <div className="space-y-6">
      {tables.map((t, ti) => (
        <section key={ti} aria-label={`Table ${ti + 1}`} className="space-y-2">
          <div className="flex items-end gap-2">
            <Input aria-label={`Table ${ti + 1} title`} placeholder="Title, for example Kameez" value={t.title} maxLength={60} onChange={(e) => edit(ti, (x) => ({ ...x, title: e.target.value }))} />
            {tables.length > 1 ? <IconButton label={`Remove table ${ti + 1}`} icon={<Trash2 aria-hidden className="size-4" />} onClick={() => onChange(tables.filter((_, j) => j !== ti))} /> : null}
          </div>
          <div data-grid className="overflow-x-auto">
            <table className="border-collapse text-sm">
              <thead>
                <tr>
                  <th className="p-1 text-start font-medium">Size</th>
                  {t.columns.map((c, ci) => (
                    <th key={ci} className="p-1">
                      <div className="flex gap-1">
                        <Input aria-label={`Table ${ti + 1} column ${ci + 1} name`} placeholder="Bust" value={c} maxLength={30} className="w-24" onChange={(e) => edit(ti, (x) => ({ ...x, columns: x.columns.map((n, k) => (k === ci ? e.target.value : n)) }))} />
                        {t.columns.length > 1 ? (
                          <IconButton
                            label={`Remove column ${ci + 1} of table ${ti + 1}`}
                            icon={<Trash2 aria-hidden className="size-4" />}
                            onClick={() => edit(ti, (x) => ({ ...x, columns: x.columns.filter((_, k) => k !== ci), rows: x.rows.map((r) => ({ ...r, values: r.values.filter((_, k) => k !== ci) })) }))}
                          />
                        ) : null}
                      </div>
                    </th>
                  ))}
                  <th className="p-1">
                    <IconButton label={`Add a column to table ${ti + 1}`} icon={<Plus aria-hidden className="size-4" />} disabled={t.columns.length >= 12} onClick={() => edit(ti, (x) => ({ ...x, columns: [...x.columns, ''] }))} />
                  </th>
                </tr>
              </thead>
              <tbody>
                {t.rows.map((r, ri) => (
                  <tr key={ri}>
                    <th scope="row" className="p-1">
                      <Input aria-label={`Table ${ti + 1} row ${ri + 1} size`} value={r.label} maxLength={20} className="w-20" onChange={(e) => edit(ti, (x) => ({ ...x, rows: x.rows.map((y, k) => (k === ri ? { ...y, label: e.target.value } : y)) }))} />
                    </th>
                    {t.columns.map((_, ci) => (
                      <td key={ci} className="p-1">
                        <Cell
                          aria-label={`${r.label || `Row ${ri + 1}`}, ${t.columns[ci] || `column ${ci + 1}`}`}
                          data-row={ri}
                          data-col={ci}
                          className="w-24"
                          value={r.values[ci]}
                          onValue={(n) => edit(ti, (x) => ({ ...x, rows: x.rows.map((y, k) => (k === ri ? { ...y, values: Array.from({ length: x.columns.length }, (__, v) => (v === ci ? n : y.values[v])) } : y)) }))}
                          onKeyDown={(e) => {
                            const el = e.currentTarget
                            const whole = el.selectionStart === 0 && el.selectionEnd === el.value.length // a selected cell is moved out of like in a spreadsheet
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              focusNeighbour(el, e.shiftKey ? -1 : 1, 0)
                            } else if (e.key === 'ArrowDown') focusNeighbour(el, 1, 0)
                            else if (e.key === 'ArrowUp') focusNeighbour(el, -1, 0)
                            else if (e.key === 'ArrowLeft' && (whole || el.selectionEnd === 0)) focusNeighbour(el, 0, -1)
                            else if (e.key === 'ArrowRight' && (whole || el.selectionStart === el.value.length)) focusNeighbour(el, 0, 1)
                          }}
                          onPaste={(e) => {
                            const text = e.clipboardData.getData('text')
                            if (!/[\t\n]/.test(text)) return // one value: the input handles it
                            e.preventDefault()
                            edit(ti, (x) => pasteBlock(x, ri, ci, text))
                          }}
                        />
                      </td>
                    ))}
                    <td className="p-1">
                      <IconButton label={`Remove row ${ri + 1} of table ${ti + 1}`} icon={<Trash2 aria-hidden className="size-4" />} onClick={() => edit(ti, (x) => ({ ...x, rows: x.rows.filter((_, k) => k !== ri) }))} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Button variant="secondary" size="sm" iconStart={<Plus aria-hidden className="size-4" />} disabled={t.rows.length >= 40} onClick={() => edit(ti, (x) => ({ ...x, rows: [...x.rows, { label: '', values: [] }] }))}>
            Add a row
          </Button>
        </section>
      ))}
      {tables.length < 4 ? (
        <Button
          variant="secondary"
          iconStart={<Plus aria-hidden className="size-4" />}
          onClick={() => onChange([...tables, { id: `t${Math.random().toString(36).slice(2, 8)}`, title: '', columns: [''], rows: (rowLabels.length ? rowLabels : ['']).map((label) => ({ label, values: [] })) }])}
        >
          Add a table
        </Button>
      ) : null}
    </div>
  )
}
