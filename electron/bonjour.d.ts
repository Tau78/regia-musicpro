declare module 'bonjour' {
  import type { EventEmitter } from 'node:events'

  export interface Service {
    stop(): void
  }

  export interface BonjourPublishOptions {
    name: string
    type: string
    port: number
    host?: string
    txt?: Record<string, string>
  }

  export interface BonjourInstance extends EventEmitter {
    publish(opts: BonjourPublishOptions): Service
    destroy(): void
  }

  function bonjour(): BonjourInstance
  export default bonjour
}
