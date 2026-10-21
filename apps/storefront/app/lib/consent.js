// What a visitor said about counting visits: one cookie the browser writes (`1` yes, `0` no, none = not asked yet). The server reads it too, so a visit is never counted on the page's word alone.
export const CONSENT_COOKIE = 'nc_consent'

/** @param {string | undefined} value the cookie's value @returns {'yes' | 'no' | 'unset'} */
export const consentOf = (value) => (value === '1' ? 'yes' : value === '0' ? 'no' : 'unset')
