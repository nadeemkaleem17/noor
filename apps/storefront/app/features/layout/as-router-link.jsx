import { Link as RouterLink } from 'react-router'

/** A router link for the breadcrumb, which hands over a plain `href`. @type {(props: import('react').ComponentProps<'a'>) => import('react').ReactElement} */
export const asRouterLink = ({ href, ...props }) => <RouterLink {...props} to={href ?? '/'} />
