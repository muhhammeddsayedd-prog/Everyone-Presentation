'use client';

/* A cover in the everyone. editorial style (light canvas, wordmark, bold title with a full stop), drawn from real
   record fields only. It identifies a project or series in a grid; it is not a rendered presentation page. */
export function CoverThumb({ title, subtitle, client, tone = 'default', size = 'card' }: { title: string; subtitle?: string | null; client?: string | null; tone?: 'default' | 'muted'; size?: 'card' | 'hero' }) {
  const heading = /[.!?…]$/u.test(title.trim()) ? title.trim() : `${title.trim()}.`;
  return <div className={`cover-thumb cover-thumb-${size}${tone === 'muted' ? ' cover-thumb-muted' : ''}`} aria-hidden="true">
    <img className="cover-thumb-wordmark" src="/brand/everyone-logotype.svg" alt="" />
    <div className="cover-thumb-title"><strong dir="auto">{heading}</strong>{subtitle && <span dir="auto">{subtitle}</span>}</div>
    <span className="cover-thumb-client" dir="auto">{client ?? 'No client linked'}</span>
  </div>;
}
