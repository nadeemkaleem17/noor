import { base, browser, appRules } from '@noor/config/eslint'
import reactHooks from 'eslint-plugin-react-hooks'

export default [
  { ignores: ['dist/**'] },
  ...base,
  ...browser,
  reactHooks.configs.flat.recommended,
  ...appRules({ alias: '@', featuresDir: 'src/features', cwd: import.meta.dirname }),
]
