import { HistoryPanel } from '@/components/history-panel'
import { AppearancePage } from '@/features/settings/components/appearance-page'

export function Component() {
  return (
    <>
      <AppearancePage />
      <HistoryPanel entityType="settings" entityId="theme" />
    </>
  )
}
