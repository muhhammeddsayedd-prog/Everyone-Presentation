// Studio motion presets on the pinned `motion` package. Durations and easings mirror the tokens
// (--duration-fast/base/slow = 120/200/320 ms, --ease-standard), so Motion and CSS transitions move together.
// Owner rule (2026-11-19): expressive but purposeful. Layout and shared-element transitions, spring feedback,
// count-ups, staggered lists and hero text reveals are allowed; confetti, parallax and cursor effects are not.
import type { Transition, Variants } from 'motion/react';

export const ease = { standard: [0.2, 0, 0, 1], enter: [0, 0, 0, 1], exit: [0.3, 0, 1, 1] } as const;
export const seconds = { fast: 0.12, base: 0.2, slow: 0.32 } as const;

/** Default transition for MotionConfig: the token "base" step. */
export const baseTransition: Transition = { duration: seconds.base, ease: ease.standard };
/** Pills, indicators and shared elements: quick, settled, no visible overshoot. */
export const glide: Transition = { type: 'spring', stiffness: 520, damping: 42, mass: 0.9 };
/** Cards that move between lists (casting slots, Library rows): a soft settle. */
export const settle: Transition = { type: 'spring', stiffness: 380, damping: 34 };
/** Press feedback on buttons and cards. */
export const press = { scale: 0.97 } as const;
/** Drag lift on the casting board. */
export const lift = { scale: 1.03, boxShadow: 'var(--elevation-pop)' } as const;

/** Fade and a 6 px rise: pages, panels and step content. */
export const rise: Variants = {
  hidden: { opacity: 0, y: 6 },
  shown: { opacity: 1, y: 0, transition: { duration: seconds.base, ease: ease.enter } },
  gone: { opacity: 0, y: -4, transition: { duration: seconds.fast, ease: ease.exit } },
};

/** Lists: children rise 30 ms apart; rows after the 12th share the last delay, so a long list settles in ~400 ms. */
const cappedStagger = (index: number) => 0.02 + Math.min(index, 12) * 0.03;
export const list: Variants = { hidden: {}, shown: { transition: { delayChildren: cappedStagger } } };
export const listItem: Variants = {
  hidden: { opacity: 0, y: 4 },
  shown: { opacity: 1, y: 0, transition: { duration: seconds.base, ease: ease.enter } },
};
