import { useRouteLoaderData } from 'react-router'
import { siteOf } from './meta'

/** The shop's identity inside a component, for the structured data (the same facts the `meta` of a route gets from the root loader). */
export function useSite() {
  const root = useRouteLoaderData('root')
  return siteOf([{ id: 'root', loaderData: root }])
}
