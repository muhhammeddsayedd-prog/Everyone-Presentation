import type { CandidateFacts } from '@eps/domain';

// What a Cast Library card shows: the facts a casting team scans for (age, gender, city, then type, height and
// languages), and only those that were provided. Long generated casting IDs (archive imports) stay on the profile.

/** A casting ID worth showing on a card: short, human-assigned ones such as "EPS-1042". */
export function cardCastingId(value: string | null): string | null {
  const id = value?.trim();
  if (!id || id.length > 16 || /^EPS-[0-9A-F]{16,}$/iu.test(id)) return null;
  return id;
}

/** "Age 18-24, Age 25-34" reads as "Age 18–24, 25–34". */
export function cardAge(value: string | null): string | null {
  const text = value?.trim(); if (!text) return null;
  const parts = text.split(/\s*,\s*/u).filter(Boolean);
  if (parts.length > 1 && parts.every(part => /^Age\s/iu.test(part))) return `Age ${parts.map(part => part.replace(/^Age\s+/iu, '').replace(/(\d)-(\d)/gu, '$1–$2')).join(', ')}`;
  return text.replace(/(\d)-(\d)/gu, '$1–$2');
}

export function cardLines(facts: CandidateFacts): { primary: string; secondary: string } {
  const primary = [cardAge(facts.age_or_range), facts.stated_gender?.trim(), facts.city?.trim()].filter(Boolean).join(' · ');
  const secondary = [facts.classification?.trim(), facts.height_measurements?.trim(), facts.languages.filter(Boolean).join(', ')].filter(Boolean).join(' · ');
  return { primary, secondary };
}
