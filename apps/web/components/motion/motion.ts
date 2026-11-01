'use client';

import { useEffect, useLayoutEffect, useRef, useState, type DependencyList, type RefObject } from 'react';

// Motion follows Design Elements/DESIGN.md §7: 120 / 200 / 320 ms, standard, enter and exit easing,
// transform and opacity only, and nothing at all under reduced motion. Timings mirror tokens.css so
// Web Animations stay in step with the CSS transitions.
export const DURATION = { fast: 120, base: 200, slow: 320 } as const;
export const EASE = { standard: 'cubic-bezier(0.2, 0, 0, 1)', enter: 'cubic-bezier(0, 0, 0, 1)', exit: 'cubic-bezier(0.3, 0, 1, 1)' } as const;
const RISE = 6;
const STAGGER = 30;
const STAGGER_CAP = 12;
const STAGGER_LIMIT = 50;

const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;
const query = '(prefers-reduced-motion: reduce)';

/** True when motion is allowed. Read at call time so a preference change applies to the next animation. */
export function motionAllowed() {
  return typeof window !== 'undefined' && typeof Element.prototype.animate === 'function' && !window.matchMedia(query).matches;
}

export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setReduced(media.matches);
    update(); media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return reduced;
}

/** Fade and a short rise. Content is never hidden before script runs: the animation starts before paint. */
export function rise(element: Element, delay = 0, distance = RISE) {
  if (!motionAllowed()) return;
  element.animate([{ opacity: 0, transform: `translateY(${distance}px)` }, { opacity: 1, transform: 'none' }], { duration: DURATION.base, delay, easing: EASE.enter, fill: 'backwards' });
}

/** Opacity only, for large containers: a transform would make fixed descendants (inline drawers) relative to it. */
export function fadeIn(element: Element) {
  if (!motionAllowed()) return;
  element.animate([{ opacity: 0 }, { opacity: 1 }], { duration: DURATION.base, easing: EASE.enter });
}

/** Fades the page in when the route changes (not on query changes such as an opened job drawer). */
export function useRouteFade(ref: RefObject<HTMLElement | null>, route: string) {
  useIsomorphicLayoutEffect(() => { if (ref.current) fadeIn(ref.current); }, [route]);
}

/** Ported from React Bits AnimatedContent / FadeContent (MIT + Commons Clause), reduced to a WAAPI fade
 * and rise that replays whenever `deps` change, for example when the workspace step changes. */
export function useReveal(ref: RefObject<HTMLElement | null>, deps: DependencyList) {
  useIsomorphicLayoutEffect(() => { if (ref.current) rise(ref.current); }, deps);
}

/** Ported from React Bits AnimatedList (MIT + Commons Clause) as a callback ref: `<ul ref={stagger}>`. Children
 * present on mount, and rows added later (for example by "Load more"), rise in with a 30 ms stagger. Rows already
 * on screen never replay, and a large batch appears at once instead of cascading. */
export function stagger(container: HTMLElement | null) {
  if (!container) return;
  const run = (items: Element[]) => {
    if (!items.length || items.length > STAGGER_LIMIT) return;
    items.forEach((item, index) => rise(item, Math.min(index, STAGGER_CAP) * STAGGER, 4));
  };
  run([...container.children]);
  const observer = new MutationObserver(records => run(records.flatMap(record => [...record.addedNodes].filter((node): node is Element => node instanceof Element))));
  observer.observe(container, { childList: true });
  return () => observer.disconnect();
}

type Exit = 'drawer' | 'modal' | 'sheet' | 'toast' | 'fade';
// Each exit names the part that moves; the copy as a whole fades.
const exits: Record<Exit, { part?: string; keyframes: Keyframe[]; duration: number }> = {
  drawer: { keyframes: [{ transform: 'none', opacity: 1 }, { transform: 'translateX(24px)', opacity: 0 }], duration: DURATION.base },
  sheet: { keyframes: [{ transform: 'none', opacity: 1 }, { transform: 'translateX(-24px)', opacity: 0 }], duration: DURATION.base },
  modal: { part: '.modal', keyframes: [{ transform: 'none' }, { transform: 'translateY(4px)' }], duration: DURATION.fast + 40 },
  toast: { keyframes: [{ transform: 'none', opacity: 1 }, { transform: 'translateY(8px)', opacity: 0 }], duration: DURATION.fast + 40 },
  fade: { keyframes: [{ opacity: 1 }, { opacity: 0 }], duration: DURATION.fast + 40 },
};

/** Exit motion without changing how callers mount overlays. As the overlay unmounts (layout cleanup runs while
 * its nodes are still attached), an inert, hidden copy of its last frame plays the exit and removes itself. The
 * real dialog, with its role, ids and focus handling, is gone at once, so focus return is unchanged. */
export function useExitMotion(parts: [RefObject<HTMLElement | null>, Exit][]) {
  const latest = useRef(parts);
  useEffect(() => { latest.current = parts; });
  useIsomorphicLayoutEffect(() => {
    const nodes = latest.current.map(([ref, kind]) => [ref.current, kind] as const);
    return () => {
      if (!motionAllowed()) return;
      for (const [node, kind] of nodes) {
        if (!node || !node.isConnected) continue;
        const rect = node.getBoundingClientRect(); if (!rect.width) continue;
        const fixed = getComputedStyle(node).position === 'fixed';
        const ghost = node.cloneNode(true) as HTMLElement;
        // Only a real removal plays: StrictMode's simulated unmount leaves the node attached after the commit.
        queueMicrotask(() => { if (!node.isConnected) play(ghost, kind, rect, fixed); });
      }
    };
  }, []);
}

function play(ghost: HTMLElement, kind: Exit, rect: DOMRect, fixed: boolean) {
  ghost.removeAttribute('id'); ghost.querySelectorAll('[id]').forEach(item => item.removeAttribute('id'));
  ghost.removeAttribute('role'); ghost.removeAttribute('aria-live'); ghost.setAttribute('aria-hidden', 'true'); ghost.inert = true;
  ghost.classList.add('motion-ghost');
  if (!fixed) Object.assign(ghost.style, { position: 'fixed', top: `${rect.top}px`, left: `${rect.left}px`, width: `${rect.width}px`, height: `${rect.height}px`, margin: '0', zIndex: 'var(--z-toast)' });
  document.body.appendChild(ghost);
  const exit = exits[kind];
  const options: KeyframeAnimationOptions = { duration: exit.duration, easing: EASE.exit, fill: 'forwards' };
  const animation = ghost.animate(exit.part ? [{ opacity: 1 }, { opacity: 0 }] : exit.keyframes, options);
  if (exit.part) ghost.querySelector(exit.part)?.animate(exit.keyframes, options);
  const remove = () => ghost.remove();
  animation.addEventListener('finish', remove); animation.addEventListener('cancel', remove);
  setTimeout(remove, 600);
}
