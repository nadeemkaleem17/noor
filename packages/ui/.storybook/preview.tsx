import type { Preview } from '@storybook/react-vite'
import { DirectionProvider } from '@base-ui/react/direction-provider'
import '../src/storybook.css'

// Toolbars: brand, color scheme and text direction. Every story can be checked in each combination
// (plan/04-design-system/components.md section 2: RTL and Dark stories).
// DirectionProvider makes Base UI components follow the toolbar; it does not set `dir`, the decorator does.
const preview: Preview = {
  globalTypes: {
    brand: {
      description: 'Brand',
      toolbar: { icon: 'paintbrush', dynamicTitle: true, items: [{ value: 'storefront', title: 'Storefront' }, { value: 'admin-burgundy', title: 'Admin' }] },
    },
    scheme: {
      description: 'Color scheme (dark exists for the admin brand only)',
      toolbar: { icon: 'moon', dynamicTitle: true, items: [{ value: 'light', title: 'Light' }, { value: 'dark', title: 'Dark' }] },
    },
    direction: {
      description: 'Text direction',
      toolbar: { icon: 'transfer', dynamicTitle: true, items: [{ value: 'ltr', title: 'LTR (English)' }, { value: 'rtl', title: 'RTL (Urdu)' }] },
    },
  },
  initialGlobals: { brand: 'storefront', scheme: 'light', direction: 'ltr' },
  decorators: [
    (Story, context) => {
      const direction = context.globals['direction'] === 'rtl' ? 'rtl' : 'ltr'
      const root = document.documentElement
      root.dataset['brand'] = String(context.globals['brand'])
      root.dataset['theme'] = String(context.globals['scheme'])
      root.dir = direction
      root.lang = direction === 'rtl' ? 'ur' : 'en'
      return (
        <DirectionProvider direction={direction}>
          <Story />
        </DirectionProvider>
      )
    },
  ],
  parameters: {
    layout: 'padded',
    a11y: { test: 'error' }, // axe violations fail the component test run (added in M2-05)
  },
}

export default preview
