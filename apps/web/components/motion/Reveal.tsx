'use client';

import { m as motion, useReducedMotion, type HTMLMotionProps } from 'motion/react';
import type { ReactNode } from 'react';
import { list, listItem, rise } from './presets';

/** Fade and rise on mount, or again when `replay` changes (for example the workspace step).
 * Concept from React Bits FadeContent / AnimatedContent, rebuilt on Motion (the originals need GSAP). */
export function Reveal({ children, replay, className, as = 'div' }: { children: ReactNode; replay?: string | number; className?: string; as?: 'div' | 'section' }) {
  const Tag = as === 'section' ? motion.section : motion.div;
  // Under reduced motion content starts settled: no fade, no rise (MotionConfig alone only stops transforms).
  const settled = useReducedMotion() === true;
  return <Tag key={replay} className={className} variants={rise} initial={settled ? false : 'hidden'} animate="shown">{children}</Tag>;
}

/** A staggered list (concept from React Bits AnimatedList, rebuilt on Motion). Rows keep their own roles. */
type Passthrough = Omit<HTMLMotionProps<'li'>, 'variants' | 'initial' | 'animate' | 'children' | 'className' | 'layout'>;
export function RevealList({ children, className, as = 'ul', label, ...rest }: { children: ReactNode; className?: string; as?: 'ul' | 'ol' | 'div'; label?: string } & Passthrough) {
  const Tag = (as === 'ol' ? motion.ol : as === 'div' ? motion.div : motion.ul) as typeof motion.ul;
  const settled = useReducedMotion() === true;
  return <Tag {...(rest as HTMLMotionProps<'ul'>)} className={className} aria-label={label} variants={list} initial={settled ? false : 'hidden'} animate="shown">{children}</Tag>;
}
/** A list row. Extra props (aria-busy, data-*, id, handlers) pass through to the element. */
export function RevealItem({ children, className, as = 'li', layout, ...rest }: { children: ReactNode; className?: string; as?: 'li' | 'div'; layout?: boolean | 'position' } & Passthrough) {
  const Tag = (as === 'div' ? motion.div : motion.li) as typeof motion.li;
  return <Tag {...rest} className={className} variants={listItem} layout={layout}>{children}</Tag>;
}
