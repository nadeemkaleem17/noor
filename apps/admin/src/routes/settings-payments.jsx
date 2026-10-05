import { HistoryPanel } from '@/components/history-panel'
import { PaymentsPage } from '@/features/settings/components/payments-page'

export function Component() {
  return (
    <>
      <PaymentsPage />
      <HistoryPanel entityType="settings" entityId="payments" />
    </>
  )
}
