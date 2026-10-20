// The home page draft (plan/17 item 3): staff open the shop's home address with `?preview=<token>` and see the unpublished page. The token is checked by the API, not here.

/** The preview token of this address, only on the home page and only if it looks like one. @param {URL} url @returns {string | undefined} */
export function previewOf(url) {
  const path = url.pathname.replace(/\.data$/, '').replace(/\/+$/, '')
  const token = url.searchParams.get('preview')
  return (path === '' || path === '/ur') && token && token.length <= 200 ? token : undefined
}
