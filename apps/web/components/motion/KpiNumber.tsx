'use client';

import { useState } from 'react';
import CountUp from './bits/CountUp';
import { AnimatedNumber } from './AnimatedNumber';

/** A big KPI figure. Its first value counts up once (React Bits CountUp, ./bits); later changes roll with
 * AnimatedNumber, whose DOM text is always the real value. */
export function KpiNumber({ value, format }: { value: number; format?: (value: number) => string }) {
  const [first] = useState(value);
  const [changed, setChanged] = useState(false);
  if (value !== first && !changed) setChanged(true);
  if (!changed && !format) return <CountUp to={value} duration={0.8} trigger="load" />;
  return <AnimatedNumber value={value} format={format} />;
}
