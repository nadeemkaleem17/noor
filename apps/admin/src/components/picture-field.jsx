import { ImageUpload } from '@noor/ui/image-upload'
import { uploadErrorText, uploadImage } from '@/lib/upload'

/**
 * One picture: upload, preview, remove. The caller keeps the media id; the picture is already stored when it is chosen.
 * @param {{ mediaId: string | undefined; src: string | undefined; onPick: (img: { id: string; src: string; } | null) => void; label: string; disabled?: boolean; limits?: { minSide?: number; goodSide?: number; }; onWarn?: (note: string) => void; }} props
 */
export function PictureField({ mediaId, src, onPick, label, disabled = false, limits, onWarn }) {
  return (
    <ImageUpload
      value={mediaId && src ? [{ id: mediaId, src, alt: '' }] : []}
      maxFiles={disabled ? 0 : 1}
      label={label}
      onChange={(list) => {
        const last = list.at(-1)
        onPick(last ? { id: last.id, src: last.src } : null)
      }}
      upload={(file) => uploadImage(file, onWarn, limits)}
      describeError={uploadErrorText}
    />
  )
}
