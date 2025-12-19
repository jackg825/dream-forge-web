# Style Preview Images

This directory contains preview images for the 4 figure styles.

> **Note**: Current images are placeholder examples.
> Replace with actual generated 3D model examples for production.

## Required Images

Each style needs 6 preview images:

```
styles/
├── bobblehead/
│   ├── preview-1.webp
│   ├── preview-2.webp
│   ├── preview-3.webp
│   ├── preview-4.webp
│   ├── preview-5.webp
│   └── preview-6.webp
├── chibi/
│   └── (same structure)
├── cartoon/
│   └── (same structure)
└── emoji/
    └── (same structure)
```

## Image Specifications

- **Format**: WebP (optimized)
- **Size**: 400x400px (square)
- **File size**: <20KB each (typically 6-12KB)
- **Content**: Example 3D models generated with each style

## Style Characteristics

| Style | Head Ratio | Key Features |
|-------|-----------|--------------|
| Bobblehead | 3-4x body | Oversized head, spring neck, vinyl finish |
| Chibi | 2-3x body | Anime-style, big eyes, stubby limbs |
| Cartoon | 1.5-2x body | Pixar/Disney style, expressive |
| Emoji | Head=body | Spherical, minimalist, 3-4 colors |

## Conversion Script

To convert new images to optimized WebP format:

```bash
cd app && node scripts/convert-style-images.mjs
```

This will resize images to 400x400px and convert to WebP with quality 85.
