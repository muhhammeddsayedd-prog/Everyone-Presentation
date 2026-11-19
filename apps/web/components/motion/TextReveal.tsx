'use client';

import BlurText from './bits/BlurText';

/** Hero text reveal (React Bits BlurText, vendored in ./bits). Words settle from soft to sharp once, on mount.
 * The full text stays in the DOM as screen-reader text, so headings keep their accessible name.
 * Reserved for the sign-in hero and the guest review title. */
export function TextReveal({ text }: { text: string }) {
  return <BlurText as="span" className="text-reveal" text={text} animateBy="words" direction="bottom" trigger="load" delay={40} stepDuration={0.32} />;
}
