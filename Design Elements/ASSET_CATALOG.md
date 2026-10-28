# Asset catalog

This kit copies the existing local brand files. Their original design context is [the brand guide](docs/DESIGN_STYLE.md); integration guidance is in [REUSE_GUIDE.md](REUSE_GUIDE.md). Dimensions below describe the files, not recommended display sizes.

## Included brand files

| File                                                                          | Format | Dimensions       | Bytes  | Purpose                                                                                  |
| ----------------------------------------------------------------------------- | ------ | ---------------- | ------ | ---------------------------------------------------------------------------------------- |
| [everyone-logotype.svg](assets/brand/everyone-logotype.svg)                   | SVG    | 519 × 87 viewBox | 3,803  | Vector everyone. wordmark                                                                |
| [everyone-menu-dots.svg](assets/brand/everyone-menu-dots.svg)                 | SVG    | 37 × 37 viewBox  | 303    | Three vertical dots; menu mark and app-icon source                                       |
| [everyone-wordmark-on-black.png](assets/brand/everyone-wordmark-on-black.png) | PNG    | 447 × 447 pixels | 31,749 | Existing raster wordmark on a black canvas                                               |
| [tokens.css](assets/brand/tokens.css)                                         | CSS    | Not applicable   | 12,077 | Canonical dark tokens, light overrides, font declarations and commented Tailwind mapping |
| [tokens.json](assets/brand/tokens.json)                                       | JSON   | Not applicable   | 8,724  | Grouped mirror of the CSS custom-property values                                         |

The PNG has a square canvas. Preserve its aspect ratio; it is not a tightly cropped 519:87 substitute for the vector wordmark. Preview its black canvas in the target placement before using it as an email header or in a light interface.

The JSON uses this project's grouped format. It is not claimed to conform to a standard token interchange schema. The CSS and JSON are source values; they do not supply finished components.

## Logo use and SVG color

- Keep the lowercase name and its period, the original proportions and clear space of at least 0.32 times the wordmark height. The original screen minimum is 72 pixels wide.
- Use white on dark surfaces and black on light surfaces. Preserve the original guide's narrow green-logo exceptions for login and empty-state artwork; do not apply green as a general logo treatment.
- Both SVG files use `fill="currentColor"`. When SVG is inline, `currentColor` follows the element's CSS `color`. When the SVG is loaded through an external image element or CSS image, the surrounding page's text color does not recolor it; its default rendering is black.
- The archived Market Radar placeholder makes the external wordmark white with `filter: brightness(0) invert(1)`. That is a dark-surface treatment, not an automatic light/dark theme solution. Choose a target-appropriate rendering method and verify both themes without changing the supplied artwork.
- Use `alt="everyone."` when the wordmark conveys the brand. Use an accessible name on a menu control; a decorative dots glyph inside an already labelled button does not need a second spoken name.
- Do not stretch, rotate, retype, outline or decorate the wordmark. Do not recolor third-party logos.

The dots SVG is source artwork. A finished favicon set, app-icon set and rounded-square icon background are not included.

## Historical screenshots

These files come from the M00 branded-placeholder evidence recorded on 17 October 2026. They show a placeholder with system fonts, a wordmark, a product label and a footer. They are historical references, not current runtime checks or evidence of completed app screens and components.

| Reference file                                                   | Encoded image dimensions | Bytes  |
| ---------------------------------------------------------------- | ------------------------ | ------ |
| [web-desktop.png](reference/screenshots/web-desktop.png)         | 1440 × 900 pixels        | 15,091 |
| [web-dev-desktop.png](reference/screenshots/web-dev-desktop.png) | 1440 × 900 pixels        | 15,091 |
| [web-laptop.png](reference/screenshots/web-laptop.png)           | 1024 × 768 pixels        | 13,035 |
| [web-mobile.png](reference/screenshots/web-mobile.png)           | 960 × 2100 pixels        | 37,280 |
| [web-tablet.png](reference/screenshots/web-tablet.png)           | 768 × 1024 pixels        | 13,444 |

Encoded image pixels can differ from CSS viewport pixels because of device pixel ratio. In particular, the mobile image dimensions do not imply a 960-pixel-wide mobile layout. See the archived [Playwright configuration](reference/market-radar/apps/web/playwright.config.ts) for the original viewport definitions.

The brand guide describes a historical extraction from the everyone. website. This export does not contain those original website screenshots; the images listed here are app-placeholder captures.

## Available implementation references

The sources under [reference/market-radar/apps/web](reference/market-radar/apps/web/) are an implementation reference for the existing placeholder. Its stylesheet maps Tailwind to tokens but intentionally uses system fonts. The copies do not form a standalone app or a reusable component package.

The complete [DESIGN.md](DESIGN.md) specifies components, app screens and email layouts. Those specifications should not be mistaken for implemented source.

## Elements still to supply or implement

- The six font binaries and their license texts listed in [FONT_SETUP.md](FONT_SETUP.md).
- Finished primitives and components: buttons, chips, fields, menus, dialogs, tables, charts, cards, navigation and their interactive states. See [COMPONENTS.md](COMPONENTS.md).
- Official platform glyphs and an installed icon dependency. The source specification names Lucide and Simple Icons, but no platform SVG collection or ready-to-use icon library is bundled here.
- Finished favicon/app-icon exports, email HTML and a design-tool source file.
- Target-app content, thumbnails and any third-party logos. Use appropriate real assets and permissions; the kit supplies no media library or stock imagery.

No new assets, fonts or external media were downloaded to create this catalog.
