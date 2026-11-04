/** Everyone Film editorial design tokens. Values are copied from the supplied
 * design kit (`design.md`, `template_tokens.json`); every unit is one native
 * 1920×1080 slide unit = one CSS px = 1/144 in in PowerPoint (fonts N → N/2 pt). */
export const DESIGN_SYSTEM_ID = 'everyone-film-editorial-presentation';
export const CANVAS = Object.freeze({ width: 1920, height: 1080 });
export const PPTX = Object.freeze({ widthInches: 13.3333333333, heightInches: 7.5, unitsPerInch: 144, fontUnitsPerPoint: 2 });

export const COLORS = Object.freeze({
  background: '#F1F1F1', ink: '#000000', note: '#FFFB00', fittingNote: '#FFFB0A',
  agendaMagenta: '#990071', dialogueBlue: '#0942A9',
});

/** General Sans hhea ascent 1010 + descent 240 = 1.25 em. The kit's measured
 * text bounds are these line boxes, so `top` below is the measured y0. */
export const LINE_HEIGHT = 1.25;
export const LATIN_FAMILY = 'General Sans';
/** Cover-title separator (design.md §6.2): the source draws a stem from baseline to
 * cap height, while General Sans Bold `|` spans −193…718 units. The authored `|` is
 * kept and drawn at 718/911 of the size, raised by its scaled descender (0.193 em). */
export const COVER_SEPARATOR = Object.freeze({ token: ' | ', scale: 718 / 911, raiseEm: 0.193 });
/** Geeza Pro is an Apple system font and cannot be bundled; the already pinned
 * IBM Plex Sans Arabic is the declared Arabic fallback. */
export const ARABIC_FAMILY = 'IBM Plex Sans Arabic';

export type Weight = 200 | 300 | 400 | 500 | 600 | 700;
export interface TextStyle { weight: Weight; size: number; color?: keyof typeof COLORS; lineHeight?: number; underline?: boolean }
export const TYPE = Object.freeze({
  coverTitle: { weight: 700, size: 54 }, coverDate: { weight: 300, size: 38 }, coverClient: { weight: 500, size: 38 },
  heading: { weight: 600, size: 74 }, subtitle: { weight: 300, size: 50 }, section: { weight: 600, size: 74 },
  closing: { weight: 700, size: 64 }, pageNumber: { weight: 200, size: 24 },
  castStatus: { weight: 400, size: 35 }, castName: { weight: 400, size: 35 },
  microLabel: { weight: 400, size: 24 }, caption: { weight: 300, size: 30 },
  agenda: { weight: 500, size: 74 }, agendaSlash: { weight: 500, size: 74, color: 'agendaMagenta' },
  stbNumber: { weight: 700, size: 33 }, stbAction: { weight: 400, size: 32 },
  scriptSpeaker: { weight: 400, size: 30 }, dialogue: { weight: 700, size: 32, color: 'dialogueBlue', lineHeight: 1.6 },
  noteSmallPrefix: { weight: 700, size: 24 }, noteSmall: { weight: 400, size: 24 },
  noteFittingPrefix: { weight: 700, size: 30 }, noteFitting: { weight: 300, size: 30 },
  notePpm: { weight: 700, size: 28 },
  // Application extensions for the existing ten-field candidate contract and
  // the original-video link; they reuse the kit's caption/micro-label scale.
  fieldLabel: { weight: 400, size: 24 }, fieldValue: { weight: 300, size: 30 },
  link: { weight: 400, size: 24, underline: true }, linkMissing: { weight: 300, size: 24 },
} satisfies Record<string, TextStyle>);
export type TypeStyle = keyof typeof TYPE;

/** PowerPoint and Keynote address General Sans weights by these legacy family names. */
export const PPTX_FACES: Record<Weight, { face: string; bold: boolean }> = {
  200: { face: 'General Sans Extralight', bold: false }, 300: { face: 'General Sans Light', bold: false },
  400: { face: 'General Sans', bold: false }, 500: { face: 'General Sans Medium', bold: false },
  600: { face: 'General Sans Semibold', bold: false }, 700: { face: 'General Sans', bold: true },
};

/** Measured anatomy (design.md §6, §7, §9). */
export const ANATOMY = Object.freeze({
  heading: { x: 34.1, top: 47.3 }, subtitle: { x: 34.1, top: 129.2 },
  pageNumber: { right: 1903, top: 1040.3 },
  section: { x: 36.3, top: 493.8 }, closing: { top: 499.2 },
  mediaZone: { x: 20, y: 200, width: 1880, height: 818 },
  notes: {
    small: { x: 17.8, top: 1030.2, height: 32 }, fitting: { x: 26.2, top: 1020.2, height: 40 }, ppm: { x: 14.4, top: 1028.8, height: 38 },
  },
  coverFloward: { everyone: [1525.3, 73.1, 329.2, 54.3], title: { x: 70.5, top: 284.8 }, dateGap: 4.4, noteGap: 16.7, client: [1452, 848, 402.5, 200] },
  coverPartners: { everyone: [1526.3, 46.7, 329.2, 54.3], title: { x: 69.1, top: 287.4 }, dateGap: 3.8, client: [48.5, 866.5, 363.4, 143.9], partner: [1629.3, 890.4, 226.2, 96] },
} as const);
