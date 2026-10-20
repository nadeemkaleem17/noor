import { ImagePlus, RotateCw, Trash2, X } from 'lucide-react'
import { useEffect, useId, useRef, useState } from 'react'
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
 * Where a file is on its way. `sending` carries how much of it has gone (0 to 1) when the browser can tell.
 * @typedef {object} UploadProgress
 * @property {'checking' | 'sending' | 'confirming' | 'processing'} stage
 * @property {number} [fraction]
 */

/**
 * What the uploader gives the injected upload function: a way to stop it, and a way to say where it is.
 * @typedef {object} UploadControl
 * @property {AbortSignal} signal aborted when the person presses Cancel or leaves the page
 * @property {(progress: UploadProgress) => void} onProgress
 */

/**
 * @template {UploadedImage} T
 * @typedef {object} Props
 * @property {T[]} value
 * @property {(value: T[]) => void} onChange
 * @property {(file: File, control: UploadControl) => Promise<T>} upload - Sends one file and resolves with its media record. Injected, so this package does no data fetching. It must end: resolve, or reject with the reason.
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
 * @property {File} file
 * @property {UploadProgress} progress
 * @property {AbortController} controller
 * @property {string} [error]
 */

/**
 * A picture picker with drag and drop. Each file shows where it is (checking, sending with a percentage, being made ready), can be cancelled while it is on its way, and when it fails says why
 * and offers Retry. Nothing here can spin without end: the injected `upload` must resolve or reject, and a press on Cancel aborts it.
 * @template {UploadedImage} T
 * @param {Props<T>} props
 */
export function ImageUpload({ value, onChange, upload, multiple = false, maxFiles = multiple ? 10 : 1, accept = 'image/jpeg,image/png,image/webp,image/avif', label, className, describeError, onBusyChange }) {
  const { t } = useTranslation()
  const inputId = useId()
  const current = useRef(value)
  current.current = value
  const [pending, setPending] = useState(/** @type {Pending[]} */ ([]))
  const live = useRef(/** @type {Set<AbortController>} */ (new Set()))
  const [over, setOver] = useState(false)
  const sending = useRef(0)
  const room = maxFiles - value.length - pending.filter((p) => !p.error).length

  // leaving the page stops what is still on its way
  useEffect(() => {
    const controllers = live.current
    return () => controllers.forEach((c) => c.abort())
  }, [])

  /** @param {File} file @param {string} [replaces] the key of a failed entry this retries */
  const sendOne = async (file, replaces) => {
    const key = `${file.name}-${file.size}-${crypto.randomUUID()}`
    const controller = new AbortController()
    live.current.add(controller)
    /** @type {Pending} */
    const entry = { key, name: file.name, file, progress: { stage: 'checking' }, controller }
    setPending((p) => [...p.filter((x) => x.key !== replaces), entry])
    if (sending.current++ === 0) onBusyChange?.(true)
    try {
      const done = await upload(file, {
        signal: controller.signal,
        onProgress: (progress) => setPending((p) => p.map((x) => (x.key === key ? { ...x, progress } : x))),
      })
      // read the latest list: several uploads finish in any order
      onChange([...current.current, done])
      current.current = [...current.current, done]
      setPending((p) => p.filter((x) => x.key !== key))
    } catch (error) {
      if (controller.signal.aborted) setPending((p) => p.filter((x) => x.key !== key)) // cancelled on purpose: nothing to report
      else setPending((p) => p.map((x) => (x.key === key ? { ...x, error: describeError?.(error) ?? t('uploadFailed') } : x)))
    } finally {
      live.current.delete(controller)
      if (--sending.current === 0) onBusyChange?.(false)
    }
  }

  /** @param {File[]} files */
  const send = async (files) => {
    for (const file of files.slice(0, Math.max(room, 0))) await sendOne(file)
  }
  /** @param {import('react').DragEvent} e */
  const onDrop = (e) => {
    e.preventDefault()
    setOver(false)
    void send([...e.dataTransfer.files].filter((f) => accept.split(',').includes(f.type)))
  }

  /** The sentence for where a file is. @param {UploadProgress} p */
  const where = (p) => (p.stage === 'sending' && p.fraction !== undefined ? t('uploadStage.sendingPercent', { percent: Math.round(p.fraction * 100) }) : t(`uploadStage.${p.stage}`))

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
          <li key={p.key} className="flex min-h-24 w-56 max-w-full flex-col justify-between gap-2 rounded-media border border-line p-2 text-xs">
            <span className="truncate font-medium" title={p.name}>{p.name}</span>
            {p.error ? (
              <>
                <span role="alert" className="text-danger">{p.error}</span>
                <span className="flex gap-3">
                  <button type="button" className="inline-flex items-center gap-1 underline" onClick={() => void sendOne(p.file, p.key)}>
                    <RotateCw aria-hidden className="size-3" />
                    {t('retry')}
                  </button>
                  <button type="button" className="underline" onClick={() => setPending((all) => all.filter((x) => x.key !== p.key))}>
                    {t('dismiss')}
                  </button>
                </span>
              </>
            ) : (
              <>
                <span role="status" className="flex items-center gap-2 text-fg-soft">
                  <Spinner size="sm" decorative />
                  {where(p.progress)}
                </span>
                {p.progress.stage === 'sending' && p.progress.fraction !== undefined ? (
                  <span role="progressbar" aria-label={t('uploading')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(p.progress.fraction * 100)} className="block h-1.5 overflow-hidden rounded-full bg-surface-2">
                    <span className="block h-full bg-accent transition-[width] duration-(--dur-fast)" style={{ width: `${Math.round(p.progress.fraction * 100)}%` }} />
                  </span>
                ) : null}
                <button type="button" className="inline-flex items-center gap-1 self-start underline" onClick={() => p.controller.abort()}>
                  <X aria-hidden className="size-3" />
                  {t('cancel')}
                </button>
              </>
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
