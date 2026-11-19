'use client';

import { motion } from 'motion/react';
import type { ReactNode } from 'react';
import { list, listItem, rise } from './presets';

/** Fade and rise on mount, or again when `replay` changes (for example the workspace step).
 * Concept from React Bits FadeContent / AnimatedContent, rebuilt on Motion (the originals need GSAP). */
export function Reveal({ children, replay, className, as = 'div' }: { children: ReactNode; replay?: string | number; className?: string; as?: 'div' | 'section' }) {
  const Tag = as === 'section' ? motion.section : motion.div;
  return <Tag key={replay} className={className} variants={rise} initial="hidden" animate="shown">{children}</Tag>;
}

/** A staggered list (concept from React Bits AnimatedList, rebuilt on Motion). Rows keep their own roles. */
export function RevealList({ children, className, as = 'ul', label }: { children: ReactNode; className?: string; as?: 'ul' | 'ol' | 'div'; label?: string }) {
  const Tag = as === 'ol' ? motion.ol : as === 'div' ? motion.div : motion.ul;
  return <Tag className={className} aria-label={label} variants={list} initial="hidden" animate="shown">{children}</Tag>;
}
export function RevealItem({ children, className, as = 'li', layout }: { children: ReactNode; className?: string; as?: 'li' | 'div'; layout?: boolean }) {
  const Tag = as === 'div' ? motion.div : motion.li;
  return <Tag className={className} variants={listItem} layout={layout}>{children}</Tag>;
}
