import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = { children: ReactNode }

type State = {
  err: Error | null
  info: ErrorInfo | null
}

/**
 * Evita «schermata nera» senza messaggio se il renderer va in errore prima del layout.
 */
export default class RegiaAppErrorBoundary extends Component<Props, State> {
  state: State = { err: null, info: null }

  static getDerivedStateFromError(err: Error): Partial<State> {
    return { err }
  }

  override componentDidCatch(err: Error, info: ErrorInfo): void {
    console.error('[Regia] Errore UI non gestito:', err, info.componentStack)
    this.setState({ info })
  }

  override render(): ReactNode {
    const { err, info } = this.state
    if (!err) return this.props.children

    return (
      <div
        className="regia-fallback"
        style={{
          alignContent: 'start',
          justifyItems: 'stretch',
          textAlign: 'left',
          maxWidth: 720,
          margin: '0 auto',
        }}
      >
        <h1 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>
          L&apos;interfaccia non è partita
        </h1>
        <p style={{ marginBottom: '1rem' }}>
          Si è verificato un errore nel codice dell&apos;app. In sviluppo apri la
          console di Electron (DevTools): di solito c&apos;è lo stack completo.
        </p>
        <pre
          style={{
            padding: '1rem',
            borderRadius: 8,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            overflow: 'auto',
            fontSize: 12,
            lineHeight: 1.45,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {err.stack ?? err.message}
          {info?.componentStack ?
            `\n\n--- React component stack ---${info.componentStack}`
          : ''}
        </pre>
        <p style={{ marginTop: '1rem' }}>
          <button
            type="button"
            className="btn-icon"
            style={{
              padding: '0.5rem 0.85rem',
              background: 'var(--accent-soft)',
              color: 'var(--text)',
            }}
            onClick={() => globalThis.location.reload()}
          >
            Ricarica
          </button>
        </p>
      </div>
    )
  }
}
