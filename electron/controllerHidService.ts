import fs from 'node:fs'
import path from 'node:path'
import type { Device as NodeHidDevice, HID as NodeHidHandle } from 'node-hid'

export type ControllerHidLearningStep =
  | 'jogRight'
  | 'jogLeft'
  | 'button1'
  | 'button2'
  | 'button3'
  | 'button4'

export const CONTROLLER_HID_LEARNING_STEPS: ControllerHidLearningStep[] = [
  'jogRight',
  'jogLeft',
  'button1',
  'button2',
  'button3',
  'button4',
]

export type ControllerHidDeviceInfo = {
  id: string
  path: string
  vendorId: number | null
  productId: number | null
  serialNumber: string | null
  manufacturer: string | null
  product: string | null
  release: number | null
  interfaceNumber: number | null
  usagePage: number | null
  usage: number | null
  excludedHint: string | null
}

export type ControllerHidRawEvent = {
  ts: number
  deviceId: string
  rawHex: string
  reportId: number | null
  byteLength: number
  matchedStep?: ControllerHidLearningStep
  learned: boolean
}

export type ControllerHidProfile = {
  version: 1
  savedAt: string
  device: ControllerHidDeviceInfo
  fingerprint: ControllerHidFingerprint
  reportsByStep: Record<ControllerHidLearningStep, string>
}

export type ControllerHidStatus = {
  available: boolean
  adapterError: string | null
  selectedDeviceId: string | null
  profile: ControllerHidProfile | null
  connected: boolean
  learning: {
    active: boolean
    device: ControllerHidDeviceInfo | null
    captured: Partial<Record<ControllerHidLearningStep, string>>
    lastEvent: ControllerHidRawEvent | null
    readyToSave: boolean
  }
  recentEvents: ControllerHidRawEvent[]
}

type ControllerHidFingerprint = {
  path: string | null
  vendorId: number | null
  productId: number | null
  serialNumber: string | null
  manufacturer: string | null
  product: string | null
  usagePage: number | null
  usage: number | null
  interfaceNumber: number | null
}

type NodeHidModule = typeof import('node-hid')

const PROFILE_FILE = 'controller-hid-profile.json'
const RECENT_EVENT_LIMIT = 16

function finiteNumberOrNull(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

function stringOrNull(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const t = v.trim()
  return t.length ? t : null
}

function rawEventToHex(data: Buffer | number[]): string {
  const bytes = Buffer.isBuffer(data) ? [...data] : data
  return bytes.map((b) => b.toString(16).padStart(2, '0')).join(' ')
}

function detectExcludedHint(d: Pick<ControllerHidDeviceInfo, 'product' | 'manufacturer' | 'usagePage' | 'usage'>): string | null {
  const text = `${d.manufacturer ?? ''} ${d.product ?? ''}`.toLowerCase()
  if (text.includes('trackpad') || text.includes('touchpad')) return 'Possibile trackpad'
  if (text.includes('magic mouse') || /\bmouse\b/.test(text)) return 'Possibile mouse'
  if (text.includes('keyboard') || text.includes('tastiera')) return 'Possibile tastiera'
  if (text.includes('apple') && d.usagePage === 1 && d.usage === 2) return 'Possibile puntatore Apple'
  return null
}

function normalizeDevice(d: NodeHidDevice): ControllerHidDeviceInfo | null {
  const devicePath = stringOrNull(d.path)
  if (!devicePath) return null
  const info: ControllerHidDeviceInfo = {
    id: devicePath,
    path: devicePath,
    vendorId: finiteNumberOrNull(d.vendorId),
    productId: finiteNumberOrNull(d.productId),
    serialNumber: stringOrNull(d.serialNumber),
    manufacturer: stringOrNull(d.manufacturer),
    product: stringOrNull(d.product),
    release: finiteNumberOrNull(d.release),
    interfaceNumber: finiteNumberOrNull(d.interface),
    usagePage: finiteNumberOrNull(d.usagePage),
    usage: finiteNumberOrNull(d.usage),
    excludedHint: null,
  }
  info.excludedHint = detectExcludedHint(info)
  return info
}

function fingerprintFromDevice(d: ControllerHidDeviceInfo): ControllerHidFingerprint {
  return {
    path: d.path,
    vendorId: d.vendorId,
    productId: d.productId,
    serialNumber: d.serialNumber,
    manufacturer: d.manufacturer,
    product: d.product,
    usagePage: d.usagePage,
    usage: d.usage,
    interfaceNumber: d.interfaceNumber,
  }
}

function profileMatchesDevice(
  profile: ControllerHidProfile,
  device: ControllerHidDeviceInfo,
): boolean {
  const fp = profile.fingerprint
  if (fp.path && device.path === fp.path) return true
  if (fp.vendorId == null || fp.productId == null) return false
  if (device.vendorId !== fp.vendorId || device.productId !== fp.productId) return false
  if (fp.serialNumber && device.serialNumber && fp.serialNumber !== device.serialNumber)
    return false
  if (fp.usagePage != null && device.usagePage != null && fp.usagePage !== device.usagePage)
    return false
  if (fp.usage != null && device.usage != null && fp.usage !== device.usage) return false
  return true
}

function normalizeProfile(raw: unknown): ControllerHidProfile | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Partial<ControllerHidProfile>
  if (o.version !== 1 || !o.device || !o.fingerprint || !o.reportsByStep) {
    return null
  }
  for (const step of CONTROLLER_HID_LEARNING_STEPS) {
    if (typeof o.reportsByStep[step] !== 'string' || !o.reportsByStep[step]) {
      return null
    }
  }
  return o as ControllerHidProfile
}

export class ControllerHidService {
  private hid: NodeHidModule | null = null
  private adapterError: string | null = null
  private selectedDeviceId: string | null = null
  private profile: ControllerHidProfile | null = null
  private handle: NodeHidHandle | null = null
  private handleDevice: ControllerHidDeviceInfo | null = null
  private learningActive = false
  private learningDevice: ControllerHidDeviceInfo | null = null
  private learningCaptured: Partial<Record<ControllerHidLearningStep, string>> = {}
  private learningLastEvent: ControllerHidRawEvent | null = null
  private recentEvents: ControllerHidRawEvent[] = []

  constructor(
    private readonly userDataDir: string,
    private readonly emitEvent: (event: ControllerHidRawEvent) => void,
  ) {
    this.profile = this.readProfile()
  }

  async listDevices(): Promise<ControllerHidDeviceInfo[]> {
    const hid = await this.getHid()
    if (!hid) return []
    try {
      return hid
        .devices()
        .map(normalizeDevice)
        .filter((d): d is ControllerHidDeviceInfo => Boolean(d))
        .sort((a, b) =>
          `${a.manufacturer ?? ''} ${a.product ?? ''}`.localeCompare(
            `${b.manufacturer ?? ''} ${b.product ?? ''}`,
            undefined,
            { numeric: true, sensitivity: 'base' },
          ),
        )
    } catch (e) {
      this.adapterError = e instanceof Error ? e.message : String(e)
      return []
    }
  }

  async getStatus(): Promise<ControllerHidStatus> {
    await this.tryReconnectProfile()
    return this.snapshotStatus()
  }

  async selectDevice(deviceId: string | null): Promise<ControllerHidStatus> {
    this.selectedDeviceId = typeof deviceId === 'string' && deviceId.trim() ? deviceId : null
    return this.snapshotStatus()
  }

  async startLearning(deviceId?: string | null): Promise<ControllerHidStatus> {
    const id = typeof deviceId === 'string' && deviceId.trim() ? deviceId : this.selectedDeviceId
    if (!id) throw new Error('Seleziona prima un device HID.')
    const devices = await this.listDevices()
    const device = devices.find((d) => d.id === id)
    if (!device) throw new Error('Device HID non trovato.')
    this.closeHandle()
    this.learningActive = true
    this.learningDevice = device
    this.learningCaptured = {}
    this.learningLastEvent = null
    this.selectedDeviceId = device.id
    await this.openDevice(device, true)
    return this.snapshotStatus()
  }

  async captureLearningStep(step: ControllerHidLearningStep): Promise<ControllerHidStatus> {
    if (!CONTROLLER_HID_LEARNING_STEPS.includes(step)) {
      throw new Error('Step learning non valido.')
    }
    if (!this.learningActive || !this.learningDevice) {
      throw new Error('Learning non attivo.')
    }
    if (!this.learningLastEvent) {
      throw new Error('Nessun report ricevuto: esegui prima il gesto richiesto.')
    }
    this.learningCaptured = {
      ...this.learningCaptured,
      [step]: this.learningLastEvent.rawHex,
    }
    return this.snapshotStatus()
  }

  async saveLearningProfile(): Promise<ControllerHidStatus> {
    if (!this.learningActive || !this.learningDevice) {
      throw new Error('Learning non attivo.')
    }
    const reportsByStep: Partial<Record<ControllerHidLearningStep, string>> = {}
    for (const step of CONTROLLER_HID_LEARNING_STEPS) {
      const rawHex = this.learningCaptured[step]
      if (!rawHex) throw new Error('Completa tutti gli step del learning.')
      reportsByStep[step] = rawHex
    }
    const profile: ControllerHidProfile = {
      version: 1,
      savedAt: new Date().toISOString(),
      device: this.learningDevice,
      fingerprint: fingerprintFromDevice(this.learningDevice),
      reportsByStep: reportsByStep as Record<ControllerHidLearningStep, string>,
    }
    this.profile = profile
    this.writeProfile(profile)
    this.learningActive = false
    this.learningCaptured = {}
    this.learningLastEvent = null
    await this.openDevice(this.learningDevice, false)
    return this.snapshotStatus()
  }

  cancelLearning(): ControllerHidStatus {
    this.learningActive = false
    this.learningDevice = null
    this.learningCaptured = {}
    this.learningLastEvent = null
    this.closeHandle()
    return this.snapshotStatus()
  }

  async forgetProfile(): Promise<ControllerHidStatus> {
    this.profile = null
    this.selectedDeviceId = null
    this.learningActive = false
    this.learningDevice = null
    this.learningCaptured = {}
    this.learningLastEvent = null
    this.closeHandle()
    try {
      fs.rmSync(this.profilePath(), { force: true })
    } catch {
      /* ignore */
    }
    return this.snapshotStatus()
  }

  shutdown(): void {
    this.closeHandle()
  }

  private async getHid(): Promise<NodeHidModule | null> {
    if (this.hid) return this.hid
    if (this.adapterError) return null
    try {
      this.hid = await import('node-hid')
      return this.hid
    } catch (e) {
      this.adapterError = e instanceof Error ? e.message : String(e)
      return null
    }
  }

  private async tryReconnectProfile(): Promise<void> {
    if (this.handle || this.learningActive || !this.profile) return
    const devices = await this.listDevices()
    const device = devices.find((d) => this.profile && profileMatchesDevice(this.profile, d))
    if (!device) return
    try {
      await this.openDevice(device, false)
    } catch {
      /* status espone adapterError / disconnected */
    }
  }

  private async openDevice(
    device: ControllerHidDeviceInfo,
    learning: boolean,
  ): Promise<void> {
    const hid = await this.getHid()
    if (!hid) throw new Error(this.adapterError ?? 'Adapter HID non disponibile.')
    this.closeHandle()
    try {
      const handle = new hid.HID(device.path)
      this.handle = handle
      this.handleDevice = device
      handle.on('data', (data: Buffer | number[]) =>
        this.onDeviceData(device, data, learning),
      )
      handle.on('error', (err: unknown) => {
        this.adapterError = err instanceof Error ? err.message : String(err)
        this.closeHandle()
      })
    } catch (e) {
      this.adapterError = e instanceof Error ? e.message : String(e)
      throw e
    }
  }

  private onDeviceData(
    device: ControllerHidDeviceInfo,
    data: Buffer | number[],
    learning: boolean,
  ): void {
    const rawHex = rawEventToHex(data)
    const bytes = Buffer.isBuffer(data) ? [...data] : data
    const matchedStep = this.matchStep(rawHex)
    const event: ControllerHidRawEvent = {
      ts: Date.now(),
      deviceId: device.id,
      rawHex,
      reportId: bytes.length > 0 ? bytes[0] ?? null : null,
      byteLength: bytes.length,
      ...(matchedStep ? { matchedStep } : {}),
      learned: !learning && Boolean(matchedStep),
    }
    if (learning) this.learningLastEvent = event
    this.recentEvents = [event, ...this.recentEvents].slice(0, RECENT_EVENT_LIMIT)
    if (!learning && matchedStep) this.emitEvent(event)
  }

  private matchStep(rawHex: string): ControllerHidLearningStep | undefined {
    const profile = this.profile
    if (!profile) return undefined
    return CONTROLLER_HID_LEARNING_STEPS.find(
      (step) => profile.reportsByStep[step] === rawHex,
    )
  }

  private snapshotStatus(): ControllerHidStatus {
    return {
      available: Boolean(this.hid) || !this.adapterError,
      adapterError: this.adapterError,
      selectedDeviceId: this.selectedDeviceId,
      profile: this.profile,
      connected: Boolean(this.handle),
      learning: {
        active: this.learningActive,
        device: this.learningDevice,
        captured: { ...this.learningCaptured },
        lastEvent: this.learningLastEvent,
        readyToSave: CONTROLLER_HID_LEARNING_STEPS.every(
          (step) => typeof this.learningCaptured[step] === 'string',
        ),
      },
      recentEvents: [...this.recentEvents],
    }
  }

  private closeHandle(): void {
    const handle = this.handle
    this.handle = null
    this.handleDevice = null
    if (!handle) return
    try {
      handle.removeAllListeners()
      handle.close()
    } catch {
      /* ignore */
    }
  }

  private profilePath(): string {
    return path.join(this.userDataDir, PROFILE_FILE)
  }

  private readProfile(): ControllerHidProfile | null {
    try {
      return normalizeProfile(JSON.parse(fs.readFileSync(this.profilePath(), 'utf8')))
    } catch {
      return null
    }
  }

  private writeProfile(profile: ControllerHidProfile): void {
    fs.mkdirSync(this.userDataDir, { recursive: true })
    fs.writeFileSync(this.profilePath(), `${JSON.stringify(profile, null, 2)}\n`, 'utf8')
  }
}
