import { index, prefix, type RouteConfig } from '@react-router/dev/routes'

// Locale prefix: none for English, `/ur/...` for Urdu. The root loader 404s any other value (plan/03 section 8).
export default [...prefix(':locale?', [index('routes/home.tsx')])] satisfies RouteConfig
