import { Badge } from '@noor/ui/badge'
import { humanise, riskLabels } from '../labels'

/** The markers of plan/07-admin/05-orders.md section 5.3. They inform; they never block anything. @param {{ markers: string[] }} props */
export function RiskChips({ markers }) {
  return markers.length ? (
    <span className="mt-1 flex flex-wrap gap-1">
      {markers.map((m) => (
        <Badge key={m} tone={riskLabels[m]?.tone ?? 'neutral'} className="text-xs">
          {riskLabels[m]?.label ?? humanise(m)}
        </Badge>
      ))}
    </span>
  ) : null
}
