import { useTranslation } from 'react-i18next'
import { Link as RouterLink } from 'react-router'
import { RichText } from '../content/rich-text'
import { useLocalePath } from '../layout/use-shell'

/** @typedef {import('~/lib/selection').ProductDetail} ProductDetail */

/** One folding section: a native `<details>`, so it works without JavaScript and a crawler sees its text. @param {{ title: string, open?: boolean, children: import('react').ReactNode }} props */
function Section({ title, open, children }) {
  return (
    <details open={open} className="group border-b border-line">
      <summary className="flex cursor-pointer items-center justify-between gap-3 py-3 font-medium">
        {title}
        <span aria-hidden="true" className="text-muted transition-transform group-open:rotate-180">⌄</span>
      </summary>
      <div className="pb-4 text-fg-soft">{children}</div>
    </details>
  )
}

/**
 * Details, what is included, fabric and care, delivery and returns (plan/06-storefront/04-pdp.md sections 4 and 5). "Details" is open; a section with nothing to say is left out.
 * @param {{ product: ProductDetail, descriptionHtml: string }} props
 */
export function InfoSections({ product: p, descriptionHtml }) {
  const { t } = useTranslation('storefront')
  const path = useLocalePath()
  const hasDetails = Boolean(p.descriptionMd) || p.highlights.length > 0
  const hasFabric = p.attributes.length > 0 || p.care.length > 0
  return (
    <div className="border-t border-line">
      {hasDetails ? (
        <Section title={t('pdp.sections.details')} open>
          <RichText html={descriptionHtml} />
          {p.highlights.length ? <ul className="mt-2 list-disc ps-5">{p.highlights.map((h) => <li key={h}>{h}</li>)}</ul> : null}
        </Section>
      ) : null}
      {p.components.length ? (
        <Section title={t('pdp.sections.included')}>
          <div className="overflow-x-auto">
            <table className="w-full text-start text-sm">
              <thead>
                <tr className="border-b border-line">
                  {['piece', 'fabric', 'colour', 'technique', 'quantity'].map((c) => <th key={c} scope="col" className="py-2 pe-3 text-start font-medium">{t(`pdp.included.${c}`)}</th>)}
                </tr>
              </thead>
              <tbody>
                {p.components.map((c, i) => (
                  <tr key={i} className="border-b border-line">
                    <th scope="row" className="py-2 pe-3 text-start font-medium">{c.label}</th>
                    <td className="py-2 pe-3">{c.fabric ?? ''}</td>
                    <td className="py-2 pe-3">{c.color ?? ''}</td>
                    <td className="py-2 pe-3">{c.technique ?? ''}</td>
                    <td className="py-2 pe-3">{c.quantity ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {p.kind === 'unstitched' ? <p className="mt-2 text-sm">{t('pdp.included.note')}</p> : null}
        </Section>
      ) : null}
      {hasFabric ? (
        <Section title={t('pdp.sections.fabric')}>
          {p.attributes.length ? (
            <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1">
              {p.attributes.map((a) => (
                <div key={a.label} className="contents">
                  <dt className="font-medium text-fg">{a.label}</dt>
                  <dd>{a.values.join(', ')}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          {p.care.length ? <ul className="mt-2 list-disc ps-5">{p.care.map((c) => <li key={c}>{c}</li>)}</ul> : null}
          <p className="mt-2"><RouterLink to={path('/pages/care')} className="underline underline-offset-4">{t('pdp.careGuide')}</RouterLink></p>
        </Section>
      ) : null}
      <Section title={t('pdp.sections.delivery')}>
        <p>
          {p.delivery.etaMinDays !== undefined && p.delivery.etaMaxDays !== undefined ? t('pdp.delivery.eta', { min: p.delivery.etaMinDays, max: p.delivery.etaMaxDays }) : null}
          {p.delivery.codAvailable ? ` ${t('pdp.delivery.cod')}.` : null}
        </p>
        {p.madeToOrder && !p.madeToOrder.returnable ? <p className="mt-1">{t('pdp.mto.notReturnable')}</p> : null}
        <p className="mt-2">
          <RouterLink to={path('/pages/shipping-returns')} className="underline underline-offset-4">{t('pdp.returnsLink')}</RouterLink>
        </p>
      </Section>
    </div>
  )
}
