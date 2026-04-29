export type ControllerHidInput =
  | 'jogRight'
  | 'jogLeft'
  | 'button1'
  | 'button2'
  | 'button3'
  | 'button4'

export type ControllerHidAction =
  | 'none'
  | 'togglePlay'
  | 'prev'
  | 'next'
  | 'stop'
  | 'toggleSecondScreen'

export type ControllerHidActionMap = Record<ControllerHidInput, ControllerHidAction>

export const CONTROLLER_HID_INPUTS: ControllerHidInput[] = [
  'jogRight',
  'jogLeft',
  'button1',
  'button2',
  'button3',
  'button4',
]

export const CONTROLLER_HID_ACTIONS: Array<{
  value: ControllerHidAction
  label: string
}> = [
  { value: 'none', label: 'Nessuna azione' },
  { value: 'togglePlay', label: 'Play / pausa' },
  { value: 'prev', label: 'Brano precedente' },
  { value: 'next', label: 'Brano successivo' },
  { value: 'stop', label: 'Stop programma' },
  { value: 'toggleSecondScreen', label: 'Schermo 2 ON / OFF' },
]

export const CONTROLLER_HID_INPUT_LABELS: Record<ControllerHidInput, string> = {
  jogRight: 'Jog destra',
  jogLeft: 'Jog sinistra',
  button1: 'Pulsante 1',
  button2: 'Pulsante 2',
  button3: 'Pulsante 3',
  button4: 'Pulsante 4',
}

const STORAGE_KEY = 'regia.controllerHid.actionMap.v1'

const DEFAULT_ACTION_MAP: ControllerHidActionMap = {
  jogRight: 'next',
  jogLeft: 'prev',
  button1: 'togglePlay',
  button2: 'prev',
  button3: 'next',
  button4: 'stop',
}

function normalizeAction(raw: unknown): ControllerHidAction | null {
  return CONTROLLER_HID_ACTIONS.some((a) => a.value === raw)
    ? (raw as ControllerHidAction)
    : null
}

export function readControllerHidActionMap(): ControllerHidActionMap {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as unknown
    const obj = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
    const out: ControllerHidActionMap = { ...DEFAULT_ACTION_MAP }
    for (const input of CONTROLLER_HID_INPUTS) {
      out[input] = normalizeAction(obj[input]) ?? DEFAULT_ACTION_MAP[input]
    }
    return out
  } catch {
    return { ...DEFAULT_ACTION_MAP }
  }
}

export function writeControllerHidActionMap(next: ControllerHidActionMap): void {
  const normalized: ControllerHidActionMap = { ...DEFAULT_ACTION_MAP }
  for (const input of CONTROLLER_HID_INPUTS) {
    normalized[input] = normalizeAction(next[input]) ?? DEFAULT_ACTION_MAP[input]
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized))
}
