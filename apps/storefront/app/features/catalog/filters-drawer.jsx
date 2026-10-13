import { useTranslation } from 'react-i18next'
import { Link as RouterLink } from 'react-router'
import { Button } from '@noor/ui/button'
import { Drawer } from '@noor/ui/drawer'
import { clearAllHref } from '~/lib/listing-url'
import { FilterForm } from './filters'

/** @typedef {import('@noor/contract').ProductListing} ProductListing */

/** The filters in a bottom sheet that applies them with its button. A file of its own: nobody downloads it until the filters button is pressed. @param {{ open: boolean, onOpenChange: (open: boolean) => void, formId: string, path: string, page: ProductListing, search: URLSearchParams, effective: URLSearchParams }} props */
export default function FiltersDrawer({ open, onOpenChange, formId, path, page, search, effective }) {
  const { t } = useTranslation('storefront')
  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      title={t('listing.filters')}
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <RouterLink to={clearAllHref(path, search)} onClick={() => onOpenChange(false)} className="underline underline-offset-4">
            {t('listing.clearAll')}
          </RouterLink>
          <Button type="submit" form={formId}>{t('listing.showResults')}</Button>
        </div>
      }
    >
      <FilterForm id={formId} path={path} page={page} search={search} effective={effective} onApply={() => onOpenChange(false)} />
    </Drawer>
  )
}
