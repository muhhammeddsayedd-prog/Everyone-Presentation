'use client';

import { MotionConfig } from 'motion/react';
import type { ReactNode } from 'react';
import { baseTransition } from './presets';

/** Wraps every app root (Studio, guest review, OAuth consent). `reducedMotion="user"` makes every Motion
 * animation honour the operating system setting; CSS keeps its own kill switch in base.css. */
export function MotionRoot({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user" transition={baseTransition}>{children}</MotionConfig>;
}
