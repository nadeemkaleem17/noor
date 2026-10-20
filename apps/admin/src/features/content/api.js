import { routes } from '@noor/contract'
import { queryOptions, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export const contentKeys = {
  home: ['content', 'home'],
  pages: ['content', 'pages'],
  pageList: (/** @type {object} */ params) => ['content', 'pages', 'list', params],
  page: (/** @type {string} */ id) => ['content', 'pages', 'detail', id],
  menu: (/** @type {string} */ handle) => ['content', 'menu', handle],
}

export const homeQuery = queryOptions({ queryKey: contentKeys.home, queryFn: ({ signal }) => api('admin.content.getHome', { signal }) })

export function useSaveHome() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (/** @type {never} */ body) => api('admin.content.updateHome', { body }),
    onSuccess: (doc) => queryClient.setQueryData(contentKeys.home, doc),
  })
}

/** The address of the page list is parsed with the route's own query schema. */
export const pageListSchema = routes['admin.pages.list'].query

export const pageQueries = {
  /** @param {object} params parsed from the address with `pageListSchema` */
  list: (params) => queryOptions({ queryKey: contentKeys.pageList(params), queryFn: ({ signal }) => api('admin.pages.list', { query: /** @type {never} */ (params), signal }) }),
  detail: (/** @type {string} */ id) => queryOptions({ queryKey: contentKeys.page(id), queryFn: ({ signal }) => api('admin.pages.get', { params: { id }, signal }) }),
}

export function usePageMutations() {
  const queryClient = useQueryClient()
  /** @param {{ id: string; }} saved */
  const remember = (saved) => {
    queryClient.setQueryData(contentKeys.page(saved.id), saved)
    void queryClient.invalidateQueries({ queryKey: [...contentKeys.pages, 'list'] })
  }
  return {
    create: useMutation({ mutationFn: (/** @type {never} */ body) => api('admin.pages.create', { body }), onSuccess: remember }),
    update: useMutation({ mutationFn: (/** @type {{ id: string; body: never; }} */ v) => api('admin.pages.update', { params: { id: v.id }, body: v.body }), onSuccess: remember }),
    remove: useMutation({
      mutationFn: (/** @type {string} */ id) => api('admin.pages.delete', { params: { id } }),
      onSuccess: (_, id) => {
        queryClient.removeQueries({ queryKey: contentKeys.page(id) })
        void queryClient.invalidateQueries({ queryKey: [...contentKeys.pages, 'list'] })
      },
    }),
  }
}

export const menuQuery = (/** @type {'main' | 'footer'} */ handle) => queryOptions({ queryKey: contentKeys.menu(handle), queryFn: ({ signal }) => api('admin.menus.get', { params: { handle }, signal }) })

export function useSaveMenu() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (/** @type {{ handle: 'main' | 'footer'; body: never; }} */ v) => api('admin.menus.update', { params: { handle: v.handle }, body: v.body }),
    onSuccess: (menu) => queryClient.setQueryData(contentKeys.menu(menu.handle), menu),
  })
}

// ---- the home page being prepared (plan/17 item 3) ------------------------------------------------------------------------------

export const homeDraftKey = ['content', 'home-draft']
/** The draft, or the live page to start from when none was saved: what the home form edits. */
export const homeDraftQuery = queryOptions({ queryKey: homeDraftKey, queryFn: ({ signal }) => api('admin.content.getHomeDraft', { signal }) })

/** Save the draft, publish it, throw it away, ask for a preview link. Each answers with what the form needs next. */
export function useHomeDraft() {
  const queryClient = useQueryClient()
  /** @param {import('@noor/contract').HomeDraft} draft */
  const remember = (draft) => queryClient.setQueryData(homeDraftKey, draft)
  return {
    save: useMutation({ mutationFn: (/** @type {never} */ body) => api('admin.content.saveHomeDraft', { body }), onSuccess: remember }),
    discard: useMutation({ mutationFn: () => api('admin.content.discardHomeDraft'), onSuccess: remember }),
    publish: useMutation({
      mutationFn: (/** @type {{ version: number; liveVersion: number }} */ body) => api('admin.content.publishHome', { body }),
      onSuccess: (live) => {
        queryClient.setQueryData(contentKeys.home, live)
        void queryClient.invalidateQueries({ queryKey: homeDraftKey })
      },
    }),
    previewLink: useMutation({ mutationFn: () => api('admin.content.homePreviewLink') }),
  }
}
