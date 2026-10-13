import { useState } from 'react'
import { Drawer } from '@noor/ui/drawer'
import { SizeChartExtras, SizeChartTables } from './size-chart'
import { UnitSwitch } from './size-guide'

/** @typedef {import('@noor/contract').SizeChart} SizeChart */

/** The size chart's drawer: tables, an inches and centimetres switch, how to measure. @param {{ chart: SizeChart, open: boolean, onOpenChange: (open: boolean) => void }} props */
export default function SizeGuideDrawer({ chart, open, onOpenChange }) {
  const [unit, setUnit] = useState(chart.unit)
  return (
    <Drawer title={chart.title} open={open} onOpenChange={onOpenChange} footer={null}>
      <div className="flex flex-col gap-5">
        <UnitSwitch unit={unit} onChange={setUnit} />
        <SizeChartTables chart={chart} unit={unit} />
        <SizeChartExtras chart={chart} />
      </div>
    </Drawer>
  )
}
