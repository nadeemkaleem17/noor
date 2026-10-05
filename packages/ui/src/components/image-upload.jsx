import { ImagePlus, Trash2 } from 'lucide-react'
import { useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '../cn'
import { Spinner } from './spinner'

/**
 * What the uploader needs to show a finished upload. The admin's media record has more; it is passed through untouched.
 * @typedef {object} UploadedImage
 * @property {string} id
 * @property {string} src
 * @property {string} [alt]
 */

/**
 * @template {UploadedImage} T
 * @typedef {object} Props
 * @property {T[]} value
 * @property {(value: T[]) => void} onChange
 * @property {(file: File) => Promise<T>} upload - Sends one file and resolves with its media record. Injected, so this package does no data fetching.
 * @property {boolean} [multiple]
 * @property {number} [maxFiles]
 * @property {string} [accept] - MIME types the picker offers. The server still checks the real file type.
 * @property {string} [label]
 * @property {string} [className]
 * @property {(error: unknown) => string | undefined} [describeError] - The sentence shown under a failed file; the generic message when it returns nothing.
 * @property {(busy: boolean) => void} [onBusyChange] - Called with true while any file is being sent and false when none is, so a form can hold its Save button.
 */

/**
 * @typedef {object} Pending
 * @property {string} key
 * @property {string} name
 * @property {string} [error]
 */

/**
 * @template {UploadedImage} T
 * @param {Props<T>} props
 */
export function ImageUpload({ value, onChange, upload, multiple = false, maxFiles = multiple ? 10 : 1, accept = 'image/jpeg,image/png,image/webp,image/avif', label, className, describeError, onBusyChange }) {
  const { t } = useTranslation()
  const inputId = useId()
  const current = useRef(value)
  current.current = value
  const [pending, setPending] = useState(/** @type {Pending[]} */ ([]))
  const [over, setOver] = useState(false)
  const sending = useRef(0)
  const room = maxFiles - value.length

  /**
   * @param {File[]} files
   */
  const send = async (files) => {
    for (const file of files.slice(0, Math.max(room, 0))) {
      const key = `${file.name}-${file.size}-${crypto.randomUUID()}`
      setPending((p) => [...p, { key, name: file.name }])
      if (sending.current++ === 0) onBusyChange?.(true)
      try {
        const done = await upload(file)
        // read the latest list: several uploads finish in any order
        onChange([...current.current, done])
        current.current = [...current.current, done]
        setPending((p) => p.filter((x) => x.key !== key))
      } catch (error) {
        setPending((p) => p.map((x) => (x.key === key ? { ...x, error: describeError?.(error) ?? t('uploadFailed') } : x)))
      } finally {
        if (--sending.current === 0) onBusyChange?.(false)
      }
    }
  }
  /**
   * @param {import('react').DragEvent} e
   */
  const onDrop = (e) => {
    e.preventDefault()
    setOver(false)
    void send([...e.dataTransfer.files].filter((f) => accept.split(',').includes(f.type)))
  }

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <ul className="flex flex-wrap gap-3">
        {value.map((img) => (
          <li key={img.id} className="relative size-24 overflow-hidden rounded-media border border-line">
            <img src={img.src} alt={img.alt ?? ''} className="size-full object-cover" />
            <button
              type="button"
              aria-label={t('removeImage')}
              onClick={() => onChange(value.filter((v) => v.id !== img.id))}
              className="absolute end-1 top-1 flex size-7 items-center justify-center rounded-full bg-surface/90 text-danger shadow-card"
            >
              <Trash2 aria-hidden className="size-4" />
            </button>
          </li>
        ))}
        {pending.map((p) => (
          <li key={p.key} className="flex size-24 flex-col items-center justify-center gap-1 rounded-media border border-line p-1 text-center text-xs">
            {p.error ? (
              <>
                <span role="alert" className="text-danger">{p.error}</span>
                <button type="button" className="underline" onClick={() => setPending((all) => all.filter((x) => x.key !== p.key))}>
                  {t('dismiss')}
                </button>
              </>
            ) : (
              <Spinner size="sm" label={t('uploading')} />
            )}
          </li>
        ))}
      </ul>
      {room > 0 ? (
        <label
          htmlFor={inputId}
          onDragOver={(e) => {
            e.preventDefault()
            setOver(true)
          }}
          onDragLeave={() => setOver(false)}
          onDrop={onDrop}
          className={cn(
            'flex cursor-pointer flex-col items-center gap-2 rounded-card border-2 border-dashed border-line-strong p-6 text-center text-fg-soft hover:bg-surface-2 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus',
            over && 'border-accent bg-accent-soft',
          )}
        >
          <ImagePlus aria-hidden className="size-6" />
          <span>{label ?? t('dropHere')}</span>
          <input
            id={inputId}
            type="file"
            accept={accept}
            multiple={multiple}
            className="sr-only"
            onChange={(e) => {
              void send([...(e.currentTarget.files ?? [])])
              e.currentTarget.value = '' // choosing the same file again must fire a change
            }}
          />
        </label>
      ) : null}
    </div>
  )
}
