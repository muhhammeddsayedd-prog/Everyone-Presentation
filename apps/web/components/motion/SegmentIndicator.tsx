'use client';

import { useLayoutEffect, useRef } from 'react';

const active = ':scope > [aria-pressed="true"], :scope > [aria-selected="true"], :scope > [aria-current="page"], :scope > [aria-current="true"], :scope > [aria-current="step"], :scope > label:has(input:checked)';

/** A single selection fill that slides to the active segment (the idea of React Bits Glide Select and Segment
 * Pulse, written in CSS). Place it as the first child of a `.segmented` group. It reads the selection from the
 * buttons' aria-pressed / aria-current or the checked radio, so the controls and their semantics are unchanged. */
export function SegmentIndicator() {
  const ref = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const indicator = ref.current; const group = indicator?.parentElement;
    if (!indicator || !group) return;
    let frame = 0;
    const place = () => {
      const item = group.querySelector<HTMLElement>(active);
      if (!item) { delete indicator.dataset.active; return; }
      indicator.style.setProperty('--segment-x', `${item.offsetLeft}px`);
      indicator.style.setProperty('--segment-y', `${item.offsetTop}px`);
      indicator.style.setProperty('--segment-w', `${item.offsetWidth}px`);
      indicator.style.setProperty('--segment-h', `${item.offsetHeight}px`);
      if (indicator.dataset.active === undefined) { indicator.dataset.active = ''; frame = requestAnimationFrame(() => { indicator.dataset.ready = ''; }); }
    };
    place();
    const mutations = new MutationObserver(place);
    mutations.observe(group, { subtree: true, attributes: true, attributeFilter: ['aria-pressed', 'aria-selected', 'aria-current', 'checked'] });
    const sizes = new ResizeObserver(place); sizes.observe(group);
    group.addEventListener('change', place);
    return () => { cancelAnimationFrame(frame); mutations.disconnect(); sizes.disconnect(); group.removeEventListener('change', place); };
  }, []);
  return <span ref={ref} className="segment-indicator" aria-hidden="true" />;
}
