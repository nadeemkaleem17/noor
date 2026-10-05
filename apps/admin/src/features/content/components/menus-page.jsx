import { ApiError, isValidLink, menuLimits } from '@noor/contract'
import { Badge } from '@noor/ui/badge'
import { Button, IconButton } from '@noor/ui/button'
import { ConfirmDialog } from '@noor/ui/confirm-dialog'
import { ErrorState } from '@noor/ui/error-state'
import { Field } from '@noor/ui/field'
import { Input } from '@noor/ui/input'
import { Spinner } from '@noor/ui/spinner'
import { Tabs } from '@noor/ui/tabs'
import { useToast } from '@noor/ui/toast'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowDown, ArrowUp, IndentDecrease, IndentIncrease, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useBlocker, useSearchParams } from 'react-router'
import { LinkInput } from '@/components/link-input'
import { PageHeader } from '@/components/page-header'
import { StaleWriteDialog } from '@/components/stale-write-dialog'
import { messageFor } from '@/lib/errors'
import { useCan } from '@/lib/session'
import { menuQuery, useSaveMenu } from '../api'
import { add, edit, fromApi, hasRoom, indent, move, outdent, remove, toApi } from '../menu-tree'

/** @typedef {import('../menu-tree').MenuNode} MenuNode */

const tabs = [
  { value: 'main', label: 'Main menu' },
  { value: 'footer', label: 'Footer menu' },
]

/** What is wrong with one item, if anything. @param {MenuNode} n */
const problem = (n) => (!n.label.trim() ? 'Give the link a label.' : !n.href.trim() ? 'Choose where it goes.' : !isValidLink(n.href.trim()) ? 'Enter a valid link.' : null)

/** One item: its label and link, and the buttons that move it. @param {{ handle: 'main' | 'footer'; nodes: MenuNode[]; at: number[]; writable: boolean; showErrors: boolean; onChange: (next: MenuNode[]) => void; }} props */
function Item({ handle, nodes, at, writable, showErrors, onChange }) {
  const list = at.length === 1 ? nodes : (nodes[/** @type {number} */ (at[0])]?.children ?? [])
  const index = /** @type {number} */ (at.at(-1))
  const node = /** @type {MenuNode} */ (list[index])
  const nameFor = node.label || `link ${at.map((x) => x + 1).join('.')}`
  const error = showErrors ? problem(node) : null
  const topLevel = at.length === 1
  return (
    <li className="space-y-2 rounded-control border border-line bg-surface p-2" style={{ marginInlineStart: topLevel ? 0 : '2rem' }}>
      <div className="grid gap-2 sm:grid-cols-2">
        <Field label="Label" error={error && !node.label.trim() ? error : undefined}>
          <Input aria-label={`Label of ${nameFor}`} value={node.label} maxLength={30} readOnly={!writable} invalid={Boolean(error)} onChange={(e) => onChange(edit(nodes, at, { label: e.target.value }))} />
        </Field>
        <Field label="Goes to" error={error && node.label.trim() ? error : undefined}>
          <LinkInput aria-label={`Link of ${nameFor}`} value={node.href} readOnly={!writable} invalid={Boolean(error)} onChange={(e) => onChange(edit(nodes, at, { href: e.target.value }))} />
        </Field>
      </div>
      <div className="flex flex-wrap items-center gap-1">
        {node.targetLive === false ? <Badge tone="warning">Target not live</Badge> : null}
        {writable ? (
          <span className="ms-auto flex flex-wrap gap-1">
            <IconButton label={`Move ${nameFor} up`} icon={<ArrowUp aria-hidden className="size-4" />} disabled={index === 0} onClick={() => onChange(move(nodes, at, -1))} />
            <IconButton label={`Move ${nameFor} down`} icon={<ArrowDown aria-hidden className="size-4" />} disabled={index === list.length - 1} onClick={() => onChange(move(nodes, at, 1))} />
            {menuLimits[handle].levels > 1 ? (
              topLevel ? (
                <IconButton label={`Indent ${nameFor}`} icon={<IndentIncrease aria-hidden className="size-4" />} disabled={index === 0 || node.children.length > 0 || indent(handle, nodes, index) === nodes} onClick={() => onChange(indent(handle, nodes, index))} />
              ) : (
                <IconButton label={`Outdent ${nameFor}`} icon={<IndentDecrease aria-hidden className="size-4" />} disabled={outdent(handle, nodes, /** @type {number} */ (at[0]), index) === nodes} onClick={() => onChange(outdent(handle, nodes, /** @type {number} */ (at[0]), index))} />
              )
            ) : null}
            <IconButton label={`Remove ${nameFor}`} icon={<Trash2 aria-hidden className="size-4" />} onClick={() => onChange(remove(nodes, at))} />
          </span>
        ) : null}
      </div>
      {topLevel && (node.children.length > 0 || hasRoom(handle, nodes, index)) ? (
        <ul className="space-y-2">
          {node.children.map((_, j) => (
            <Item key={node.children[j]?.key} handle={handle} nodes={nodes} at={[index, j]} writable={writable} showErrors={showErrors} onChange={onChange} />
          ))}
          {writable && hasRoom(handle, nodes, index) && menuLimits[handle].levels > 1 ? (
            <li style={{ marginInlineStart: '2rem' }}>
              <Button variant="secondary" size="sm" iconStart={<Plus aria-hidden className="size-4" />} onClick={() => onChange(add(nodes, index))}>
                Add a sub-link to {nameFor}
              </Button>
            </li>
          ) : null}
        </ul>
      ) : null}
    </li>
  )
}

/** @param {{ handle: 'main' | 'footer'; }} props */
function MenuEditor({ handle }) {
  const menu = useQuery(menuQuery(handle))
  if (menu.isPending) return <Spinner label="Loading the menu" />
  if (menu.isError) return <ErrorState title="The menu could not be loaded" retryLabel="Try again" onRetry={() => void menu.refetch()} />
  return <MenuForm key={`${handle}-${menu.data.version}`} handle={handle} version={menu.data.version} items={fromApi(menu.data.items)} />
}

/** @param {{ handle: 'main' | 'footer'; version: number; items: MenuNode[]; }} props */
function MenuForm({ handle, version, items }) {
  const can = useCan()
  const toast = useToast()
  const queryClient = useQueryClient()
  const save = useSaveMenu()
  const writable = can('content:write')
  const [nodes, setNodes] = useState(items)
  const [showErrors, setShowErrors] = useState(false)
  const [stale, setStale] = useState(false)
  const [initial] = useState(() => JSON.stringify(toApi(items)))
  const dirty = JSON.stringify(toApi(nodes)) !== initial
  const blocker = useBlocker(({ currentLocation, nextLocation }) => dirty && `${currentLocation.pathname}` !== `${nextLocation.pathname}`)

  /** @param {number} [atVersion] */
  async function submit(atVersion = version) {
    if (nodes.some((n) => problem(n) || n.children.some(problem))) {
      setShowErrors(true)
      toast.push({ title: 'Some links need a label or a valid address.', tone: 'warning' })
      return
    }
    try {
      await save.mutateAsync({ handle, body: /** @type {never} */ ({ items: toApi(nodes), version: atVersion }) })
      setStale(false)
      toast.push({ title: 'Menu saved', tone: 'success' })
    } catch (error) {
      if (error instanceof ApiError && error.code === 'stale_write') setStale(true)
      else toast.push({ title: messageFor(error), tone: 'danger' })
    }
  }

  return (
    <div className="space-y-3">
      {handle === 'main' && nodes.length === 0 ? <p className="rounded-control bg-warning-soft px-3 py-2 text-sm text-warning">With no links here the shop shows its own: New, the top categories, and Sale.</p> : null}
      {handle === 'footer' ? <p className="text-sm text-muted">One level, up to {menuLimits.footer.top} links.</p> : <p className="text-sm text-muted">Two levels: up to {menuLimits.main.top} links, each with up to {menuLimits.main.children} sub-links.</p>}
      <ul className="space-y-2">
        {nodes.map((n, i) => (
          <Item key={n.key} handle={handle} nodes={nodes} at={[i]} writable={writable} showErrors={showErrors} onChange={setNodes} />
        ))}
      </ul>
      {writable && hasRoom(handle, nodes) ? (
        <Button variant="secondary" iconStart={<Plus aria-hidden className="size-4" />} onClick={() => setNodes(add(nodes))}>
          Add a link
        </Button>
      ) : null}
      {writable ? (
        <div className="flex justify-end">
          <Button loading={save.isPending} onClick={() => void submit()}>
            Save
          </Button>
        </div>
      ) : null}
      <StaleWriteDialog
        open={stale}
        what="menu"
        onReload={() => void queryClient.invalidateQueries({ queryKey: menuQuery(handle).queryKey }).then(() => setStale(false))}
        onOverwrite={writable ? () => void queryClient.fetchQuery({ ...menuQuery(handle), staleTime: 0 }).then((fresh) => submit(fresh.version)) : undefined}
        saving={save.isPending}
      />
      <ConfirmDialog
        open={blocker.state === 'blocked'}
        onOpenChange={(open) => !open && blocker.reset?.()}
        title="Leave without saving?"
        body="Your changes to this menu will be lost."
        confirmLabel="Leave"
        onConfirm={() => blocker.proceed?.()}
      />
    </div>
  )
}

/** `/content/menus` (plan/07-admin/09-content.md section 4): the two menus the shop reads, the current one in the address as `?menu=`. */
export function MenusPage() {
  const [search, setSearch] = useSearchParams()
  const handle = search.get('menu') === 'footer' ? 'footer' : 'main'
  return (
    <>
      <PageHeader title="Menus" description="The links in the shop's header and footer." />
      <Tabs aria-label="Menus" items={tabs} value={handle} onValueChange={(v) => setSearch(v === 'main' ? {} : { menu: v })} />
      <div className="pt-4">
        <MenuEditor key={handle} handle={handle} />
      </div>
    </>
  )
}
