# START HERE — CDS Photography

No Ruby. No HTML editing for normal photo updates.

## Run the site locally

Open PowerShell in this folder:

```powershell
npm install
npm run dev
```

Open the address Astro prints, normally:

`http://localhost:4321/`

After the first install, normal use is only:

```powershell
npm run dev
```

## 1. Add photographs

Put image files anywhere inside:

`src/photos/`

Folders are only for your own organization. They are **not tags**.

Examples:

- `src/photos/yellowstone/bear-at-sunset.jpg`
- `src/photos/colorado/milky-way.jpg`
- `src/photos/panoramas/dunes.jpg`

## 2. Add tags / featured status

Edit:

`src/data/photos.json`

Example:

```json
{
  "yellowstone/bear-at-sunset.jpg": {
    "title": "Bear at Sunset",
    "tags": ["Wildlife", "Landscape", "Golden Hour"],
    "featured": true,
    "featuredOrder": 1,
    "location": "Yellowstone National Park",
    "year": 2026
  }
}
```

A photograph can have any number of tags. `featured: true` puts it in the moving showcase.

## 3. Large photographs are handled automatically

Keep your original photograph in `src/photos/`. Do **not** make thumbnails yourself.

At build time Astro creates smaller WebP previews automatically.

Normal browsing does NOT request the full-resolution file:

- gallery cards use responsive previews capped at about **1200 px wide**
- the full-screen featured showcase uses a preview capped at about **1600 px**
- phones use an even smaller featured preview capped at about **960 px**
- photos below the visible part of the gallery are lazy-loaded

When somebody clicks a photograph, the viewer opens instantly using the preview and then downloads the **original full-resolution image**. When the original finishes loading, it replaces the preview.

The site never preloads the full-resolution version of the next photograph. Full resolution is fetched only for a photograph the visitor explicitly opens.

This means a 6000×4000 or 4K original can stay in your collection without forcing homepage visitors to download it.

### Optional performance settings

In `src/data/site.json` you can change:

- `galleryPreviewMaxWidth` — default `1200`
- `heroPreviewMaxWidth` — default `1600`
- `heroMobilePreviewMaxWidth` — default `960`
- `previewQuality` — default `74`

You normally do not need to touch these.

## 4. Dimensions and aspect ratios are automatic

Do not enter width, height, resolution, or aspect ratio. Astro reads those from the source image.

The site keeps the natural composition of 4:3, 16:9, portrait, panorama, 32:9, etc. A small 640×480 source is never intentionally upscaled into a larger preview.

## Optional photo metadata

Each entry in `src/data/photos.json` may contain:

- `title`
- `tags`
- `featured`
- `featuredOrder`
- `location`
- `year`
- `date`
- `description`
- `alt`
- `hidden`

Only the image itself is mandatory.
