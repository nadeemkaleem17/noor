import { base, browser } from '@noor/config/eslint'

// `browser` because the journeys pass functions to `page.evaluate`, which run in the page
export default [{ ignores: ['report/**'] }, ...base, ...browser]
