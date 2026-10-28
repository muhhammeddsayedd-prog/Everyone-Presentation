# Font setup

The font specifications are included in this kit. **Font binaries and the font license files are not included.** The archived Market Radar app uses system fonts while its brand-font integration remains planned.

Read [the reusable guide](REUSE_GUIDE.md) and [the original typography specification](docs/DESIGN_STYLE.md#5-typography) before adding fonts to another app.

## Required files

These are the exact filenames referenced by [the canonical stylesheet](assets/brand/tokens.css). Filenames and letter case matter on case-sensitive hosting.

| Filename                           | Family               | Weight | Style  | Intended use                         |
| ---------------------------------- | -------------------- | ------ | ------ | ------------------------------------ |
| `GeneralSans-Medium.woff2`         | General Sans         | 500    | Normal | Latin body text, labels and controls |
| `GeneralSans-Semibold.woff2`       | General Sans         | 600    | Normal | Headings and emphasis                |
| `GeneralSans-BoldItalic.woff2`     | General Sans         | 700    | Italic | Wordmark-style section labels only   |
| `IBMPlexSansArabic-Regular.woff2`  | IBM Plex Sans Arabic | 400    | Normal | Arabic regular text where requested  |
| `IBMPlexSansArabic-Medium.woff2`   | IBM Plex Sans Arabic | 500    | Normal | Arabic body text and controls        |
| `IBMPlexSansArabic-SemiBold.woff2` | IBM Plex Sans Arabic | 600    | Normal | Arabic headings and emphasis         |

All six files are currently missing. No Roman Bold General Sans face is specified. The everyone. logo is supplied as artwork; do not recreate it by typing the name in a font.

## Acquire the fonts and retain their licenses

The original brand guide records General Sans as an Indian Type Foundry font distributed through Fontshare under the ITF Free Font License, and IBM Plex Sans Arabic as an IBM font under SIL Open Font License 1.1. These are source-document descriptions, not license texts bundled with this export or a fresh verification of provider terms.

1. Obtain General Sans from the official Fontshare/Indian Type Foundry distribution and IBM Plex Sans Arabic from an official IBM or Google Fonts distribution.
2. Read and retain the license and copyright files supplied with each downloaded package. Check that the intended use, self-hosting and any conversion or modification are permitted.
3. Confirm that the faces match the families, weights and styles above. Record the provider, acquisition date and checksums in the target project.
4. Use the matching WOFF2 files under the required filenames. If the distribution supplies different formats or names, choose and document a permitted integration; renaming a different face does not make it the required face.
5. Keep fonts and license files local to the target project. Do not hot-link the everyone. website.

## Integrate in the target app

The CSS fallback uses absolute URLs such as `/fonts/GeneralSans-Medium.woff2`. Put the six files in the target app's publicly served `/fonts/` directory, or adapt those URLs in a target-owned copy of the stylesheet. A filesystem folder beside this Markdown file will not automatically satisfy those public URLs.

For Next.js, the original specification prefers `next/font/local`. Use the target app's supported version and current official documentation, declare the same weights and styles, and connect its generated font families to the design tokens. Avoid loading the same files through both a framework loader and redundant CSS declarations. Other stacks can use the supplied `@font-face` declarations with the correct asset paths.

Use General Sans Medium as the default Latin UI weight and Semibold for headings. Keep Bold Italic restricted to the section-label role. The canonical `--font-sans` stack includes IBM Plex Sans Arabic, and its `@font-face` declarations limit those faces to Arabic Unicode ranges. Use `--font-arabic` for explicit Arabic blocks when appropriate.

Set the document language to the target interface language. Give source-content blocks `dir="auto"` and a known language, such as `lang="ar"`, so mixed Arabic and English content can render correctly. Allow extra Arabic line height as described in [DESIGN.md](DESIGN.md#4-typography).

Until the files are available, use an explicit system-font fallback and disclose that visual typography acceptance is pending. Loading token values alone does not prove that the intended fonts rendered.

## Verify after integration

- Confirm that every requested font file loads successfully in the target app and that computed styles use the intended face and weight.
- Check English, Arabic and mixed-direction examples, including names, dates, numerals and punctuation.
- Inspect wrapping, truncation, Arabic line height and layout shift at mobile and desktop widths.
- Confirm the target build includes the required license files and does not request fonts from the original everyone. website.

These are target-project checks. No font-loading or rendered brand-font acceptance is claimed by this package.
