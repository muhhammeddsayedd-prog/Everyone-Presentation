'use client';

import { useReducedMotion } from 'motion/react';
import BlurText from './bits/BlurText';
import { useHydrated } from '../shell/preferences';

/** Hero text reveal (React Bits BlurText, vendored in ./bits). Words settle from soft to sharp once, after
 * hydration. Server markup and the first client render are the plain text, so server rendering is deterministic
 * and needs no animation runtime; under reduced motion the plain text stays. The full text is always exposed. */
export function TextReveal({ text }: { text: string }) {
  const hydrated = useHydrated();
  const reduced = useReducedMotion() === true;
  if (!hydrated || reduced) return <span className="text-reveal" data-pending={!hydrated && !reduced ? '' : undefined}>{text}</span>;
  return <BlurText as="span" className="text-reveal" text={text} animateBy="words" direction="bottom" trigger="load" delay={40} stepDuration={0.32} />;
}
