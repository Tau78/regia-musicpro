import { useRegia } from '../state/RegiaContext.tsx'

export default function PlanciaWorkspaceBanner() {
  const {
    activeNamedWorkspaceId,
    activeNamedWorkspaceLabel,
    floatingPlaylistOpen,
    floatingPlaylistSessions,
  } = useRegia()

  const showPlancia =
    floatingPlaylistOpen && floatingPlaylistSessions.length > 0

  if (!activeNamedWorkspaceId || !showPlancia) return null

  return (
    <div
      className="regia-plancia-workspace-banner"
      role="status"
      aria-live="polite"
    >
      <span className="regia-plancia-workspace-banner-kicker">Workspace</span>
      <span className="regia-plancia-workspace-banner-name">
        {activeNamedWorkspaceLabel || 'Senza titolo'}
      </span>
    </div>
  )
}
