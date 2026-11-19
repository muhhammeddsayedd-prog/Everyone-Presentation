# Studio motion

Owner decision (2026-11-19): motion should be **expressive but purposeful**. Everything runs on the pinned `motion` package (motion.dev, `14.9.1`) plus a few vendored React Bits components. Durations mirror the tokens: `--duration-fast/base/slow` are 120/200/320 ms, eased with `--ease-standard`.

## Allowed

- Layout and shared-element transitions with Motion `layout` / `layoutId`: the nav pill, the step pill, segmented fills, cards moving between casting slots, and list reorders.
- Spring feedback: press scale (`presets.press`) and the drag lift on the casting board (`presets.lift`).
- Count-ups on KPI figures with `KpiNumber`, plus rolling values with `AnimatedNumber`.
- Staggered list entrances with `RevealList`/`RevealItem`, or the `stagger` callback ref in `motion.ts`.
- Fade and rise for panels and step content with `Reveal`, or `useReveal` in `motion.ts`.
- One hero text reveal per surface with `TextReveal` (React Bits BlurText). It is used only on the sign-in hero and the guest review title.
- Overlay entrances (in CSS, `styles/latest.css`) and exits (`useExitMotion` in `motion.ts`).

## Not allowed

- Confetti, parallax, cursor effects, WebGL backgrounds, autoplaying loops or decorative shimmer.
- Bounce on content. A small overshoot is fine only on a toggle knob or a toast.
- Animating `width`, `height`, `top` or `left` directly. Use Motion `layout` instead, which works by transform.
- Hiding content before script runs. Every entrance must start from rendered content.

## Rules

- **Accessible names never change.** Animated text keeps its real text in the DOM: BlurText renders a screen-reader copy, and `AnimatedNumber` keeps the real value as its only text. e2e specs select by role and name.
- **Reduced motion turns everything off.** `MotionRoot` sets `reducedMotion="user"` for Motion, `base.css` zeroes CSS durations, and `motionAllowed()` gates the Web Animations helpers.
- **Use `presets.ts`.** Don't invent new springs or durations. If a new one is needed, add it to `presets.ts` with a comment saying why.
- **One moving thing per interaction.** When a control changes, its own indicator moves. The page around it stays still.

## Files

| File | What it is |
|---|---|
| `presets.ts` | Durations, easings, springs (`glide`, `settle`), `press`, `lift`, and the `rise`, `list` and `listItem` variants |
| `MotionRoot.tsx` | The `MotionConfig` wrapper. Every app root (Studio, guest, OAuth) is wrapped in it |
| `Reveal.tsx` | `Reveal`, `RevealList` and `RevealItem`, built on Motion. The concept comes from React Bits FadeContent/AnimatedList, whose originals need GSAP or an icon pack |
| `TextReveal.tsx` | Hero reveal via `bits/BlurText` |
| `KpiNumber.tsx` | The first value counts up (`bits/CountUp`); later changes roll (`AnimatedNumber`) |
| `AnimatedNumber.tsx`, `SegmentIndicator.tsx`, `motion.ts` | Earlier Web Animations helpers. They are test-safe and still used |
| `bits/` | Vendored React Bits sources (MIT + Commons Clause), kept close to upstream. A scoped ESLint exception covers their ref pattern |
