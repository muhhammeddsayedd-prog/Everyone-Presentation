'use client';

import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { AnimatedNumber } from './AnimatedNumber';
import { motionAllowed } from './motion';

/** A big KPI figure. The first value counts up once (the React Bits CountUp idea, done with a CSS counter so the
 * DOM text is the real value at every moment: polling specs, assertions and screen readers never read an
 * intermediate number). Later changes roll with AnimatedNumber. A `format` skips the count-up. */
export function KpiNumber({ value, format }: { value: number; format?: (value: number) => string }) {
  const [first] = useState(value);
  const ref = useRef<HTMLSpanElement>(null);
  const countable = !format && value === first && Number.isInteger(first) && first > 0 && first < 100000;
  useLayoutEffect(() => {
    const node = ref.current;
    if (!countable || !node || !motionAllowed()) return;
    // A DOM flag, not React state: the visible counter is decoration over the real text.
    node.dataset.counting = '';
    const done = () => { delete node.dataset.counting; };
    node.addEventListener('animationend', done, { once: true });
    const fallback = setTimeout(done, 1200);
    return () => { node.removeEventListener('animationend', done); clearTimeout(fallback); done(); };
  }, [countable]);
  if (format || value !== first) return <AnimatedNumber value={value} format={format} />;
  return <span ref={ref} className="kpi-count" style={{ '--kpi-to': first } as CSSProperties}><span>{value}</span></span>;
}
