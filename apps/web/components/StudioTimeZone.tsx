'use client';

import { createContext, useContext, type ReactNode } from 'react';
import { DEFAULT_STUDIO_TIME_ZONE, formatStudioDate, formatStudioDateTime, studioTimeZone } from '../lib/studio-time-zone';

export const StudioTimeZone = createContext(DEFAULT_STUDIO_TIME_ZONE);
export function StudioTimeZoneProvider({ timeZone, children }: { timeZone?: string; children?: ReactNode }) {
  return <StudioTimeZone.Provider value={studioTimeZone(timeZone)}>{children}</StudioTimeZone.Provider>;
}
export function StudioDateTime({ value, dateOnly = false, prefix = '', className }: { value: string; dateOnly?: boolean; prefix?: string; className?: string }) {
  const timeZone = useContext(StudioTimeZone);
  return <time dateTime={value} title={timeZone} className={className}>{prefix}{dateOnly ? formatStudioDate(value, timeZone) : formatStudioDateTime(value, timeZone)}</time>;
}
