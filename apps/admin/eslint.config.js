import { base, browser, appRules } from '@noor/config/eslint'
import reactHooks from 'eslint-plugin-react-hooks'

// old/ has its own config (old/eslint.config.js) and is not held to these rules.
export default [
  { ignores: ['dist/**', 'old/**'] },
  ...base,
  ...browser,
  reactHooks.configs.flat.recommended,
  ...appRules({ alias: '@', featuresDir: 'src/features', cwd: import.meta.dirname }),
]
