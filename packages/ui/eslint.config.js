import { base, browser } from '@noor/config/eslint'

export default [...base, ...browser, { ignores: ['storybook-static/**'] }]
