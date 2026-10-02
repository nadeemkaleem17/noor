import { useParams } from 'react-router-dom'
import { useStoreConfig } from '../../hooks/useStoreConfig'

const STATIC_PAGES = {
  'shipping-returns': {
    title: 'Shipping & returns',
    body: [
      'We deliver nationwide across Pakistan in 3–5 business days. Cash on delivery is available on every order; card payments are processed securely at checkout.',
      'Orders over Rs 5,000 ship free — a flat Rs 250 delivery fee applies below that.',
      'Unused items with original tags can be returned within 7 days of delivery for a refund or exchange. Unstitched fabric with cut lengths and sale items are final sale.',
    ],
  },
  'size-guide': {
    title: 'Size guide',
    body: [
      'Stitched kurtas and formals run true to size — if you\'re between sizes, we recommend sizing up for a relaxed fit.',
      'Footwear is listed in EU sizing. Take your usual size, or measure your foot length and compare to the chart on each product page.',
      'Still unsure? Message us on WhatsApp from your order confirmation page and we\'ll help you pick a size.',
    ],
  },
}

export default function CmsPage() {
  const { slug } = useParams()
  const store = useStoreConfig()

  const page = slug === 'contact'
    ? {
        title: 'Contact us',
        body: [
          'Our support team is available 10am–7pm, Monday to Saturday.',
          `WhatsApp: ${store.phone}`,
          `Email: ${store.email}`,
        ],
      }
    : STATIC_PAGES[slug]

  if (!page) {
    return (
      <div className="container section">
        <h1>Page not found</h1>
        <p>This page doesn't exist or may have moved.</p>
      </div>
    )
  }

  return (
    <div className="page-wrap" style={{ maxWidth: 720 }}>
      <h1 className="page-title">{page.title}</h1>
      {page.body.map((para, i) => <p key={i} className="cms-para">{para}</p>)}
    </div>
  )
}
