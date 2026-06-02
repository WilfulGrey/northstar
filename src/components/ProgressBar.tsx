import { clamp01, pct } from '@/lib/format'

interface ProgressBarProps {
  ratio: number
  className?: string
  color?: string
  showLabel?: boolean
}

export function ProgressBar({ ratio, className = '', color, showLabel = false }: ProgressBarProps) {
  const value = clamp01(ratio)
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-100">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${value * 100}%`, backgroundColor: color ?? '#4f46e5' }}
        />
      </div>
      {showLabel && <span className="w-9 shrink-0 text-right text-xs font-medium tabular-nums text-zinc-500">{pct(value)}</span>}
    </div>
  )
}
