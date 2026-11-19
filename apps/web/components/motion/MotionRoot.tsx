'use client';

import { LazyMotion, MotionConfig } from 'motion/react';
import type { ReactNode } from 'react';
import { baseTransition } from './presets';

const loadFeatures = () => import('./features').then(module => module.default);

/** Wraps every app root (Studio, guest review, OAuth consent). Components use `m` (imported as `motion`) so the
 * animation features load after first paint instead of in every route's bundle. `reducedMotion="user"` stops
 * transform/layout animation under the OS setting; entrances additionally start settled (see Reveal.tsx). */
export function MotionRoot({ children }: { children: ReactNode }) {
  return <LazyMotion features={loadFeatures}><MotionConfig reducedMotion="user" transition={baseTransition}>{children}</MotionConfig></LazyMotion>;
}
