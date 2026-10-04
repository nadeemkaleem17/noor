import { index, prefix } from '@react-router/dev/routes'

// Locale prefix: none for English, `/ur/...` for Urdu. The root loader 404s any other value (plan/03 section 8).
export default /** @satisfies {import('@react-router/dev/routes').RouteConfig} */ ([...prefix(':locale?', [index('routes/home.jsx')])])
