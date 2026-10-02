import { useId, useState } from 'react'

export function Field({ label, hint, children, htmlFor }) {
  return (
    <div className="field">
      {label && <label htmlFor={htmlFor}>{label}</label>}
      {children}
      {hint && <span className="hint">{hint}</span>}
    </div>
  )
}

export function TextInput({ label, hint, id, ...props }) {
  const autoId = useId()
  const inputId = id || autoId
  return (
    <Field label={label} hint={hint} htmlFor={inputId}>
      <input className="input" id={inputId} {...props} />
    </Field>
  )
}

export function TextArea({ label, hint, id, ...props }) {
  const autoId = useId()
  const inputId = id || autoId
  return (
    <Field label={label} hint={hint} htmlFor={inputId}>
      <textarea className="input" id={inputId} {...props} />
    </Field>
  )
}

export function SelectInput({ label, hint, options, id, ...props }) {
  const autoId = useId()
  const inputId = id || autoId
  return (
    <Field label={label} hint={hint} htmlFor={inputId}>
      <select className="input" id={inputId} {...props}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </Field>
  )
}

export function NumberInput({ label, hint, id, ...props }) {
  const autoId = useId()
  const inputId = id || autoId
  return (
    <Field label={label} hint={hint} htmlFor={inputId}>
      <input className="input mono" id={inputId} type="number" {...props} />
    </Field>
  )
}

export function MoneyInput({ label, hint, valueRupees, onChangeRupees, id, ...props }) {
  const autoId = useId()
  const inputId = id || autoId
  return (
    <Field label={label} hint={hint} htmlFor={inputId}>
      <div style={{ position: 'relative' }}>
        <span style={{ position: 'absolute', left: 12, top: 10, fontSize: 12.5, color: 'var(--muted)' }}>Rs.</span>
        <input
          className="input mono"
          id={inputId}
          type="number"
          style={{ paddingLeft: 34 }}
          value={valueRupees}
          onChange={(e) => onChangeRupees(Number(e.target.value))}
          {...props}
        />
      </div>
    </Field>
  )
}

export function CheckboxRow({ label, checked, onChange }) {
  const inputId = useId()
  return (
    <label className="checkbox-row" htmlFor={inputId}>
      <input id={inputId} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  )
}
// One-item-per-line list editor. Keeps its own text and commits on blur, so typing a new line
// is never eaten by the "drop blank lines" clean-up (same trap as the shipping cities field, F-09).
export function LinesArea({ label, hint, value = [], onCommit, max, rows = 4 }) {
  const [text, setText] = useState(value.join('\n'))
  const over = max && text.split('\n').map((l) => l.trim()).filter(Boolean).length > max
  return (
    <TextArea
      label={label} rows={rows} value={text} hint={over ? `Only the first ${max} lines are kept.` : hint}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
        onCommit(max ? lines.slice(0, max) : lines)
      }}
    />
  )
}
