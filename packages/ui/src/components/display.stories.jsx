import { enums } from '@noor/contract'
import { Inbox } from 'lucide-react'
import { useState } from 'react'
import { Accordion } from './accordion'
import { Badge, StatusBadge, Tag } from './badge'
import { Breadcrumb } from './breadcrumb'
import { Button } from './button'
import { Card } from './card'
import { Carousel } from './carousel'
import { EmptyState } from './empty-state'
import { ErrorState } from './error-state'
import { LoadMore } from './load-more'
import { Ltr } from './ltr'
import { Pagination } from './pagination'
import { Skeleton } from './skeleton'
import { Spinner } from './spinner'
import { Table, Td, Th } from './table'
import { Tabs, TabsPanel } from './tabs'

const meta = /** @satisfies {import('@storybook/react-vite').Meta} */ ({ title: 'Display and navigation' })
export default meta
/**
 * @typedef {import('@storybook/react-vite').StoryObj<typeof meta>} Story
 */

const tones = /** @type {import('./badge').Tone[]} */ (['neutral', 'accent', 'success', 'warning', 'danger'])
const allStatuses = /** @type {import('./badge').Status[]} */ ([...enums.orderStatus, ...enums.paymentStatus, ...enums.productStatus, ...enums.stockStatus])

/**
 * @param {{ labels: [string, string, string]; }} props
 */
function Tabbed({ labels }) {
  const [v, setV] = useState('a')
  return (
    <Tabs aria-label="Sections" value={v} onValueChange={setV} items={[{ value: 'a', label: labels[0], count: 12 }, { value: 'b', label: labels[1] }, { value: 'c', label: labels[2], disabled: true }]}>
      <TabsPanel value="a">First panel</TabsPanel>
      <TabsPanel value="b">Second panel</TabsPanel>
    </Tabs>
  )
}

/**
 * @param {{ rtl?: boolean; }} props
 */
function Paged({ rtl = false }) {
  const [page, setPage] = useState(5)
  return (
    <div className="flex flex-col gap-4">
      <Pagination page={page} pageCount={12} onPageChange={setPage} />
      <Pagination label="Pages (links)" page={2} pageCount={4} hrefFor={(p) => `#page-${p}`} />
      <LoadMore shown={24} total={310} hasMore onLoadMore={() => {}} label={rtl ? 'مزید' : undefined} />
    </div>
  )
}

/**
 * @param {string} n
 * @param {string} bg
 */
const slide = (n, bg) => (
  <div className={`flex h-40 items-center justify-center rounded-media text-lg ${bg}`}>{n}</div>
)

/**
 * @param {{ rtl?: boolean; }} props
 */
function Board({ rtl = false }) {
  const text = rtl
    ? { home: 'ہوم', shop: 'دکان', page: 'کرتا', dt: 'تفصیل', dc: 'کپڑا: کاٹن', empty: 'کچھ نہیں ملا', emptyBody: 'فلٹر بدل کر دیکھیں', err: 'لوڈ نہیں ہو سکا' }
    : { home: 'Home', shop: 'Shop', page: 'Kurta', dt: 'Details', dc: 'Fabric: cotton', empty: 'Nothing found', emptyBody: 'Try changing the filters', err: 'Could not load' }
  return (
    <div className="flex flex-col gap-8">
      <Breadcrumb items={[{ label: text.home, href: '/' }, { label: text.shop, href: '/shop' }, { label: text.page }]} />
      <Tabbed labels={rtl ? ['سب', 'فعال', 'بند'] : ['All', 'Active', 'Disabled']} />
      <Accordion defaultOpen={['a']} items={[{ id: 'a', title: text.dt, content: text.dc }, { id: 'b', title: 'Care', content: 'Hand wash' }]} />
      <div className="flex flex-wrap gap-2">
        {tones.flatMap((t) => (/** @type {const} */ (['soft', 'solid', 'outline'])).map((v) => <Badge key={`${t}${v}`} tone={t} variant={v}>{`${t} ${v}`}</Badge>))}
      </div>
      <div className="flex flex-wrap gap-2">
        {allStatuses.map((s) => <StatusBadge key={s} status={s} />)}
      </div>
      <div className="flex flex-wrap gap-2">
        {/** @type {const} */ (['ink', 'sale', 'paper', 'quiet']).map((t) => <Tag key={t} tone={t}>{t}</Tag>)}
      </div>
      <Paged rtl={rtl} />
      <Carousel label="Banners" autoPlayMs={6000} items={['One', 'Two', 'Three']} renderItem={(n, i) => slide(n, i % 2 ? 'bg-accent-soft' : 'bg-surface-2')} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <h3 className="font-heading">Card</h3>
          <p className="text-fg-soft">Order <Ltr>RB-2026-000123</Ltr></p>
        </Card>
        <Card className="flex flex-col gap-2" aria-busy>
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </Card>
      </div>
      <Table label="Order lines">
        <thead>
          <tr><Th>{text.shop}</Th><Th numeric>Qty</Th><Th numeric>Total</Th></tr>
        </thead>
        <tbody>
          <tr><Td>{text.page}</Td><Td numeric>2</Td><Td numeric>Rs 13,980.00</Td></tr>
          <tr><Td>Dupatta</Td><Td numeric>1</Td><Td numeric>Rs 2,450.00</Td></tr>
        </tbody>
      </Table>
      <div className="flex flex-wrap gap-6">
        <Spinner />
        <Spinner size="lg" label="Saving" />
      </div>
      <EmptyState icon={<Inbox />} title={text.empty} body={text.emptyBody} action={<Button variant="secondary">Reset</Button>} />
      <ErrorState title={text.err} body="Check your connection." onRetry={() => {}} code="E-4021" />
    </div>
  )
}

export const Default = /** @type {Story} */ ({ render: () => <Board /> })
export const Rtl = /** @type {Story} */ ({ globals: { direction: 'rtl' }, render: () => <Board rtl /> })
export const Dark = /** @type {Story} */ ({ globals: { brand: 'admin-burgundy', scheme: 'dark' }, render: () => <Board /> })
