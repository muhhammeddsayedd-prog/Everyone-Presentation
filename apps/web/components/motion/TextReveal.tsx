'use client';

import { useLayoutEffect, useRef } from 'react';
import { DURATION, EASE, motionAllowed } from './motion';

/** Ported from React Bits BlurText / SplitText (MIT + Commons Clause). Words settle from soft to sharp once, on
 * mount. The words stay plain text with their spaces, so the heading reads exactly as before. Reserved for the
 * sign-in hero and the guest review title (Design Elements/docs/DESIGN_STYLE.md §8). */
export function TextReveal({ text }: { text: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    if (!ref.current || !motionAllowed()) return;
    [...ref.current.querySelectorAll('.reveal-word')].forEach((word, index) => word.animate(
      [{ opacity: 0.2, filter: 'blur(4px)', transform: 'translateY(4px)' }, { opacity: 1, filter: 'none', transform: 'none' }],
      { duration: DURATION.slow, delay: Math.min(index, 16) * 40, easing: EASE.enter, fill: 'backwards' }));
  }, [text]);
  return <span ref={ref} className="text-reveal">{text.split(/(\s+)/).map((word, index) => !word.trim() ? word : <span key={index} className="reveal-word">{word}</span>)}</span>;
}
