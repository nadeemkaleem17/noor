import { ImagePlus, Trash2 } from 'lucide-react'
import { useId, useRef, useState, type DragEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '../cn'
import { Spinner } from './spinner'

/** What the uploader needs to show a finished upload. The admin's media record has more; it is passed through untouched. */
export type UploadedImage = { id: string; src: string; alt?: string }

type Props<T extends UploadedImage> = {
  value: T[]
  onChange: (value: T[]) => void
  /** Sends one file and resolves with its media record. Injected, so this package does no data fetching. */
  upload: (file: File) => Promise<T>
  multiple?: boolean
  maxFiles?: number
  /** MIME types the picker offers. The server still checks the real file type. */
  accept?: string
  label?: string
  className?: string
}

type Pending = { key: string; name: string; error?: string }

export function ImageUpload<T extends UploadedImage>({ value, onChange, upload, multiple = false, maxFiles = multiple ? 10 : 1, accept = 'image/jpeg,image/png,image/webp,image/avif', label, className }: Props<T>) {
  const { t } = useTranslation()
  const inputId = useId()
  const current = useRef(value)
  current.current = value
  const [pending, setPending] = useState<Pending[]>([])
  const [over, setOver] = useState(false)
  const room = maxFiles - value.length

  const send = async (files: File[]) => {
    for (const file of files.slice(0, Math.max(room, 0))) {
      const key = `${file.name}-${file.size}-${crypto.randomUUID()}`
      setPending((p) => [...p, { key, name: file.name }])
      try {
        const done = await upload(file)
        // read the latest list: several uploads finish in any order
        onChange([...current.current, done])
        current.current = [...current.current, done]
        setPending((p) => p.filter((x) => x.key !== key))
      } catch {
        setPending((p) => p.map((x) => (x.key === key ? { ...x, error: t('uploadFailed') } : x)))
      }
    }
  }
  const onDrop = (e: DragEvent) => {
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
