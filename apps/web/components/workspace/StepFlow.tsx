'use client';

import Link from 'next/link';
import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { Icon } from '../Icon';
import { motion } from 'motion/react';
import { glide } from '../motion/presets';

/* The casting workspace flow: one visible, numbered step bar under the workspace header, and the same
   "Back / Continue to …" footer at the end of every step's panel. Link names stay "<n> <Step> <status>". */

export interface FlowStep { path: string; label: string; href: string; status?: { text: string; tone: 'warn' | 'muted' | 'ok' } }

export function StepBar({ steps, current }: { steps: FlowStep[]; current: string }) {
  const list = useRef<HTMLOListElement>(null);
  const index = steps.findIndex(step => step.path === current);
  // Narrow screens scroll the bar; keep the current step in view without moving the page.
  useLayoutEffect(() => {
    const root = list.current; const active = root?.querySelector<HTMLElement>('[aria-current="step"]');
    if (!root || !active || root.scrollWidth <= root.clientWidth) return;
    const left = active.offsetLeft - root.offsetLeft;
    if (left < root.scrollLeft || left + active.offsetWidth > root.scrollLeft + root.clientWidth) root.scrollLeft = Math.max(0, left - 24);
  }, [current]);
  return <nav className="workspace-steps" aria-label="Casting workspace steps">
    <ol ref={list}>{steps.map((step, position) => <li key={step.path} data-state={position < index ? 'before' : position === index ? 'current' : 'after'}>
      <Link className="step-link" href={step.href} aria-current={position === index ? 'step' : undefined}>
        {position === index && <motion.span layoutId="workspace-step-current" className="step-current" transition={glide} aria-hidden="true" />}
        <span className="step-number">{position + 1}</span>{' '}<span className="step-name">{step.label}</span>
        {step.status && <>{' '}<span className={`step-status step-status-${step.status.tone}`}>{step.status.text}</span></>}
      </Link>
    </li>)}</ol>
  </nav>;
}

/** End of a step: back to the previous step, an optional note or secondary action, then "Continue to …". */
export function StepFooter({ back, next, children, placement = 'sticky' }: { back?: { href: string; label: string }; next?: { href: string; label: string; quiet?: boolean };
  children?: ReactNode; placement?: 'sticky' | 'panel' }) {
  const content = <>
    {children && <div className="step-footer-extra">{children}</div>}
    {back && <Link className="icon-button workspace-back" href={back.href} aria-label={`Back to ${back.label}`} data-tip={`Back to ${back.label}`} data-tip-side="start" data-tip-pos="top"><Icon name="chevron-left" /></Link>}
    {next && <Link className={`button step-next${next.quiet ? '' : ' button-primary'}`} href={next.href}>Continue to {next.label}<Icon name="arrow" /></Link>}
  </>;
  return placement === 'sticky' ? <footer className="sticky-bar workspace-continue step-footer">{content}</footer> : <div className="step-footer">{content}</div>;
}
