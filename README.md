# CDS Photography — Astro static site

A no-Ruby photography portfolio for GitHub Pages.

## Core model

- Originals live in `src/photos/`.
- Semantic metadata lives in `src/data/photos.json`.
- Photos can have multiple tags.
- `featured: true` selects photos for the moving homepage showcase.
- Width, height and aspect ratio are read automatically from the source image.

## Performance model

The source photograph is **not** used directly for ordinary homepage/gallery browsing.

Astro generates optimized WebP previews during the build:

- Gallery: responsive `srcset`, capped at the configured gallery preview width.
- Featured hero: capped desktop and mobile preview files.
- Off-screen gallery images: browser-native lazy loading.
- Individual viewer: preview first, then original source is fetched only after explicit user interaction.

The original file is never proactively prefetched for neighboring photographs.

See `START-HERE.md` for the beginner workflow.
