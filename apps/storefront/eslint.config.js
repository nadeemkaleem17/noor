import { base, browser, appRules } from '@noor/config/eslint'
import reactHooks from 'eslint-plugin-react-hooks'

export default [
  { ignores: ['build/**', '.react-router/**'] },
  ...base,
  ...browser,
  reactHooks.configs.flat.recommended,
  ...appRules({ alias: '~', featuresDir: 'app/features', cwd: import.meta.dirname }),
]
