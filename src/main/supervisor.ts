import { utilityProcess, type UtilityProcess } from 'electron'
import fs from 'node:fs'
import { AppError } from '../shared/errors'
import type { CompressEvent, CompressRequest } from '../shared/types'
import { forkEnv, resolveWorker } from './runtime'

type WorkerOutbound =
  | { type: 'ready' }
  | { type: 'fatal'; message: string }
  | {
      type: 'done'
      id: string
      outputPath: string
      bytesIn: number
      bytesOut: number
      flattened: boolean
    }
  | { type: 'failed'; id: string; message: string }
  | { type: 'cancelled'; id: string }

export class Supervisor {
  private worker: UtilityProcess | null = null
  private ready = false
  private paused = false
  private quitting = false
  private crashes = 0
  private readonly pending: CompressRequest[] = []
  private readonly active = new Map<string, CompressRequest>()

  constructor(
    private readonly readConcurrency: () => number,
    private readonly emit: (event: CompressEvent) => void
  ) {}

  enqueue(jobs: CompressRequest[]): void {
    this.ensureWorker()
    for (const job of jobs) {
      if (this.pending.some((item) => item.id === job.id) || this.active.has(job.id)) continue
      this.pending.push(job)
    }
    this.pump()
  }

  pause(): void {
    this.paused = true
  }

  resume(): void {
    this.paused = false
    this.pump()
  }

  cancel(ids: string[]): void {
    for (const id of ids) {
      const index = this.pending.findIndex((job) => job.id === id)
      if (index >= 0) {
        this.pending.splice(index, 1)
        this.emit({ type: 'cancelled', id })
        continue
      }
      if (this.active.has(id)) this.worker?.postMessage({ type: 'cancel', id })
    }
  }

  pump(): void {
    if (!this.ready || this.paused || this.quitting || !this.worker) return
    const limit = this.readConcurrency()
    while (this.active.size < limit && this.pending.length > 0) {
      const job = this.pending.shift()
      if (!job) break
      this.active.set(job.id, job)
      this.worker.postMessage({ type: 'compress', job })
      this.emit({ type: 'started', id: job.id })
    }
  }

  shutdown(): void {
    this.quitting = true
    this.worker?.kill()
  }

  private ensureWorker(): void {
    if (this.worker) return
    const workerPath = resolveWorker()
    if (!fs.existsSync(workerPath)) throw new AppError('压缩引擎文件缺失')
    const child = utilityProcess.fork(workerPath, [], {
      serviceName: 'image-compress',
      stdio: 'pipe',
      env: forkEnv()
    })
    this.worker = child
    this.ready = false
    child.stderr?.on('data', (chunk) => {
      console.error(`[compress] ${chunk.toString()}`)
    })
    child.on('message', (message) => this.onMessage(message as WorkerOutbound))
    child.on('exit', () => this.onExit())
  }

  private onMessage(message: WorkerOutbound): void {
    if (message.type === 'ready') {
      this.ready = true
      this.crashes = 0
      this.pump()
      return
    }
    if (message.type === 'fatal') {
      console.error(message.message)
      this.failPending('压缩引擎没有启动')
      this.worker?.kill()
      return
    }
    if (!this.active.has(message.id)) return
    this.active.delete(message.id)
    if (message.type === 'done') {
      this.emit({
        type: 'done',
        id: message.id,
        outputPath: message.outputPath,
        bytesIn: message.bytesIn,
        bytesOut: message.bytesOut,
        flattened: message.flattened
      })
    } else if (message.type === 'failed') {
      this.emit({ type: 'failed', id: message.id, message: message.message })
    } else {
      this.emit({ type: 'cancelled', id: message.id })
    }
    this.pump()
  }

  private onExit(): void {
    this.worker = null
    this.ready = false
    if (this.quitting) return
    for (const job of this.active.values()) {
      this.emit({ type: 'failed', id: job.id, message: '压缩进程中断了' })
    }
    this.active.clear()
    if (this.pending.length === 0) return
    this.crashes += 1
    if (this.crashes > 2) {
      this.failPending('压缩进程中断了')
      return
    }
    try {
      this.ensureWorker()
    } catch (error) {
      console.error(error)
      this.failPending('压缩引擎没有启动')
    }
  }

  private failPending(message: string): void {
    for (const job of this.pending) this.emit({ type: 'failed', id: job.id, message })
    this.pending.length = 0
  }
}
