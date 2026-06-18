import { useEffect, useMemo, useRef, useState } from 'react'
import { signedUrls } from '@/lib/api'
import type { Attachment } from '@/lib/types'

function fmtSize(n: number | null): string {
  if (n == null) return ''
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}
function fileIcon(mime: string | null): string {
  const m = mime ?? ''
  if (m.includes('pdf')) return '📕'
  if (m.includes('csv') || m.includes('sheet') || m.includes('excel')) return '📊'
  if (m.includes('zip') || m.includes('compressed')) return '🗜️'
  return '📄'
}

export function AttachmentList({
  items,
  onDelete,
  large,
}: {
  items: Attachment[]
  onDelete?: (a: Attachment) => void
  large?: boolean // render images at column width (used in comments)
}) {
  const [urls, setUrls] = useState<Map<string, string>>(new Map())
  const pathsKey = useMemo(() => items.map((i) => i.path).join(','), [items])

  useEffect(() => {
    let active = true
    signedUrls(items.map((i) => i.path))
      .then((m) => active && setUrls(m))
      .catch(() => {})
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathsKey])

  if (!items.length) return null
  return (
    <div className={large ? 'flex flex-col items-start gap-2' : 'flex flex-wrap gap-2'} data-testid="attachment-list">
      {items.map((a) => {
        const url = urls.get(a.path)
        const isImg = (a.mime_type ?? '').startsWith('image/')
        return (
          <div key={a.id} className="group relative" data-testid="attachment" data-file-name={a.file_name}>
            {isImg ? (
              <a href={url} target="_blank" rel="noreferrer" title={`${a.file_name} — open full size`}>
                {url ? (
                  <img
                    src={url}
                    alt={a.file_name}
                    className={
                      large
                        ? 'max-h-[480px] max-w-full rounded-md border border-zinc-200'
                        : 'h-20 w-20 rounded-md border border-zinc-200 object-cover'
                    }
                  />
                ) : (
                  <div className={`${large ? 'h-40 w-64' : 'h-20 w-20'} animate-pulse rounded-md bg-zinc-100`} />
                )}
              </a>
            ) : (
              <a
                href={url ? `${url}&download=${encodeURIComponent(a.file_name)}` : undefined}
                className="flex max-w-[220px] items-center gap-2 rounded-md border border-zinc-200 bg-white px-2.5 py-2 text-xs hover:bg-zinc-50"
                title={`Download ${a.file_name}`}
              >
                <span className="text-base leading-none">{fileIcon(a.mime_type)}</span>
                <span className="min-w-0">
                  <span className="block truncate font-medium text-zinc-700">{a.file_name}</span>
                  <span className="text-zinc-400">{fmtSize(a.size_bytes)}</span>
                </span>
              </a>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={() => onDelete(a)}
                title="Remove"
                className="absolute -right-1.5 -top-1.5 hidden h-5 w-5 items-center justify-center rounded-full bg-zinc-700 text-[10px] text-white group-hover:flex"
              >
                ✕
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}

export function AttachButton({
  onFiles,
  label = 'Attach',
  disabled,
}: {
  onFiles: (files: File[]) => void
  label?: string
  disabled?: boolean
}) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <>
      <button
        type="button"
        className="btn btn-secondary px-2 py-1 text-xs"
        disabled={disabled}
        onClick={() => ref.current?.click()}
        aria-label={label}
      >
        📎 {label}
      </button>
      <input
        ref={ref}
        type="file"
        multiple
        aria-label="Upload files"
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? [])
          if (files.length) onFiles(files)
          e.target.value = ''
        }}
      />
    </>
  )
}

/** Pull any files out of a paste or drop event (images come through as files). */
export function filesFromEvent(e: { clipboardData?: DataTransfer | null; dataTransfer?: DataTransfer | null }): File[] {
  const dt = e.clipboardData ?? e.dataTransfer
  if (!dt) return []
  if (dt.files && dt.files.length) return Array.from(dt.files)
  return Array.from(dt.items ?? [])
    .filter((i) => i.kind === 'file')
    .map((i) => i.getAsFile())
    .filter((f): f is File => !!f)
}
