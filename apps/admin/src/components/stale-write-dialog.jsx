import { Button } from '@noor/ui/button'
import { Dialog } from '@noor/ui/dialog'

/**
 * Someone else saved first: take their version, or (when allowed) save over it (plan/07-admin/03-products.md section 9).
 * @param {{ open: boolean; what: string; onReload: () => void; onOverwrite?: () => void; saving?: boolean; }} props - without `onOverwrite` the only way on is to reload
 */
export function StaleWriteDialog({ open, what, onReload, onOverwrite, saving }) {
  return (
    <Dialog
      open={open}
      onOpenChange={() => {}}
      dismissible={false}
      title={`Someone else changed this ${what}`}
      description="It was saved by someone else while you were editing. Choose which version to keep."
      footer={
        <>
          <Button variant="secondary" onClick={onReload}>
            Reload their version
          </Button>
          {onOverwrite ? (
            <Button variant="danger" loading={saving} onClick={onOverwrite}>
              Overwrite with mine
            </Button>
          ) : null}
        </>
      }
    />
  )
}
