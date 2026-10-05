import { Button } from '@noor/ui/button'
import { Checkbox } from '@noor/ui/checkbox'
import { useState } from 'react'
import { downloadBlob } from '@/lib/download'

/**
 * The ten recovery codes, shown once (plan/07-admin/12-staff-roles.md section 5). Done stays off until the person says they saved them.
 * @param {{ codes: string[]; onDone: () => void; }} props
 */
export function RecoveryCodes({ codes, onDone }) {
  const [saved, setSaved] = useState(false)
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">Keep these recovery codes somewhere safe. Each works once if you lose your phone. They are not shown again.</p>
      <ul className="grid grid-cols-2 gap-2 rounded-control bg-surface-2 p-3 font-mono text-sm" aria-label="Recovery codes">
        {codes.map((code) => (
          <li key={code}>{code}</li>
        ))}
      </ul>
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" onClick={() => void navigator.clipboard?.writeText(codes.join('\n'))}>
          Copy
        </Button>
        <Button variant="secondary" size="sm" onClick={() => downloadBlob('rubaya-recovery-codes.txt', new Blob([`${codes.join('\n')}\n`], { type: 'text/plain' }))}>
          Download .txt
        </Button>
      </div>
      <Checkbox label="I have saved these codes" checked={saved} onCheckedChange={setSaved} />
      <Button fullWidth disabled={!saved} onClick={onDone}>
        Done
      </Button>
    </div>
  )
}
