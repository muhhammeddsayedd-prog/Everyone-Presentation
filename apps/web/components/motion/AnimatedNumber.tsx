'use client';

import { useLayoutEffect, useRef } from 'react';
import { DURATION, EASE, motionAllowed } from './motion';

/** Ported from React Bits Counter (MIT + Commons Clause), reduced to one rolling value. The real value is the
 * only text in the DOM at every moment, so accessible names and assertions never see an intermediate number;
 * the outgoing value is drawn by a CSS pseudo-element while it rolls away. Nothing moves on first render. */
export function AnimatedNumber({ value, format = String }: { value: number; format?: (value: number) => string }) {
  const outer = useRef<HTMLSpanElement>(null);
  const inner = useRef<HTMLSpanElement>(null);
  const previous = useRef<number | null>(null);
  useLayoutEffect(() => {
    const before = previous.current; previous.current = value;
    const wrapper = outer.current; const current = inner.current;
    if (before === null || before === value || !wrapper || !current || !motionAllowed()) return;
    const up = value > before;
    wrapper.dataset.prev = format(before); wrapper.dataset.direction = up ? 'up' : 'down';
    current.animate([{ opacity: 0, transform: `translateY(${up ? 0.5 : -0.5}em)` }, { opacity: 1, transform: 'none' }], { duration: DURATION.base, easing: EASE.enter });
    const timer = setTimeout(() => { delete wrapper.dataset.prev; delete wrapper.dataset.direction; }, DURATION.base);
    return () => clearTimeout(timer);
  }, [value, format]);
  return <span ref={outer} className="rolling-number"><span ref={inner}>{format(value)}</span></span>;
}
