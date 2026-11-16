import type { CSSProperties } from 'react';

/** Inline styles (token-based) so the panels also render in node/server tests without a CSS module loader. */
const s = <T extends Record<string, CSSProperties>>(value: T) => value;
export const APPEARANCE_STYLES = s({
  panel: { display: 'grid', gap: 'var(--space-5)' },
  toolbar: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-3)' },
  supplied: { border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: 'var(--space-5)', background: 'var(--color-surface-1)', display: 'grid', gap: 'var(--space-3)' },
  facts: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 'var(--space-3)', margin: 0 },
  media: { border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)', padding: 'var(--space-5)', display: 'grid', gap: 'var(--space-4)', background: 'var(--color-surface-1)' },
  mediaHead: { display: 'flex', flexWrap: 'wrap', gap: 'var(--space-4)', alignItems: 'flex-start' },
  thumb: { width: 96, height: 96, objectFit: 'cover', borderRadius: 'var(--radius-sm,6px)', background: 'var(--color-surface-2)', flex: 'none' },
  person: { display: 'grid', gap: 'var(--space-2)' },
  rows: { listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 'var(--space-2)' },
  row: { display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 'var(--space-2) var(--space-4)', alignItems: 'center', padding: 'var(--space-3) 0', borderTop: '1px solid var(--color-border)' },
  rowText: { display: 'flex', flexWrap: 'wrap', gap: 'var(--space-1) var(--space-3)', alignItems: 'baseline', minWidth: 0, flex: '1 1 320px' },
  attribute: { color: 'var(--color-text-secondary)', minWidth: '12ch' },
  value: { fontWeight: 600 },
  correct: { flexBasis: '100%', display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', alignItems: 'center' },
  filters: { display: 'grid', gap: 'var(--space-3)', minWidth: 0 },
  head: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-3)' },
  total: { fontWeight: 600, margin: 0 },
  chips: { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' },
  chip: { display: 'inline-flex', gap: 'var(--space-1)', alignItems: 'center', border: '1px solid var(--color-border-strong)', borderRadius: 999, padding: 'var(--space-1) var(--space-3)',
    background: 'var(--color-surface-2)', color: 'var(--color-text-primary)', font: 'inherit', fontSize: 'var(--text-small)', cursor: 'pointer' },
  unknown: { display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', alignItems: 'center', fontSize: 'var(--text-small)' },
  group: { borderTop: '1px solid var(--color-border)', padding: 'var(--space-3) 0' },
  values: { listStyle: 'none', margin: 'var(--space-2) 0 0', padding: 0, display: 'grid', gap: 'var(--space-1)' },
  valueLabel: { display: 'grid', gridTemplateColumns: 'auto minmax(0,1fr) auto', gap: 'var(--space-2)', alignItems: 'center', fontSize: 'var(--text-small)', cursor: 'pointer' },
  count: { color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' },
});
