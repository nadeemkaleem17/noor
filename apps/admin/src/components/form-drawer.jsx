import { Button } from '@noor/ui/button'
import { Drawer } from '@noor/ui/drawer'

/**
 * A side panel with a form and Save/Cancel (plan/07-admin/04-catalog.md section 1). The form is the children; Save submits it.
 * @param {{ open: boolean; title: string; onClose: () => void; formId: string; saving: boolean; onSubmit: (event: import('react').FormEvent<HTMLFormElement>) => void; children: import('react').ReactNode; error?: import('react').ReactNode; submitLabel?: string; }} props
 */
export function FormDrawer({ open, title, onClose, formId, saving, onSubmit, children, error, submitLabel = 'Save' }) {
  return (
    <Drawer
      open={open}
      onOpenChange={(next) => !next && onClose()}
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form={formId} loading={saving}>
            {submitLabel}
          </Button>
        </>
      }
    >
      <form id={formId} noValidate onSubmit={onSubmit} className="space-y-4">
        {children}
        {error}
      </form>
    </Drawer>
  )
}
