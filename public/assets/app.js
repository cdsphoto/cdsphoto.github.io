(() => {
  'use strict';

  const DATA = window.CDS_PHOTO_DATA || { photos: [], settings: {} };
  const rawPhotos = Array.isArray(DATA.photos) ? DATA.photos : [];
  const BASE_PATH = typeof DATA.base === 'string' && DATA.base ? DATA.base : '/';
  const settings = DATA.settings || {};
  const HERO_INTERVAL = Math.max(3500, Number(settings.heroInterval) || 7000);
  const BATCH_SIZE = Math.max(12, Number(settings.galleryBatchSize) || 36);
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const $ = (selector, context = document) => context.querySelector(selector);
  const $$ = (selector, context = document) => [...context.querySelectorAll(selector)];

  const html = document.documentElement;
  const header = $('.site-header');
  const themeToggle = $('.theme-toggle');
  const galleryGrid = $('.gallery-grid');
  const filterRow = $('.filter-row');
  const filterRowWrap = $('.filter-row-wrap');
  const galleryCount = $('.gallery-count');
  const galleryEmpty = $('.gallery-empty');
  const showMoreWrap = $('.show-more-wrap');
  const showMoreButton = $('.show-more');

  const hero = $('.hero');
  const heroStage = $('.hero-stage');
  const heroEmpty = $('.hero-empty');
  const heroFrames = [$('.hero-frame-a'), $('.hero-frame-b')];
  const heroMeta = $('.hero-photo-meta');
  const heroTitle = $('.hero-photo-title');
  const heroDetail = $('.hero-photo-detail');
  const heroTags = $('.hero-photo-tags');
  const heroCurrent = $('.hero-current');
  const heroTotal = $('.hero-total');
  const heroPrev = $('.hero-prev');
  const heroNext = $('.hero-next');
  const heroPause = $('.hero-pause');
  const heroProgress = $('.hero-progress span');

  const lightbox = $('.lightbox');
  const lightboxImage = $('.lightbox-image');
  const lightboxTitle = $('.lightbox-title');
  const lightboxDescription = $('.lightbox-description');
  const lightboxDetail = $('.lightbox-detail');
  const lightboxTechnical = $('.lightbox-technical');
  const lightboxTags = $('.lightbox-tags');
  const lightboxCounter = $('.lightbox-counter');
  const lightboxPrev = $('.lightbox-prev');
  const lightboxNext = $('.lightbox-next');
  const lightboxShare = $('.lightbox-share');
  const toastEl = $('.toast');

  const shareDialog = $('.share-dialog');
  const shareLinkInput = $('.share-link-input');
  const shareCopyBtn = $('.share-copy-btn');
  const shareTargets = $$('.share-target');

  let activeTag = null;
  let visibleCount = BATCH_SIZE;
  let filteredPhotos = [];
  let lightboxIndex = 0;
  let featuredPhotos = [];
  let heroIndex = 0;
  let activeFrame = 0;
  let heroTimer = null;
  let heroPaused = false;
  let heroResizeTimer = null;
  let heroTouchStartX = null;
  let lightboxLoadToken = 0;

  const photos = rawPhotos.filter(photo => photo && photo.previewSrc).map((photo, index) => ({
    id: index,
    previewSrc: photo.previewSrc,
    previewSrcSet: photo.previewSrcSet || '',
    heroSrc: photo.heroSrc || photo.previewSrc,
    heroMobileSrc: photo.heroMobileSrc || photo.heroSrc || photo.previewSrc,
    originalSrc: photo.originalSrc || photo.previewSrc,
    path: photo.path || photo.previewSrc,
    slug: photo.slug || '',
    width: Number(photo.width) || 0,
    height: Number(photo.height) || 0,
    format: photo.format || '',
    aspectRatio: Number(photo.aspectRatio) || 1,
    shape: photo.shape || 'standard',
    technicalLabel: photo.technicalLabel || '',
    title: photo.title || 'Untitled',
    alt: photo.alt || `${photo.title || 'Untitled'} photograph`,
    location: photo.location || '',
    year: photo.year || '',
    date: photo.date || '',
    description: photo.description || '',
    tags: Array.isArray(photo.tags) ? photo.tags : [],
    featured: photo.featured === true,
    featuredOrder: Number(photo.featuredOrder) || 999999,
  }));

  function detailLine(photo) {
    const bits = [];
    if (photo.location) bits.push(photo.location);
    if (photo.year) bits.push(photo.year);
    return bits.join(' · ');
  }

  function technicalLine(photo) {
    const bits = [];
    if (photo.width && photo.height) bits.push(`${photo.width} × ${photo.height}`);
    if (photo.technicalLabel) bits.push(photo.technicalLabel);
    if (photo.format) bits.push(String(photo.format).toUpperCase());
    return bits.join(' · ');
  }

  function pad(number) { return String(number).padStart(2, '0'); }

  // The two static <meta name="theme-color" media="..."> tags only follow OS
  // preference. Once a user picks an explicit light/dark mode, the browser
  // chrome color needs to follow that choice too, not just the OS setting.
  function syncThemeColorMeta(isDark) {
    let tag = document.getElementById('theme-color-dynamic');
    if (!tag) {
      tag = document.createElement('meta');
      tag.name = 'theme-color';
      tag.id = 'theme-color-dynamic';
      document.head.appendChild(tag);
    }
    tag.content = isDark ? '#0b0c0e' : '#f6f4ef';
  }

  function resolveTheme() {
    const explicit = html.dataset.theme;
    const isDark = explicit === 'dark' || (explicit === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    html.dataset.resolvedTheme = isDark ? 'dark' : 'light';
    themeToggle?.setAttribute('aria-label', `Switch to ${isDark ? 'light' : 'dark'} mode`);
    themeToggle?.setAttribute('title', `Switch to ${isDark ? 'light' : 'dark'} mode`);
    syncThemeColorMeta(isDark);
    document.dispatchEvent(new CustomEvent('cds:theme-change', { detail: { isDark } }));
  }

  function setTheme(theme) {
    html.dataset.theme = theme;
    try { localStorage.setItem('cds-photo-theme', theme); } catch (_) {}
    resolveTheme();
  }

  function setupTheme() {
    resolveTheme();
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', resolveTheme);
    themeToggle?.addEventListener('click', () => setTheme(html.dataset.resolvedTheme === 'dark' ? 'light' : 'dark'));
  }

  function setupGrain() {
    const grainToggle = $('.grain-toggle');
    let saved = null;
    try { saved = localStorage.getItem('cds-photo-grain'); } catch (_) {}
    html.dataset.grain = saved === 'off' ? 'off' : 'on';
    grainToggle?.setAttribute('aria-pressed', String(html.dataset.grain === 'on'));
    grainToggle?.addEventListener('click', () => {
      const next = html.dataset.grain === 'off' ? 'on' : 'off';
      html.dataset.grain = next;
      grainToggle.setAttribute('aria-pressed', String(next === 'on'));
      try { localStorage.setItem('cds-photo-grain', next); } catch (_) {}
    });
  }

  function setupHeader() {
    const updateHeader = () => header?.classList.toggle('is-scrolled', window.scrollY > 24);
    updateHeader();
    window.addEventListener('scroll', updateHeader, { passive: true });
  }

  function allTags() {
    const counts = new Map();
    for (const photo of photos) {
      for (const tag of photo.tags) counts.set(tag, (counts.get(tag) || 0) + 1);
    }
    // Most-photographed subjects first; alphabetical as a tiebreaker for stability.
    return [...counts.keys()].sort((a, b) => counts.get(b) - counts.get(a) || a.localeCompare(b));
  }

  // Fades whichever edge(s) of the tag row still have more chips to reveal,
  // as a visual hint that it scrolls — a row that ends flush at the edge
  // otherwise looks complete with nothing suggesting there's more.
  function updateFilterRowFade() {
    if (!filterRow || !filterRowWrap) return;
    const canScrollLeft = filterRow.scrollLeft > 1;
    const canScrollRight = filterRow.scrollLeft + filterRow.clientWidth < filterRow.scrollWidth - 1;
    filterRowWrap.classList.toggle('is-scrollable-start', canScrollLeft);
    filterRowWrap.classList.toggle('is-scrollable-end', canScrollRight);
  }

  function renderFilters() {
    if (!filterRow) return;
    const tags = allTags();
    tags.forEach(tag => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'filter-chip';
      button.dataset.filter = tag;
      button.setAttribute('aria-pressed', 'false');
      button.textContent = tag;
      filterRow.appendChild(button);
    });
    if (photos.some(photo => photo.tags.length === 0)) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'filter-chip filter-chip-warning';
      button.dataset.filter = '__untagged__';
      button.setAttribute('aria-pressed', 'false');
      button.textContent = 'Untagged';
      filterRow.appendChild(button);
    }

    updateFilterRowFade();
    filterRow.addEventListener('scroll', updateFilterRowFade, { passive: true });
    window.addEventListener('resize', updateFilterRowFade, { passive: true });

    filterRow.addEventListener('click', event => {
      const button = event.target.closest('[data-filter]');
      if (!button) return;
      const filter = button.dataset.filter;
      // Single-select: clicking the active tag (or "All") clears the filter;
      // clicking a different tag replaces whichever one was active.
      activeTag = filter === 'all' || filter === activeTag ? null : filter;
      visibleCount = BATCH_SIZE;
      syncFilterButtons();
      renderGallery();
    });
  }

  function syncFilterButtons() {
    $$('.filter-chip', filterRow).forEach(chip => {
      const filter = chip.dataset.filter;
      const active = filter === 'all' ? activeTag === null : filter === activeTag;
      chip.classList.toggle('is-active', active);
      chip.setAttribute('aria-pressed', String(active));
    });
  }

  function matchesActiveTags(photo) {
    if (activeTag === null) return true;
    if (activeTag === '__untagged__') return photo.tags.length === 0;
    return photo.tags.includes(activeTag);
  }

  function createTagPill(tag) {
    const span = document.createElement('span');
    span.className = 'photo-tag';
    span.textContent = tag;
    return span;
  }

  function createGalleryCard(photo, indexInFilter) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `gallery-card gallery-card-${photo.shape}`;
    button.dataset.photoIndex = String(indexInFilter);
    button.setAttribute('aria-label', `Open ${photo.title}`);
    button.style.setProperty('--photo-ratio', String(photo.aspectRatio || 1));

    // A small staggered fade-in, triggered in renderGallery() right after
    // this batch is attached — deliberately not IntersectionObserver-based.
    // An earlier version gated every card's visibility on the observer
    // firing, with no other path to opacity:1; when it didn't fire for a
    // given card (including, worst case, everything in a freshly filtered
    // result set) that card just stayed invisible forever. This version
    // can't get stuck: every render reveals its own cards unconditionally,
    // capped at a modest delay so a long grid doesn't take forever to finish.
    button.style.setProperty('--reveal-delay', `${Math.min(indexInFilter, 14) * 30}ms`);

    const imageWrap = document.createElement('span');
    imageWrap.className = 'gallery-image-wrap';
    const img = document.createElement('img');
    // Loading-affecting attributes are set before src/srcset so the very first
    // fetch already honors them, rather than possibly starting under the
    // default "auto" priority and racing a later loading/fetchPriority change.
    img.loading = indexInFilter < 2 ? 'eager' : 'lazy';
    img.decoding = 'async';
    if (indexInFilter < 2) img.fetchPriority = 'high';
    img.alt = photo.alt;
    if (photo.width) img.width = photo.width;
    if (photo.height) img.height = photo.height;
    img.sizes = '(max-width: 620px) 100vw, (max-width: 980px) 60vw, 42vw';
    if (photo.previewSrcSet) img.srcset = photo.previewSrcSet;
    img.src = photo.previewSrc;

    // Recovery for a rare "phantom complete" state some browsers can hit under
    // many concurrent eager/high-priority requests: the element reports
    // complete=true with naturalWidth=0 and never fires `error`, so neither a
    // normal load nor error handler alone can catch it. A query-string cache
    // bust on the same path is not safe to assume here, so recovery goes
    // through fetch()->blob() instead, bypassing the <img> loading state
    // machine (and its srcset/sizes candidate selection) entirely.
    const recover = () => {
      if (img.dataset.retried) return;
      img.dataset.retried = '1';
      fetch(photo.previewSrc)
        .then((response) => (response.ok ? response.blob() : Promise.reject()))
        .then((blob) => {
          const objectUrl = URL.createObjectURL(blob);
          img.removeAttribute('srcset');
          img.removeAttribute('sizes');
          img.addEventListener('load', () => {
            img.classList.add('is-loaded');
            URL.revokeObjectURL(objectUrl);
          }, { once: true });
          img.src = objectUrl;
        })
        .catch(() => {});
    };
    img.addEventListener('load', () => {
      if (img.naturalWidth > 0) img.classList.add('is-loaded'); else recover();
    }, { once: true });
    img.addEventListener('error', recover, { once: true });
    if (img.complete) {
      if (img.naturalWidth > 0) img.classList.add('is-loaded'); else recover();
    } else if (img.loading === 'eager') {
      // Safety net: eager images should resolve almost immediately. If one is
      // still stuck in the phantom state a couple seconds later, repair it.
      window.setTimeout(() => { if (img.complete && img.naturalWidth === 0) recover(); }, 2500);
    }
    imageWrap.appendChild(img);

    const meta = document.createElement('span');
    meta.className = 'gallery-card-meta';
    const top = document.createElement('span');
    const title = document.createElement('span');
    title.className = 'gallery-card-title';
    title.textContent = photo.title;
    const detail = document.createElement('span');
    detail.className = 'gallery-card-detail';
    detail.textContent = detailLine(photo);
    const tags = document.createElement('span');
    tags.className = 'gallery-card-tags';
    (photo.tags.length ? photo.tags.slice(0, 3) : ['Untagged']).forEach(tag => tags.appendChild(createTagPill(tag)));
    top.append(title, detail);
    meta.append(top, tags);
    button.append(imageWrap, meta);
    return button;
  }

  // Deliberately synchronous, not requestAnimationFrame-based: browsers
  // throttle or fully pause rAF for backgrounded/non-visible tabs, which
  // is exactly the kind of async dependency that made the previous
  // (IntersectionObserver-based) version of this feature unreliable.
  // Reading a layout property forces the browser to commit the
  // just-attached cards' opacity:0 initial state as a real style
  // right now, before is-visible flips it — skip that and both changes
  // can land in the same paint, which quietly skips the transition
  // instead of animating it. Either way, visibility itself never depends
  // on anything but this function running.
  function revealNewCards() {
    const cards = $$('.gallery-card', galleryGrid);
    if (reducedMotion.matches) {
      cards.forEach(card => card.classList.add('is-visible'));
      return;
    }
    void galleryGrid.offsetHeight;
    cards.forEach(card => card.classList.add('is-visible'));
  }

  function renderGallery() {
    if (!galleryGrid) return;
    filteredPhotos = photos.filter(matchesActiveTags);
    const toRender = filteredPhotos.slice(0, visibleCount);
    galleryGrid.replaceChildren(...toRender.map(createGalleryCard));
    revealNewCards();
    if (galleryCount) galleryCount.textContent = `${filteredPhotos.length} ${filteredPhotos.length === 1 ? 'photograph' : 'photographs'}`;
    if (galleryEmpty) galleryEmpty.hidden = filteredPhotos.length !== 0;
    if (showMoreWrap) showMoreWrap.hidden = visibleCount >= filteredPhotos.length;
  }

  function setupGallery() {
    renderFilters();
    renderGallery();
    galleryGrid?.addEventListener('click', event => {
      const card = event.target.closest('.gallery-card');
      if (card) openLightbox(Number(card.dataset.photoIndex) || 0);
    });
    showMoreButton?.addEventListener('click', () => { visibleCount += BATCH_SIZE; renderGallery(); });
    setupCardTilt();
  }

  const TILT_MAX_DEG = 6;

  // A single delegated listener on the grid rather than one per card, since
  // cards are rebuilt wholesale on every filter/pagination change. --tilt-x/
  // --tilt-y are set on the card and inherited down to .gallery-image-wrap,
  // which is what actually rotates (see styles.css) — kept separate from the
  // card's own hover-lift and the image's own hover-zoom so none of the
  // three transforms fight each other.
  function setupCardTilt() {
    if (!galleryGrid || reducedMotion.matches) return;
    let activeCard = null;

    const resetCard = card => {
      card.style.removeProperty('--tilt-x');
      card.style.removeProperty('--tilt-y');
    };

    galleryGrid.addEventListener('pointermove', event => {
      if (event.pointerType !== 'mouse') return;
      const card = event.target.closest('.gallery-card');
      if (!card) {
        if (activeCard) { resetCard(activeCard); activeCard = null; }
        return;
      }
      if (activeCard && activeCard !== card) resetCard(activeCard);
      activeCard = card;
      const rect = card.getBoundingClientRect();
      const px = (event.clientX - rect.left) / rect.width - 0.5;
      const py = (event.clientY - rect.top) / rect.height - 0.5;
      card.style.setProperty('--tilt-y', `${(px * TILT_MAX_DEG).toFixed(2)}deg`);
      card.style.setProperty('--tilt-x', `${(-py * TILT_MAX_DEG).toFixed(2)}deg`);
    });

    galleryGrid.addEventListener('pointerleave', () => {
      if (activeCard) { resetCard(activeCard); activeCard = null; }
    }, true);
  }

  function preload(src, srcSet = '') { if (src) { const image = new Image(); image.src = src; if (srcSet) { image.srcset = srcSet; image.sizes = '100vw'; } } }

  // Extra-wide photographs (panorama / 32:9 ultrawide) letterbox badly in the
  // full-screen hero — especially on phones — so they never enter the rotation,
  // even if flagged featured in photos.json.
  const HERO_MAX_RATIO = 1.8;
  const isHeroEligible = photo => (Number(photo.aspectRatio) || 1) < HERO_MAX_RATIO;

  function getFeaturedPhotos() {
    const marked = photos
      .filter(photo => photo.featured && isHeroEligible(photo))
      .sort((a, b) => a.featuredOrder - b.featuredOrder || a.path.localeCompare(b.path));
    if (marked.length) return marked;
    return photos.filter(isHeroEligible).slice(0, Math.min(8, photos.length));
  }

  function restartHeroProgress() {
    if (!heroProgress) return;
    heroProgress.classList.remove('is-running');
    heroProgress.style.setProperty('--hero-progress-duration', `${HERO_INTERVAL}ms`);
    void heroProgress.offsetWidth;
    if (!heroPaused && !reducedMotion.matches) heroProgress.classList.add('is-running');
  }

  function scheduleHero() {
    window.clearTimeout(heroTimer);
    restartHeroProgress();
    if (!heroPaused && !reducedMotion.matches && featuredPhotos.length >= 2) heroTimer = window.setTimeout(() => showHero(heroIndex + 1), HERO_INTERVAL);
  }

  function setHeroPaused(paused) {
    heroPaused = paused;
    heroPause?.classList.toggle('is-paused', paused);
    heroPause?.setAttribute('aria-label', paused ? 'Resume featured slideshow' : 'Pause featured slideshow');
    if (paused) { window.clearTimeout(heroTimer); heroProgress?.classList.remove('is-running'); } else scheduleHero();
  }

  function renderTagContainer(container, tags, limit = Infinity) {
    if (!container) return;
    container.replaceChildren(...tags.slice(0, limit).map(createTagPill));
  }

  // On phones, position the featured photo so its bottom edge always lands
  // just above the caption — measured live from the actual rendered photo
  // aspect ratio and the actual caption height, so it holds up across every
  // screen size and every photo's title/tag-line length, instead of a single
  // guessed percentage that only fit one device.
  function positionHeroPhoto() {
    if (!heroStage || window.matchMedia('(min-width: 761px)').matches) return;
    const photo = featuredPhotos[heroIndex];
    const content = $('.hero-content');
    const frame = heroFrames[activeFrame] || heroFrames[0];
    if (!photo || !content || !frame) return;
    const frameRect = frame.getBoundingClientRect();
    const contentRect = content.getBoundingClientRect();
    if (!frameRect.height || !frameRect.width) return;
    const ratio = Number(photo.aspectRatio) || 1.5;
    const displayedH = frameRect.width / ratio; // photo is width-constrained under `contain` here
    const leftover = frameRect.height - displayedH;
    if (leftover <= 0) return; // photo already fills the frame vertically, nothing to position
    const gap = 14;
    const desiredImgBottom = contentRect.top - gap;
    const percent = Math.max(0, Math.min(1, (desiredImgBottom - frameRect.top - displayedH) / leftover));
    html.style.setProperty('--hero-photo-pos', `${(percent * 100).toFixed(1)}%`);
  }

  function showHero(nextIndex, immediate = false) {
    if (!featuredPhotos.length || !heroStage) return;
    heroIndex = (nextIndex + featuredPhotos.length) % featuredPhotos.length;
    const photo = featuredPhotos[heroIndex];
    const nextFrameIndex = immediate ? activeFrame : 1 - activeFrame;
    const nextFrame = heroFrames[nextFrameIndex];
    const previousFrame = heroFrames[activeFrame];
    if (!nextFrame) return;
    const heroImage = window.matchMedia('(max-width: 700px)').matches ? photo.heroMobileSrc : photo.heroSrc;
    const escaped = String(heroImage || photo.previewSrc).replace(/"/g, '%22');
    nextFrame.style.setProperty('--hero-image', `url("${escaped}")`);
    nextFrame.style.setProperty('--hero-drift-duration', `${HERO_INTERVAL + 1800}ms`);
    heroMeta?.classList.add('is-changing');
    const finish = () => {
      previousFrame?.classList.remove('is-active');
      nextFrame.classList.add('is-active');
      activeFrame = nextFrameIndex;
      if (heroTitle) heroTitle.textContent = photo.title;
      if (heroDetail) heroDetail.textContent = detailLine(photo);
      renderTagContainer(heroTags, photo.tags, 4);
      if (heroCurrent) heroCurrent.textContent = pad(heroIndex + 1);
      if (heroTotal) heroTotal.textContent = pad(featuredPhotos.length);
      heroMeta?.classList.remove('is-changing');
      positionHeroPhoto();
      {
        const nextPhoto = featuredPhotos[(heroIndex + 1) % featuredPhotos.length];
        if (nextPhoto) preload(window.matchMedia('(max-width: 700px)').matches ? nextPhoto.heroMobileSrc : nextPhoto.heroSrc);
      }
      scheduleHero();
    };
    if (immediate) finish(); else window.setTimeout(finish, 150);
  }

  function setupHero() {
    featuredPhotos = getFeaturedPhotos();
    if (!featuredPhotos.length) {
      if (heroEmpty) heroEmpty.hidden = false;
      if (heroStage) heroStage.hidden = true;
      $('.hero-content')?.setAttribute('hidden', '');
      $('.hero-progress')?.setAttribute('hidden', '');
      return;
    }
    if (heroTotal) heroTotal.textContent = pad(featuredPhotos.length);
    if (featuredPhotos.length < 2) { heroPrev?.setAttribute('hidden', ''); heroNext?.setAttribute('hidden', ''); heroPause?.setAttribute('hidden', ''); }
    showHero(0, true);
    heroPrev?.addEventListener('click', () => showHero(heroIndex - 1));
    heroNext?.addEventListener('click', () => showHero(heroIndex + 1));
    heroPause?.addEventListener('click', () => setHeroPaused(!heroPaused));
    hero?.addEventListener('touchstart', event => { heroTouchStartX = event.changedTouches[0]?.clientX ?? null; }, { passive: true });
    hero?.addEventListener('touchend', event => {
      if (heroTouchStartX == null) return;
      const endX = event.changedTouches[0]?.clientX ?? heroTouchStartX;
      const delta = endX - heroTouchStartX;
      heroTouchStartX = null;
      if (Math.abs(delta) >= 50) showHero(heroIndex + (delta < 0 ? 1 : -1));
    }, { passive: true });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { window.clearTimeout(heroTimer); heroProgress?.classList.remove('is-running'); }
      else if (!heroPaused) scheduleHero();
    });
    window.addEventListener('resize', () => {
      window.clearTimeout(heroResizeTimer);
      heroResizeTimer = window.setTimeout(positionHeroPhoto, 120);
    }, { passive: true });
  }

  function updateLightbox() {
    const photo = filteredPhotos[lightboxIndex];
    if (!photo) return;
    const token = ++lightboxLoadToken;

    // Show the already-available optimized preview immediately. Only now,
    // because the user explicitly opened this photo, request the original.
    if (lightboxImage) {
      lightboxImage.src = photo.previewSrc;
      if (photo.previewSrcSet) lightboxImage.srcset = photo.previewSrcSet;
      else lightboxImage.removeAttribute('srcset');
      lightboxImage.sizes = '100vw';
      lightboxImage.alt = photo.alt;
      if (photo.width) lightboxImage.width = photo.width;
      if (photo.height) lightboxImage.height = photo.height;
      lightboxImage.classList.add('is-loading-full');
    }
    if (lightboxTitle) lightboxTitle.textContent = photo.title;
    if (lightboxDescription) lightboxDescription.textContent = photo.description || '';
    if (lightboxDetail) lightboxDetail.textContent = detailLine(photo);
    if (lightboxTechnical) lightboxTechnical.textContent = [technicalLine(photo), 'Loading full resolution…'].filter(Boolean).join(' · ');
    renderTagContainer(lightboxTags, photo.tags);
    if (lightboxCounter) lightboxCounter.textContent = `${pad(lightboxIndex + 1)} / ${pad(filteredPhotos.length)}`;
    if (lightboxPrev) lightboxPrev.hidden = filteredPhotos.length < 2;
    if (lightboxNext) lightboxNext.hidden = filteredPhotos.length < 2;

    if (photo.originalSrc) {
      const original = new Image();
      original.decoding = 'async';
      original.onload = () => {
        if (token !== lightboxLoadToken || !lightboxImage) return;
        lightboxImage.removeAttribute('srcset');
        lightboxImage.removeAttribute('sizes');
        lightboxImage.src = photo.originalSrc;
        lightboxImage.classList.remove('is-loading-full');
        if (lightboxTechnical) lightboxTechnical.textContent = [technicalLine(photo), 'Full resolution'].filter(Boolean).join(' · ');
      };
      original.onerror = () => {
        if (token !== lightboxLoadToken || !lightboxImage) return;
        lightboxImage.classList.remove('is-loading-full');
        if (lightboxTechnical) lightboxTechnical.textContent = [technicalLine(photo), 'Preview'].filter(Boolean).join(' · ');
      };
      original.src = photo.originalSrc;
    }

    // Only preload the next low-resolution preview. Never preload the next
    // original image; full-resolution transfer requires an explicit open.
    const nextPhoto = filteredPhotos[(lightboxIndex + 1) % filteredPhotos.length];
    if (nextPhoto) preload(nextPhoto.previewSrc, nextPhoto.previewSrcSet);
  }

  function openLightbox(index) {
    if (!lightbox || !filteredPhotos.length) return;
    lightboxIndex = Math.max(0, Math.min(index, filteredPhotos.length - 1));
    updateLightbox();
    document.body.classList.add('lightbox-open');
    if (typeof lightbox.showModal === 'function') lightbox.showModal(); else lightbox.setAttribute('open', '');
  }

  function closeLightbox() {
    if (!lightbox) return;
    lightboxLoadToken += 1;
    document.body.classList.remove('lightbox-open');
    if (typeof lightbox.close === 'function' && lightbox.open) lightbox.close(); else lightbox.removeAttribute('open');
  }

  let toastTimer = null;
  function toast(message) {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.classList.add('is-visible');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toastEl.classList.remove('is-visible'), 2400);
  }

  const PHOTO_PARAM = 'photo';

  // Each photo has its own static page (/photo/<slug>/) built at compile time
  // with that exact photo's title/description/image in its Open Graph tags —
  // see src/pages/photo/[slug].astro. Link-preview crawlers (Messages,
  // WhatsApp, Slack, Twitter/X…) fetch that page directly and never run our
  // JS, so this is what makes the shared "card" show the right photo instead
  // of the whole site's generic image. Visiting the link in a real browser
  // redirects straight into the interactive gallery with the photo open.
  function buildShareUrl(photo) {
    if (photo.slug) return new URL(`${BASE_PATH}photo/${photo.slug}/`, window.location.origin).href;
    // Fallback for a photo with no slug: deep-link the gallery directly.
    const url = new URL(window.location.origin + BASE_PATH);
    url.searchParams.set(PHOTO_PARAM, photo.path);
    return url.href;
  }

  function openShareDialog(photo) {
    if (!shareDialog) return;
    const shareUrl = buildShareUrl(photo);
    const shareText = [photo.title, detailLine(photo)].filter(Boolean).join(' — ');

    if (shareLinkInput) shareLinkInput.value = shareUrl;

    const targetHrefs = {
      x: `https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
      whatsapp: `https://wa.me/?text=${encodeURIComponent(`${shareText}\n${shareUrl}`)}`,
      email: `mailto:?subject=${encodeURIComponent(photo.title)}&body=${encodeURIComponent(`${shareText}\n\n${shareUrl}`)}`,
    };
    shareTargets.forEach(link => {
      const href = targetHrefs[link.dataset.target];
      if (href) link.href = href;
    });

    if (typeof shareDialog.showModal === 'function') shareDialog.showModal(); else shareDialog.setAttribute('open', '');
    window.setTimeout(() => shareLinkInput?.select(), 50);
  }

  function closeShareDialog() {
    if (!shareDialog) return;
    if (typeof shareDialog.close === 'function' && shareDialog.open) shareDialog.close();
    else shareDialog.removeAttribute('open');
  }

  function setupShareDialog() {
    if (!shareDialog) return;
    shareDialog.addEventListener('click', event => { if (event.target.closest('[data-share-close]')) closeShareDialog(); });
    shareCopyBtn?.addEventListener('click', async () => {
      shareLinkInput?.select();
      let copied = false;
      try {
        await navigator.clipboard.writeText(shareLinkInput?.value || '');
        copied = true;
      } catch (_) {
        // Clipboard API unavailable or denied — fall back to the older
        // synchronous copy command, which works in far more embedded/
        // restricted browser contexts since it doesn't need a permission grant.
        try { copied = document.execCommand('copy'); } catch (_) { copied = false; }
      }
      toast(copied ? 'Link copied — opens this photo' : 'Select the link above and copy it manually');
    });
    document.addEventListener('keydown', event => {
      if (shareDialog.open && event.key === 'Escape') closeShareDialog();
    });
  }

  async function sharePhoto(photo) {
    if (!photo) return;
    // The native OS share sheet is the best experience where it's actually
    // available and working, but it's unreliable across browsers/embedded
    // contexts (undefined entirely in several, silently rejects in others).
    // Any failure other than the user explicitly cancelling falls back to a
    // dialog that always works: a visible, selectable link plus plain-URL
    // share targets that need no browser API support at all.
    if (navigator.share) {
      try {
        const shareUrl = buildShareUrl(photo);
        const shareText = [photo.title, detailLine(photo)].filter(Boolean).join(' — ');
        await navigator.share({ title: photo.title, text: shareText, url: shareUrl });
        return;
      } catch (err) {
        if (err && err.name === 'AbortError') return; // user dismissed the share sheet
      }
    }
    openShareDialog(photo);
  }

  // If the page was opened via a shared photo link (?photo=<path>), jump
  // straight to that photograph in the viewer once the gallery is ready.
  function openSharedPhotoFromUrl() {
    const path = new URLSearchParams(window.location.search).get(PHOTO_PARAM);
    if (!path) return;
    const index = filteredPhotos.findIndex(photo => photo.path === path);
    if (index === -1) return;
    openLightbox(index);
    // Strip the param so refreshing or closing the viewer doesn't keep
    // reopening the same photo, or leave a stale link in the address bar.
    const cleanUrl = new URL(window.location.href);
    cleanUrl.searchParams.delete(PHOTO_PARAM);
    window.history.replaceState(null, '', cleanUrl.pathname + cleanUrl.search + cleanUrl.hash);
  }

  function lightboxStep(delta) {
    if (filteredPhotos.length < 2) return;
    lightboxIndex = (lightboxIndex + delta + filteredPhotos.length) % filteredPhotos.length;
    updateLightbox();
  }

  function setupLightbox() {
    lightbox?.addEventListener('click', event => { if (event.target.closest('[data-lightbox-close]')) closeLightbox(); });
    lightboxPrev?.addEventListener('click', () => lightboxStep(-1));
    lightboxNext?.addEventListener('click', () => lightboxStep(1));
    lightboxShare?.addEventListener('click', () => sharePhoto(filteredPhotos[lightboxIndex]));
    document.addEventListener('keydown', event => {
      if (!lightbox?.open) return;
      if (event.key === 'Escape') closeLightbox();
      if (event.key === 'ArrowLeft') lightboxStep(-1);
      if (event.key === 'ArrowRight') lightboxStep(1);
    });

    setupLightboxDrag();
  }

  // Swipe gestures that follow the finger in real time — like Instagram/
  // Reddit/YouTube — instead of only resolving once the gesture completes.
  // Horizontal drags slide the photo with your thumb and commit to the next/
  // previous photo past a distance threshold (springing back otherwise);
  // vertical drags fade/slide the photo away to close the viewer. Bound to
  // the whole shell (not just the image) so the letterboxed/blurred space
  // and the caption area are draggable too.
  function setupLightboxDrag() {
    const shell = $('.lightbox-shell');
    const img = lightboxImage;
    if (!shell || !img) return;

    let startX = 0;
    let startY = 0;
    let dx = 0;
    let dy = 0;
    let axis = null; // 'x' | 'y' | null
    let dragging = false;

    const setTransform = (x, y, opacity) => {
      img.style.transform = `translate(${x}px, ${y}px)`;
      img.style.opacity = String(opacity);
    };

    const reset = (animated) => {
      img.style.transition = animated ? 'transform 220ms var(--ease-out), opacity 220ms ease' : 'none';
      setTransform(0, 0, 1);
      shell.classList.remove('is-dragging');
      axis = null;
      dragging = false;
    };

    shell.addEventListener('touchstart', event => {
      if (event.touches.length !== 1 || event.target.closest('.lightbox-nav, .icon-button')) {
        axis = null;
        return;
      }
      const t = event.touches[0];
      startX = t.clientX;
      startY = t.clientY;
      dx = 0;
      dy = 0;
      axis = null;
      dragging = false;
      img.style.transition = 'none';
    }, { passive: true });

    shell.addEventListener('touchmove', event => {
      if (axis === false || event.touches.length !== 1) return; // false = deliberately not dragging
      const t = event.touches[0];
      dx = t.clientX - startX;
      dy = t.clientY - startY;
      if (!axis) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
        axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
        dragging = true;
        shell.classList.add('is-dragging');
      }
      if (!dragging) return;
      event.preventDefault(); // own the gesture once committed — no page scroll / edge-back nav
      if (axis === 'x') {
        setTransform(dx, 0, Math.max(0.4, 1 - Math.abs(dx) / (window.innerWidth * 0.85)));
      } else {
        setTransform(0, dy, Math.max(0.25, 1 - Math.abs(dy) / (window.innerHeight * 0.55)));
      }
    }, { passive: false });

    const finishDrag = () => {
      if (!dragging) { axis = null; return; }
      img.style.transition = 'transform 220ms var(--ease-out), opacity 220ms ease';

      if (axis === 'x' && Math.abs(dx) > 70 && filteredPhotos.length > 1) {
        const dir = dx < 0 ? 1 : -1;
        const flyoutX = dir * window.innerWidth * 1.1;
        setTransform(flyoutX, 0, 0);
        window.setTimeout(() => {
          lightboxStep(dir);
          img.style.transition = 'none';
          setTransform(-flyoutX * 0.5, 0, 0);
          void img.offsetWidth; // force reflow so the next transition actually animates
          img.style.transition = 'transform 240ms var(--ease-out), opacity 240ms ease';
          setTransform(0, 0, 1);
          window.setTimeout(() => reset(false), 250);
        }, 210);
      } else if (axis === 'y' && Math.abs(dy) > 90) {
        const dir = dy < 0 ? -1 : 1;
        setTransform(0, dir * window.innerHeight, 0);
        window.setTimeout(() => { closeLightbox(); reset(false); }, 190);
      } else {
        reset(true);
      }
    };

    shell.addEventListener('touchend', finishDrag, { passive: true });
    shell.addEventListener('touchcancel', () => reset(true), { passive: true });
  }

  function setupMobileTabs() {
    const tabbar = $('.mobile-tabbar');
    if (!tabbar) return;
    const tabs = $$('.tab', tabbar);
    const sections = [
      { el: $('#featured'), tab: 'top' },
      { el: $('#gallery'), tab: 'gallery' },
      { el: $('#about'), tab: 'about' },
    ].filter(section => section.el);
    if (!sections.length) return;

    const setActive = (tabName) => {
      tabs.forEach(tab => {
        const on = tab.dataset.tab === tabName;
        tab.classList.toggle('is-active', on);
        if (on) tab.setAttribute('aria-current', 'true'); else tab.removeAttribute('aria-current');
      });
    };

    // Highlight whichever section is crossing a thin band ~35% down the viewport.
    // A rootMargin band (not intersectionRatio) stays correct even though the
    // gallery dwarfs the viewport, and it keys off the viewport so it works no
    // matter which element is the scroll container.
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const match = sections.find(section => section.el === entry.target);
        if (match) setActive(match.tab);
      });
    }, { rootMargin: '-35% 0px -64% 0px', threshold: 0 });
    sections.forEach(section => observer.observe(section.el));
  }

  // Approximate coordinates for the named locations currently used across
  // photos.json. Add an entry here when a new location string is introduced
  // elsewhere — a photo whose location isn't in this table is simply left
  // off the map rather than guessed at.
  const LOCATION_COORDS = {
    'Arches National Park, Utah': [38.7331, -109.5925],
    'Big Sur, California': [36.2704, -121.8081],
    'Boulder, Colorado': [40.0150, -105.2705],
    'Canyonlands National Park, Utah': [38.3269, -109.8783],
    'Colorado': [39.5501, -105.7821],
    'Florence, Italy': [43.7696, 11.2558],
    'Grand Teton National Park, Wyoming': [43.7904, -110.6818],
    'Los Angeles, California': [34.0522, -118.2437],
    'Page, Arizona': [36.9147, -111.4558],
    'Rocky Mountain National Park, Colorado': [40.3428, -105.6836],
    'Rome, Italy': [41.9028, 12.4964],
    'San Francisco, California': [37.7749, -122.4194],
    'Seattle, Washington': [47.6062, -122.3321],
    'Singapore': [1.3521, 103.8198],
    'Vatican City': [41.9029, 12.4534],
    'Yellowstone National Park, Wyoming': [44.4280, -110.5885],
    'Yosemite National Park, California': [37.8651, -119.5383],
  };

  function setupLocationMap() {
    const container = $('#location-map');
    if (!container || typeof window.L === 'undefined') return;

    const groups = new Map();
    for (const photo of photos) {
      const coords = LOCATION_COORDS[photo.location];
      if (!coords) continue;
      if (!groups.has(photo.location)) groups.set(photo.location, { coords, photos: [] });
      groups.get(photo.location).photos.push(photo);
    }
    if (!groups.size) { container.hidden = true; return; }

    const map = window.L.map(container, { scrollWheelZoom: false, attributionControl: true });
    // CARTO's basemap tiles are free without an API key, same as the light
    // set — a raster map can't just follow the page's CSS theme, and a
    // CSS filter:invert() on the tile layer distorts hue (green land reads
    // as magenta), so this swaps to CARTO's actual dark tile set instead.
    const tileUrl = isDark => `https://{s}.basemaps.cartocdn.com/${isDark ? 'dark_all' : 'light_all'}/{z}/{x}/{y}{r}.png`;
    const tileLayer = window.L.tileLayer(tileUrl(html.dataset.resolvedTheme === 'dark'), {
      subdomains: 'abcd',
      maxZoom: 18,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    }).addTo(map);
    document.addEventListener('cds:theme-change', event => tileLayer.setUrl(tileUrl(event.detail.isDark)));

    const dotIcon = window.L.divIcon({
      className: 'map-marker-dot',
      html: '<span></span>',
      iconSize: [20, 20],
      iconAnchor: [10, 10],
      popupAnchor: [0, -10],
    });

    const markers = [];
    for (const [location, group] of groups) {
      const marker = window.L.marker(group.coords, { icon: dotIcon, title: location }).addTo(map);
      const shown = group.photos.slice(0, 4);
      const extra = group.photos.length - shown.length;
      const thumbs = shown.map(photo =>
        `<a href="${BASE_PATH}photo/${photo.slug}/" aria-label="${photo.title}"><img src="${photo.previewSrc}" alt="" loading="lazy" /></a>`
      ).join('');
      const more = extra > 0 ? `<span class="map-popup-more">+${extra}</span>` : '';
      const popupHtml =
        `<p class="map-popup-title">${location} · ${group.photos.length} ${group.photos.length === 1 ? 'photo' : 'photos'}</p>` +
        `<div class="map-popup-thumbs">${thumbs}${more}</div>`;
      marker.bindPopup(popupHtml, { closeButton: true, maxWidth: 200 });
      markers.push(marker);
    }

    if (markers.length === 1) {
      map.setView(markers[0].getLatLng(), 5);
    } else {
      map.fitBounds(window.L.featureGroup(markers).getBounds(), { padding: [36, 36], maxZoom: 6 });
    }
  }

  function setupMisc() { const year = $('.current-year'); if (year) year.textContent = String(new Date().getFullYear()); }

  // Astro's ClientRouter fires these around any transition-enhanced
  // navigation — same-page link clicks, and (given supporting browsers)
  // full cross-document navigations too, which covers the one real
  // multi-page hop this site has: a shared /photo/<slug>/ page redirecting
  // back here. Most navigations here are same-page anchor scrolls (#gallery
  // etc.), which don't fire these at all, so the bar simply stays inert.
  function setupNavProgress() {
    const bar = $('.nav-progress');
    if (!bar) return;
    let growTimer = null;
    document.addEventListener('astro:before-preparation', () => {
      window.clearTimeout(growTimer);
      bar.classList.remove('is-done');
      bar.classList.add('is-active');
      bar.style.width = '20%';
      let width = 20;
      growTimer = window.setInterval(() => {
        width = Math.min(width + (100 - width) * 0.12, 90);
        bar.style.width = `${width}%`;
      }, 180);
    });
    document.addEventListener('astro:page-load', () => {
      window.clearInterval(growTimer);
      bar.classList.add('is-done');
      window.setTimeout(() => { bar.classList.remove('is-active', 'is-done'); bar.style.width = '0%'; }, 500);
    });
  }

  setupTheme(); setupGrain(); setupHeader(); setupGallery(); setupHero(); setupLightbox(); setupShareDialog(); setupMobileTabs(); setupLocationMap(); setupNavProgress(); setupMisc();
  openSharedPhotoFromUrl();
})();
