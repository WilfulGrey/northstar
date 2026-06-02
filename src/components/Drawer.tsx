import { useEffect, type ReactNode } from 'react'

export function Drawer({
  open,
  onClose,
  children,
  maxWidth = 560,
}: {
  open: boolean
  onClose: () => void
  children: ReactNode
  maxWidth?: number
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-zinc-900/30 backdrop-blur-sm" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className="flex h-full w-full flex-col bg-white shadow-2xl"
        style={{ maxWidth }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}
