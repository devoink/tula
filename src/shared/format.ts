export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—'
  if (bytes < 1024) return `${Math.round(bytes)} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

export function formatRatio(before: number, after: number): string {
  if (before <= 0) return '—'
  const percent = Math.round(((before - after) / before) * 100)
  if (percent > 0) return `−${percent}%`
  if (percent < 0) return `+${Math.abs(percent)}%`
  return '0%'
}

export function formatSaved(bytes: number): string {
  if (bytes > 0) return `节省 ${formatBytes(bytes)}`
  if (bytes < 0) return `增加 ${formatBytes(-bytes)}`
  return '体积没有变化'
}
