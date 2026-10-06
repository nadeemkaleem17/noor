import { useRouteLoaderData } from 'react-router'
import { localePath } from '~/lib/paths'

/**
 * What the root loader gave every page: the shop's settings, its announcement, menus and categories, and the language.
 * `undefined` while the root loader has failed (the error page then shows without the shop around it).
 * @returns {import('~/root').ShellData | undefined}
 */
export const useShell = () => /** @type {import('~/root').ShellData | undefined} */ (useRouteLoaderData('root'))

/** A path in the visitor's language: `/ur` in front for Urdu. */
export function useLocalePath() {
  const locale = useShell()?.locale ?? 'en'
  return (/** @type {string} */ path) => localePath(locale, path)
}
