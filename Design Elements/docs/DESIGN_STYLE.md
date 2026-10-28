# Brand style guide — everyone. (as applied to Market Radar)

Extracted from **www.everyone.film** on 17 Oct 2026: computed styles, CSS custom properties, `@font-face` rules and screenshots of `/`, `/by-everyone`, `/about-everyone` and `/were-everyone`. This file describes the brand. `DESIGN.md` turns it into the app's UI system, and the token file is `assets/brand/tokens.css` (with a JSON copy in `tokens.json`).

---

## 1. Brand essence

everyone. is a production house built for the Arab world's biggest markets, with offices in Cairo, Riyadh and Dubai. The brand is **cinematic, confident and quiet**. The site is a black stage: the work fills the frame, the type is small and exact, and one green appears only where something matters.

Lines the brand uses, quoted from the site:
- "Everyone's story, told the way it should be." (home hero)
- "If it's not everyone— it's no one." (about)
- "great work meets great experience." (by everyone / work)
- "Built for this region. Made for every market in it." (about)
- "Our clients come to us for the work. They come back for the experience."

What this means for Market Radar:

| Brand trait | In the app |
|---|---|
| The work leads | Thumbnails and logos carry each screen. Text supports them. |
| Black stage | Dark theme by default, true black background, hairline borders. |
| Quiet confidence | Short labels, no exclamation marks, no hype, no emoji. |
| One accent | Green `#00cd6d` is used only for state and action: active item, primary action, focus, "new", positive change. |
| Regional pride | Arabic content looks as good as English. EG, KSA and UAE are equal first-class filters. |

## 2. Voice and tone

The site's own copy is short, plain and assured. It speaks in the first person plural ("We're masters at making everything look seamless") and avoids jargon. The app keeps that voice but is more factual, because it is a tool.

Principles:
1. **Say what happened.** "12 new campaigns this week", not "Exciting new activity!"
2. **Short first.** Labels are 1 to 3 words, sentences under 20 words.
3. **Name things the industry's way:** TVC, brand film, DOP, line producer, agency, client.
4. **Calm about failures.** State the problem and the next step: "Instagram run failed for 3 accounts. Retrying at 14:00."
5. **Lowercase brand name.** Write "everyone." with the period in brand moments (login, wordmark). In running text, "Everyone Films" is fine.

| Situation | Do | Don't |
|---|---|---|
| Empty feed | "Nothing new yet today. Last check 08:12." | "Oops! Looks like there's nothing here 😢" |
| Login | "Sign in with your everyone. Google account." | "Welcome to the ultimate market intelligence platform!" |
| No access | "Your account isn't on the invite list yet. Ask Mohamed to add you." | "Access denied. Error 403." |
| Low confidence | "Brand unclear — needs review" | "AI failed" |
| Review approved | "Saved. Vodafone Egypt is now linked to 4 items." | "Success!!!" |
| Run failure | "Vimeo: 2 accounts failed (rate limit). Next try 06:00." | "Something went wrong" |
| Big launch alert subject | "New TVC: Samsung × Wegz — Good People (KSA)" | "🚨 HUGE LAUNCH ALERT 🚨" |
| Brief headline | "Ramadan shoots started early in KSA" | "You won't believe what competitors did this week" |
| Destructive confirm | "Pause tracking for Lobster Films? Daily checks stop until you resume." | "Are you sure???" |

## 3. Logo

| Asset | File | Use |
|---|---|---|
| Wordmark (vector) | `assets/brand/everyone-logotype.svg` (519×87, `fill="currentColor"`) | Sidebar, login, emails, favicon source |
| Wordmark on black (raster) | `assets/brand/everyone-wordmark-on-black.png` | Email headers and places where SVG isn't supported |
| Menu mark (three vertical dots) | `assets/brand/everyone-menu-dots.svg` | The site's menu button, reused as the mobile menu button and the app icon |

The wordmark is a lowercase, heavy, italic "everyone." with a round period. The period is part of the name: never drop it.

Rules:
- **Colour:** white on black or dark surfaces, black on white or light surfaces. Green `#00cd6d` on black is allowed only on the login screen and in empty-state illustrations. Never use gradients, outlines, shadows, or any other colour.
- **Clear space:** at least the height of the period dot on every side, which is about 0.32 × the wordmark height.
- **Minimum size:** 72 px wide on screen (sidebar collapsed uses the dots mark instead), 20 mm in print.
- **Product lockup:** wordmark + "Market Radar" in General Sans Medium, at the wordmark x-height, in `--color-text-secondary`, separated by 8 px. Example: `everyone.  Market Radar`.
- **Don't:** stretch, rotate, re-type the wordmark in a font, change the period, or put it on a busy image without a scrim.
- **Favicon/app icon:** the three-dot mark, white on a black rounded square (radius 22%).

## 4. Colour

### 4.1 Brand palette (measured from the site CSS)

| Token (site) | Hex | Role on the site |
|---|---|---|
| black | `#000000` | Page background |
| white | `#ffffff` | Body text, titles, emails, addresses |
| `--gray` | `#7d7f82` | Uppercase micro-labels ("JOIN OUR TEAM"), display statements before they reveal to white |
| `--medium-gray` | `#c4c4c4` | Secondary UI |
| `--light-gray` | `rgba(245,245,245,.5)` | Frosted label chips laid over video and thumbnails, 8 px radius |
| `--light-green` | `#00cd6d` | Accent: highlighted "Everyone Films", video progress bars |
| `--medium-green` | `#00b460` | Accent hover |
| `--green` | `#176e45` | Deep green: the scribbles behind the hero wordmark |

### 4.2 Contrast (WCAG 2.x, computed)

Dark backgrounds: `bg #000`, `s1 #0b0b0c`, `s2 #141416`, `s3 #1c1c1f`. AA needs 4.5:1 for normal text, 3:1 for large text (≥ 24 px, or ≥ 18.66 px bold) and for UI parts.

| Foreground | on bg | on s1 | on s2 | on s3 | Verdict |
|---|---|---|---|---|---|
| white `#ffffff` | 21.0 | 19.7 | 18.4 | 17.0 | AAA everywhere |
| medium gray `#c4c4c4` | 12.0 | 11.3 | 10.6 | 9.8 | AAA everywhere |
| muted `#8e9094` (app) | 6.6 | 6.2 | 5.8 | 5.3 | AA everywhere. Use for meta text. |
| brand gray `#7d7f82` | 5.2 | 4.9 | 4.6 | **4.2** | AA on bg/s1/s2 only. **Fails on s3.** Labels only. |
| light green `#00cd6d` | 9.95 | 9.3 | 8.7 | 8.1 | AAA. Fine for accent text and icons. |
| medium green `#00b460` | 7.7 | 7.2 | 6.7 | 6.2 | AA+ |
| deep green `#176e45` | **3.35** | 3.1 | 2.9 | 2.7 | **Fails as text.** Fills only. |
| black on `#00cd6d` | 9.95 | | | | Primary button text |
| black on `#00b460` | 7.7 | | | | Primary button hover |
| white on `#176e45` | 6.3 | | | | Deep-green badge text |
| warning `#f5b544` | 11.6 | | | 9.4 | AA |
| danger `#ff6b6b` | 7.6 | | | 6.1 | AA |
| info `#5aa9ff` | 8.6 | | | 6.9 | AA |

**Glass chips.** The site's 50 % glass over black blends to `#7a7a7a`. White text on that is only 4.3:1, and white over a bright image drops to 2.9:1. The app therefore uses **black text on a 72 % glass chip** (`rgba(245,245,245,.72)` + 12 px blur), which gives about 9.6:1 over black and stays above 7:1 over mid-tone images. Titles written straight onto images always sit on a bottom scrim gradient (`--color-scrim`).

Light theme (on `#ffffff`):
- **Passes:** black 21:1, `#3d3f42` 10.6:1, `#626468` 5.9:1, deep green `#176e45` 6.3:1 (the light-theme accent text).
- **Fails:** brand gray `#7d7f82` 4.0:1, `#00cd6d` 2.1:1 and `#00b460` 2.7:1 as text. In the light theme the bright greens are used only as fills under black text.

## 5. Typography

| Family | Source | License | Use |
|---|---|---|---|
| **General Sans** (Medium 500, Semibold 600, Bold Italic 700) | Fontshare (Indian Type Foundry), the same files the site serves from `/fonts/GeneralSans-*.woff2` | ITF Free Font License: free for personal and commercial use. Self-host the woff2 files; don't hot-link the site. | Everything Latin |
| **IBM Plex Sans Arabic** (400, 500, 600) | Google Fonts / IBM | SIL OFL 1.1 | Arabic text. Its proportions sit well next to General Sans. |

Measured on the site:

| Role | Font | Size / line height | Tracking | Colour |
|---|---|---|---|---|
| Display statement ("If it's not everyone— it's no one.") | General Sans Semibold | about 68 px / 74 px (fluid) | normal | gray `#7d7f82`, revealing to white on scroll |
| Body statement (about copy) | General Sans Medium | about 32 px / 32 px | normal | white; brand name in `#00cd6d` |
| Wordmark-style section names ("by", "about", "we're") | General Sans Bold Italic | 36–49 px / 1.15 | −1 to −1.5 px | white |
| Project title on imagery | General Sans Medium | 22 px / 24.2 px | normal | white on scrim (or black on a glass chip) |
| Micro-label ("JOIN OUR TEAM", "CAIRO BRANCH") | General Sans Medium, UPPERCASE | 14 px / 16.8 px | 0.14 px | gray `#7d7f82` |
| CTA ("EXPLORE OUR WORK") | General Sans Medium, UPPERCASE | 14 px | 0.14 px | white |
| Body / addresses | General Sans Medium | 14 px / 18.2 px | normal | white |

The whole site uses weight 500 for body text, so Medium is the regular weight. Use Semibold for emphasis, never a "Bold" roman weight. Use Bold Italic only for wordmark-style labels, for example section names on brief pages.

## 6. Imagery

- **Video first, cinematic:** full-bleed stills from real work, with no stock photography, illustration packs or 3D blobs.
- **Show thumbnails at their true aspect ratio** (16:9 film, 4:5 or 9:16 social) with `object-fit: cover` and an 8 px radius.
- **Titles sit bottom-left**, on a scrim or a glass chip, as on the site's project grid.
- **Logos** of competitors and brands sit on neutral tiles (dark tile for white logos, light tile for dark logos). Never recolour third-party logos.
- **Image errors:** if a thumbnail is missing, show a `surface-2` tile with the platform icon and the competitor initials. Never use a broken-image icon.

## 7. Layout patterns from the site

- A black page with a white rounded-square **menu button showing three vertical dots** at the top left (40 × 40, radius 8).
- A **two-column image grid alternating with a full-width hero card**: two half cards, then one wide card, repeated (`/by-everyone`).
- **GRID / LIST toggle pills** in the top right of the work page: a small pill switch plus an uppercase micro-label.
- A **footer pattern** of micro-label + value pairs in a four-column grid: JOIN OUR TEAM / hello@everyone.film, CAREERS, CAIRO BRANCH, RIYADH BRANCH, UAE BRANCH, FIND US with social icons. The app reuses the label/value pattern in detail panels.
- Generous black space between sections (80 px or more on desktop), with tight spacing inside a group.

## 8. Motion

- **Subtle reveal.** Display statements fade from gray to white word by word on scroll. In the app this is used **only** on brief pages and the login hero.
- **Media cards:** thumbnails scale to 1.02 on hover over 320 ms, and the glass chip brightens.
- **No gimmicks:** no parallax, no bouncing, no confetti, no autoplaying video in the app (thumbnails only; video plays at the source).
- **Reduced motion:** respect `prefers-reduced-motion` everywhere. All durations drop to 0 and nothing reveals.

## 9. Iconography

- **lucide-react**, 1.5 px stroke, 16 px in dense UI and 20 px in navigation, with `currentColor`.
- **Platform marks** (Vimeo, Instagram, LinkedIn, YouTube) appear as small monochrome glyphs inside platform badges. Use the official simple-icons shapes; their colour comes from the platform tokens.
- **No filled multicolour icons** and no emoji in the UI.

## 10. Adapting the brand to a data-dense internal tool

| Website | Market Radar |
|---|---|
| A few big works per screen | Many items per screen: card grid (3–5 columns) or dense list |
| Text sizes 14–68 px | 12–32 px for UI; display sizes only on login and brief headers |
| No tables | Tables with hairline rows, `surface-2` header, tabular numerals |
| One accent used rarely | Same rule. Green marks only: active nav, primary button, focus ring, "new" dot, positive delta, the selected filter. Everything else is grayscale. |
| Dark only | **Dark by default**, plus an optional light theme (`data-theme="light"`, user toggle saved in localStorage and profile) for printing and daylight offices |
| Gray labels | Uppercase micro-labels at 12 px in the muted gray for field names and section kickers |
| Glass chips over video | Glass chips for the competitor name or format over thumbnails |

Never add a second accent colour for decoration. Charts are the one place where categorical colours appear (`DESIGN.md` §3.4).
