import { AppError } from '../shared/errors'

export class Cancelled extends Error {
  constructor() {
    super('cancelled')
    this.name = 'Cancelled'
  }
}

export function publicMessage(error: unknown): string {
  if (error instanceof AppError) return error.message
  const message = error instanceof Error ? error.message : ''
  if (/pixel limit/i.test(message)) return '图片尺寸超过了处理上限'
  if (/EACCES|EPERM|permission denied/i.test(message)) return '没有写入这个文件夹的权限'
  if (/ENOSPC/.test(message)) return '磁盘空间不足'
  if (/unsupported|unknown format|Input file is missing|Vips/i.test(message)) return '无法识别这张图片'
  return '无法处理这张图片'
}
