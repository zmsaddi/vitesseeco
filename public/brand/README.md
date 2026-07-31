# Vitesse ⚡ Eco — Brand Kit

The complete visual identity, decreed by the owner on 2026-07-31. Everything in
this folder is **generated** from three source ingredients — the stag path, the
spark path, and the wordmark outlined from Manrope ExtraBold — by
`scripts/build-brand-kit.mjs`. Never hand-edit a generated file; change the
generator and re-run.

The wordmark in every file is **outlined vector paths**: print shops and design
tools need no font installed. For *editable* text work, the typeface is
**Manrope** (free — Google Fonts, and available on Adobe Fonts), weight 800 for
the name, 600–700 for supporting lines.

---

## The palette — original core colours

### Forest — the brand's ground and its actions
| | HEX | HSL | CMYK | OKLCH |
|---|---|---|---|---|
| Light | `#428177` | hsl(171 32% 38%) | 76 32 54 10 | oklch(0.536 0.061 189.6) |
| **Deep** | `#054239` | hsl(171 86% 14%) | 89 49 70 50 | oklch(0.334 0.057 186.2) |
| Black | `#002623` | hsl(173 100% 7%) | 87 59 68 71 | oklch(0.208 0.038 184.5) |

### Golden Wheat — the stag's metal and the paper it lives on
| | HEX | HSL | CMYK | OKLCH |
|---|---|---|---|---|
| Light | `#edebe0` | hsl(49 26% 90%) | 6 9 19 0 | oklch(0.938 0.010 95.8) |
| Mid | `#b9a779` | hsl(43 32% 60%) | 20 29 52 7 | oklch(0.722 0.063 88.5) |
| Deep | `#988561` | hsl(40 22% 49%) | 39 46 67 20 | oklch(0.598 0.058 87.2) |

### Deep Umber — danger, sale, the rare dramatic accent
| | HEX | HSL | CMYK | OKLCH |
|---|---|---|---|---|
| Light | `#6b1f2a` | hsl(351 55% 27%) | 35 92 72 46 | oklch(0.354 0.108 20.7) |
| Deep | `#4a151e` | hsl(350 56% 19%) | 44 86 68 65 | oklch(0.279 0.083 19.5) |
| Black | `#260f14` | hsl(348 43% 10%) | 60 75 64 79 | oklch(0.183 0.039 18.2) |

### Charcoal — text and ink
| | HEX | HSL | CMYK | OKLCH |
|---|---|---|---|---|
| White | `#ffffff` | hsl(0 0% 100%) | 0 0 0 0 | oklch(1 0 0) |
| Mid | `#3d3a3b` | hsl(340 3% 24%) | 67 53 60 50 | oklch(0.344 0.005 348.0) |
| Black | `#161616` | hsl(0 0% 9%) | 73 67 65 80 | oklch(0.185 0 0) |

### The electric spark — the one colour outside the palette
`#31C6FF → #0077FF`, gradient, **bolts only**. It signals "electric" and is
never used for surfaces, text or actions.

### Sanctioned derived tints
Functional derivatives of palette colours, documented so nothing drifts:
`#8CC5B9` (Forest tint — "Eco" on dark grounds, ~5:1), plus the light washes
and borders derived in the site's token file. Derivatives serve washes and
contrast; they never replace a family colour in a leading role.

**Roles, in one line each:** Forest acts (buttons, links, focus). Wheat is
identity (the stag, paper, premium surfaces). Umber alarms (errors, sale).
Charcoal speaks (text). The spark electrifies (the bolt, nothing else).

---

## Files

| File | Use |
|---|---|
| `palette.svg` | The swatch sheet above, visual |
| `logo-primary.svg` | THE lockup, light grounds — invoices, web, documents |
| `logo-primary-dark.svg` | The lockup on Forest black — dark grounds |
| `logo-stacked.svg` | Square composition — social profiles, print squares |
| `stag-gold / gold-deep / forest / charcoal / cream / white .svg` | The mark alone, one colour each |
| `stag-symbol.svg` | Web-only `<symbol>`, inherits `currentColor` |
| `bolt.svg` | The spark alone |
| `tile-forest.svg` · `tile-forest-black.svg` | App icons — the two approved tiles |
| `avatar-circle.svg` | Round avatar — WhatsApp, social |
| `card-dark.svg` | Wide dark lockup card |
| `business-card-front/back.svg` | 85×55 mm at 10 px/mm — replace the placeholders |
| `invoice-header.svg` | A4-width letterhead band |
| `invoice-stamp.svg` | The roundel — documents, packaging, stickers |
| `social-cover.svg` | 1500×500 — Facebook/X/LinkedIn covers |
| `social-post-square.svg` | 1080×1080 campaign template |
| `story-template.svg` | 1080×1920 story/reel frame — brand elements clear of platform UI bands |
| `brochure-outer.svg` · `brochure-inner.svg` | DL **roll-fold** (flap 2 mm narrower); dashed lines = fold guides |
| `email-signature.svg` | Compact signature block |

## Rules that keep it an identity

1. The name is written **Vitesse Eco** — two words. In lockups, the spark
   replaces the space; in prose, the space stays.
2. The stag is gold on light and dark grounds (`mid` on dark, `deep` on light);
   Forest deep or Charcoal only where gold cannot print.
3. Never stretch, outline, shadow or rotate the mark. Clear space around the
   lockup = the height of the "V".
4. The spark never appears twice in one composition.
5. Minimum sizes: lockup 24 px tall on screen; mark alone 16 px.
