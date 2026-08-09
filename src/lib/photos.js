import { getImage } from 'astro:assets';
import metadata from '../data/photos.json';
import site from '../data/site.json';

// Every local image imported from src/photos carries Astro ImageMetadata:
// { src, width, height, format }. Folder names do NOT define tags.
const modules = import.meta.glob(
  '../photos/**/*.{jpg,jpeg,png,webp,avif,JPG,JPEG,PNG,WEBP,AVIF}',
  { eager: true, import: 'default' }
);

const GALLERY_MAX = Math.max(480, Number(site.galleryPreviewMaxWidth) || 1200);
const HERO_MAX = Math.max(960, Number(site.heroPreviewMaxWidth) || 1600);
const HERO_MOBILE_MAX = Math.min(HERO_MAX, Math.max(640, Number(site.heroMobilePreviewMaxWidth) || 960));
const PREVIEW_QUALITY = Math.min(90, Math.max(45, Number(site.previewQuality) || 74));

function humanize(value = '') {
  return String(value)
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function cleanPath(modulePath) {
  return modulePath.replace(/^\.\.\/photos\//, '').replace(/\\/g, '/');
}

function shapeFrom(width, height) {
  const ratio = width > 0 && height > 0 ? width / height : 1;
  if (ratio >= 2.5) return 'ultrawide';
  if (ratio >= 1.8) return 'panorama';
  if (ratio <= 0.78) return 'portrait';
  if (ratio <= 1.12) return 'squareish';
  return 'standard';
}

function technicalLabel(width, height) {
  if (!width || !height) return '';
  const ratio = width / height;
  if (ratio >= 2.5) return 'Ultra-wide';
  if (ratio >= 1.8) return 'Panorama';
  if (ratio <= 0.78) return 'Vertical';
  if (ratio <= 1.12) return 'Near-square';
  return 'Horizontal';
}

function responsiveWidths(sourceWidth, maxWidth) {
  const cap = Math.min(sourceWidth || maxWidth, maxWidth);
  const candidates = [320, 480, 640, 800, 960, 1200, cap]
    .filter((value) => Number.isFinite(value) && value > 0 && value <= cap);
  if (sourceWidth > 0 && sourceWidth < maxWidth) candidates.push(sourceWidth);
  return [...new Set(candidates)].sort((a, b) => a - b);
}

async function optimizedSingle(image, sourceWidth, requestedWidth, quality = PREVIEW_QUALITY) {
  const width = Math.max(1, Math.min(sourceWidth || requestedWidth, requestedWidth));
  const result = await getImage({ src: image, width, format: 'webp', quality });
  return result.src;
}

async function buildPhoto([modulePath, image]) {
  const path = cleanPath(modulePath);
  const info = metadata[path] || {};
  const width = Number(image?.width) || 0;
  const height = Number(image?.height) || 0;
  const tags = Array.isArray(info.tags)
    ? [...new Set(info.tags.map(humanize).filter(Boolean))]
    : [];

  // Homepage/gallery images are intentionally capped. The original file is
  // preserved separately and is only requested by the browser after a user
  // opens that photograph in the full-resolution viewer.
  const previewWidths = responsiveWidths(width, GALLERY_MAX);
  const preview = await getImage({
    src: image,
    widths: previewWidths,
    sizes: '(max-width: 620px) 100vw, (max-width: 980px) 60vw, 42vw',
    format: 'webp',
    quality: PREVIEW_QUALITY,
  });

  const [heroSrc, heroMobileSrc] = await Promise.all([
    optimizedSingle(image, width, HERO_MAX, Math.min(86, PREVIEW_QUALITY + 4)),
    optimizedSingle(image, width, HERO_MOBILE_MAX, Math.min(84, PREVIEW_QUALITY + 2)),
  ]);

  // A dedicated per-photo social-preview image (standard 1200x630 card size,
  // JPG for the widest crawler/app compatibility). Used by the photo's own
  // static share page so link previews show that actual photograph, not a
  // single site-wide image.
  const ogImage = await getImage({
    src: image,
    width: 1200,
    height: 630,
    fit: 'cover',
    format: 'jpg',
    quality: 82,
  });

  return {
    path,
    slug: path.replace(/\.[^.]+$/, '').replace(/\//g, '--'),
    ogImageSrc: ogImage.src,
    previewSrc: preview.src,
    previewSrcSet: preview.srcSet?.attribute || '',
    heroSrc,
    heroMobileSrc,
    originalSrc: image?.src || preview.src,
    width,
    height,
    format: image?.format || '',
    aspectRatio: width && height ? width / height : 1,
    shape: shapeFrom(width, height),
    technicalLabel: technicalLabel(width, height),
    title: info.title || humanize(path.split('/').pop()?.replace(/\.[^.]+$/, '') || 'Untitled'),
    alt: info.alt || '',
    location: info.location || '',
    year: info.year ? String(info.year) : '',
    date: info.date || '',
    description: info.description || '',
    tags,
    featured: info.featured === true,
    featuredOrder: Number.isFinite(Number(info.featuredOrder)) ? Number(info.featuredOrder) : 999999,
    // Gallery display order (lower = earlier). Curate this in photos.json to lead
    // with your strongest work; photos without an `order` fall to the end.
    order: Number.isFinite(Number(info.order)) ? Number(info.order) : 999999,
    hidden: info.hidden === true,
  };
}

export const photos = (await Promise.all(Object.entries(modules).map(buildPhoto)))
  .filter((photo) => photo.previewSrc && !photo.hidden)
  .sort((a, b) => a.order - b.order || a.path.localeCompare(b.path));
