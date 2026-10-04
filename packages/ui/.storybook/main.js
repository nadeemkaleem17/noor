import tailwindcss from '@tailwindcss/vite'
import { mergeConfig } from 'vite'

const config = /** @type {import('@storybook/react-vite').StorybookConfig} */ ({
  stories: ['../src/**/*.stories.@(js|jsx)'],
  addons: ['@storybook/addon-a11y'],
  framework: '@storybook/react-vite',
  core: { disableTelemetry: true },
  viteFinal: (viteConfig) => mergeConfig(viteConfig, { plugins: [tailwindcss()] }),
})

export default config
