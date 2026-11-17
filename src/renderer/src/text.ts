import type { JobStatus } from '../../shared/types'

export const STATUS_LABEL: Record<JobStatus, string> = {
  queued: '等待',
  running: '压缩中',
  done: '完成',
  failed: '失败',
  cancelled: '已取消'
}

export function parentName(filePath: string): string {
  const parts = filePath.split(/[/\\]/).filter(Boolean)
  return parts.length >= 2 ? (parts[parts.length - 2] ?? '') : ''
}

export function shortOutput(filePath: string): string {
  const parts = filePath.split(/[/\\]/).filter(Boolean)
  return parts.slice(-2).join('/')
}
