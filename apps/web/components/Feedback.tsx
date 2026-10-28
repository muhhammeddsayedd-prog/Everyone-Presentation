export function ErrorNotice({ message, retry }: { message: string; retry?: () => void }) {
  return <div className="notice notice-error" role="alert"><p>{message}</p>{retry && <button type="button" className="button button-small" onClick={retry}>Try again</button>}</div>;
}

export function Loading({ label = 'Loading your workspace…' }: { label?: string }) {
  return <div className="loading-state" role="status" aria-live="polite"><div className="loading-bar" /><p>{label}</p></div>;
}
