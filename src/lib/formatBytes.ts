const UNITS = ['B', 'KB', 'MB', 'GB'] as const

/** Human-readable file size, e.g. `formatBytes(2_400_000)` -> "2.3 MB". */
export function formatBytes(bytes: number | undefined): string {
  if (bytes == null) return '—'
  if (bytes === 0) return '0 B'

  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), UNITS.length - 1)
  const value = bytes / 1024 ** exponent

  return `${exponent === 0 ? value : value.toFixed(1)} ${UNITS[exponent]}`
}
