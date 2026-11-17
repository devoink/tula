import os from 'node:os'
import sharp from 'sharp'
import { z } from 'zod'
import { compressRequestSchema } from '../shared/schema'
import { publicMessage } from './errors'
import { compressFile } from './pipeline'

sharp.cache(false)
sharp.concurrency(Math.max(1, Math.floor(os.cpus().length / 2)))

type Port = {
  on(event: 'message', listener: (event: { data: unknown }) => void): void
  postMessage(message: unknown): void
}

const parent = (process as NodeJS.Process & { parentPort?: Port }).parentPort

const inboundSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('compress'), job: compressRequestSchema }),
  z.object({ type: z.literal('cancel'), id: z.string().min(8).max(100) })
])

const running = new Map<string, AbortController>()

function post(message: unknown) {
  parent?.postMessage(message)
}

async function handle(payload: unknown) {
  const parsed = inboundSchema.safeParse(payload)
  if (!parsed.success) {
    console.error('[compress] 收到无法识别的任务')
    return
  }

  if (parsed.data.type === 'cancel') {
    running.get(parsed.data.id)?.abort()
    return
  }

  const { job } = parsed.data
  const controller = new AbortController()
  running.set(job.id, controller)
  try {
    const result = await compressFile(job.inputPath, job.preset, controller.signal)
    if (controller.signal.aborted) {
      post({ type: 'cancelled', id: job.id })
      return
    }
    post({ type: 'done', id: job.id, ...result })
  } catch (error) {
    if (controller.signal.aborted) {
      post({ type: 'cancelled', id: job.id })
      return
    }
    console.error(error)
    post({ type: 'failed', id: job.id, message: publicMessage(error) })
  } finally {
    running.delete(job.id)
  }
}

if (!parent) {
  throw new Error('压缩进程缺少父进程通道')
}

parent.on('message', (event) => {
  void handle(event.data)
})

post({ type: 'ready' })
