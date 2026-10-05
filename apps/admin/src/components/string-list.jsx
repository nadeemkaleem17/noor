import { Button, IconButton } from '@noor/ui/button'
import { Input } from '@noor/ui/input'
import { Plus, X } from 'lucide-react'

/**
 * A short list of text lines (highlights, care instructions): add, edit, remove.
 * @param {{ label: string; value: string[] | undefined; onChange: (next: string[]) => void; max: number; maxLength: number; addLabel: string; }} props
 */
export function StringList({ label, value = [], onChange, max, maxLength, addLabel }) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium">{label}</legend>
      {value.map((line, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input aria-label={`${label} ${i + 1}`} value={line} maxLength={maxLength} onChange={(e) => onChange(value.map((v, j) => (j === i ? e.target.value : v)))} />
          <IconButton label={`Remove ${label.toLowerCase()} ${i + 1}`} icon={<X aria-hidden className="size-4" />} onClick={() => onChange(value.filter((_, j) => j !== i))} />
        </div>
      ))}
      {value.length < max ? (
        <Button variant="secondary" size="sm" iconStart={<Plus aria-hidden className="size-4" />} onClick={() => onChange([...value, ''])}>
          {addLabel}
        </Button>
      ) : null}
    </fieldset>
  )
}
