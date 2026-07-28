/* =====================================================
   ZERO CEE — Website Script
   ===================================================== */

// ============================================================
// EVENTS — Edit this array to manage upcoming shows.
//
// Each event object:
//   date:    "YYYY-MM-DD"   (required)
//   venue:   "Venue Name"   (required)
//   city:    "City"         (required)
//   country: "CH"           (2-letter code, e.g. CH, DE, FR, UK)
//   type:    "Club Night"   (shown as a tag — any text is fine)
//   tickets: "https://..."  (set to "" or remove if not yet available)
//
// Past events are automatically hidden. Add as many as you like.
// ============================================================
const EVENTS = [
  {
    date:    "2026-07-03",
    venue:   "Kraftwerk",
    city:    "Zurich",
    country: "CH",
    type:    "Club Night",
    tickets: "https://eventfrog.ch/de/p/partys/house-techno/nachtzugang-x-blackout-7469385293575024925.html?utm_source=ig&utm_medium=social&utm_content=link_in_bio&fbclid=PAZXh0bgNhZW0CMTEAc3J0YwZhcHBfaWQPOTM2NjE5NzQzMzkyNDU5AAGn7aCNTmU3KnE548gtq05eZpWlxhI9MfAUR1sUsSoKvEmv6i1DmTC2pLbQghs_aem_Wgl4-U7D2PgmXot4awMvHQs"
  },
  {
    date:    "2026-07-09",
    venue:   "Private",
    city:    "Effretikon",
    country: "CH",
    type:    "Private/Invite Only",
    tickets: ""
  },
  {
    date:    "2026-08-14",
    venue:   "Club04",
    city:    "Zurich",
    country: "CH",
    type:    "Bounce | Hardtechno",
    tickets: "https://eventfrog.ch/de/p/partys/house-techno/blackout-x-nachtzugang-7484990940450445939.html"
  },
  {
    date:     "2026-08-21",
    venue:    "Private",
    city:     "Maur",
    country:  "CH",
    type:     "Invite Only",
    tickets:  ""
  },
  {
    date:    "2026-08-22",
    venue:   "Friends Party",
    city:    "Zurich",
    country: "CH",
    type:    "Invite Only",
    tickets: ""
  },
  {
    date:    "2026-08-28",
    venue:   "Rooftop Private Party",
    city:    "Zurich",
    country: "CH",
    type:    "Rooftop Private",
    tickets: ""
  },
  {
    date:    "2026-09-26",
    venue:   "Private Homeparty",
    city:    "N/A",
    country: "CH",
    type:    "Invite Only",
    tickets: ""
  },
];
// ============================================================


// ============================================================
// GALLERY PHOTOS — Edit this array to manage the carousel.
//
// 1. Drop your .jpg files into the /photos folder.
// 2. Run `node tools/optimize-images.mjs` (see upkeep.md) — it
//    turns each .jpg into a small, fast .webp file.
// 3. List the filenames below, in the order they should appear.
//
// Works best with up to about 10 photos.
// ============================================================
const PHOTOS = [
  'photos/photo1.webp',
  'photos/photo2.webp',
  'photos/photo3.webp',
  'photos/photo4.webp',
  'photos/photo5.webp',
  'photos/photo6.webp',
  'photos/photo7.webp',
  'photos/photo8.webp',
];
// ============================================================


/* ---- Render Events ---- */
function renderEvents() {
  const list  = document.getElementById('events-list');
  const empty = document.getElementById('events-empty');
  if (!list) return;

  const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  const today  = new Date();
  today.setHours(0, 0, 0, 0);

  const upcoming = EVENTS
    .map(ev => ({ ...ev, _date: new Date(ev.date) }))
    .filter(ev => ev._date >= today)
    .sort((a, b) => a._date - b._date);

  if (upcoming.length === 0) {
    list.hidden  = true;
    empty.hidden = false;
    return;
  }

  upcoming.forEach((ev, i) => {
    const d    = ev._date;
    const item = document.createElement('div');
    item.className    = 'event-item';
    item.style.animationDelay = `${i * 0.08}s`;
    item.setAttribute('role', 'listitem');
    item.innerHTML = `
      <div class="event-date">
        <span class="event-day">${String(d.getDate()).padStart(2, '0')}</span>
        <span class="event-month">${MONTHS[d.getMonth()]}</span>
        <span class="event-year">${d.getFullYear()}</span>
      </div>
      <div class="event-info">
        <span class="event-venue">${escHtml(ev.venue)}</span>
        <span class="event-location">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="2" width="11" height="11" aria-hidden="true">
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
            <circle cx="12" cy="9" r="2.5"/>
          </svg>
          ${escHtml(ev.city)}, ${escHtml(ev.country)}
        </span>
        <span class="event-tag">${escHtml(ev.type)}</span>
      </div>
      <div class="event-action">
        ${ev.tickets
          ? `<a href="${escHtml(ev.tickets)}" target="_blank" rel="noopener noreferrer" class="btn btn-primary btn-sm">Tickets &rarr;</a>`
          : `<span class="event-tba">TBA</span>`
        }
      </div>
    `;
    list.appendChild(item);
  });
}

/* ---- Skeleton loaders ----
   Overlays a shimmering placeholder on top of an image (or iframe) until
   it finishes loading. The host element must be position:relative. */
function attachSkeleton(media, label) {
  const host = media.parentElement;
  if (!host) return;
  // Already loaded from cache — nothing to cover.
  if (media.tagName === 'IMG' && media.complete && media.naturalWidth > 0) return;

  host.classList.add('img-loading');
  const sk = document.createElement('div');
  sk.className = 'img-skeleton';
  sk.dataset.label = label;
  host.appendChild(sk);

  const done = ok => {
    host.classList.remove('img-loading');
    if (ok) {
      sk.classList.add('is-done');
      setTimeout(() => sk.remove(), 450);
    } else {
      sk.classList.add('is-failed');
      sk.dataset.label = 'No Signal';
    }
  };
  media.addEventListener('load', () => done(true), { once: true });
  media.addEventListener('error', () => done(false), { once: true });

  // Iframe fallback: some browsers don't fire load reliably.
  // After 5s assume it's loaded and fade skeleton out.
  if (media.tagName === 'IFRAME') {
    setTimeout(() => {
      if (sk.parentElement === host) {
        done(true);
      }
    }, 5000);
  }
}


/* ---- Scroll progress bar (navbar bottom edge) ---- */
function initScrollProgress() {
  const bar = document.getElementById('scroll-progress');
  if (!bar) return;
  let ticking = false;
  const update = () => {
    ticking = false;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.transform = `scaleX(${max > 0 ? Math.min(window.scrollY / max, 1) : 0})`;
  };
  const onScroll = () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(update);
    }
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  update();
}


function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}


/* ---- Photo Carousel ---- */
function initCarousel() {
  const carousel = document.getElementById('carousel');
  const track    = document.getElementById('carousel-track');
  const dotsWrap = document.getElementById('carousel-dots');
  const prevBtn  = document.getElementById('carousel-prev');
  const nextBtn  = document.getElementById('carousel-next');
  if (!carousel || !track) return;

  if (PHOTOS.length === 0) {
    carousel.closest('section')?.setAttribute('hidden', '');
    return;
  }

  const AUTOPLAY_MS   = 5000;
  const TRANSITION_MS = 600; // keep in sync with .carousel-track transition duration in styles.css
  let index      = 0;
  let timer      = null;
  let animating  = false;

  PHOTOS.forEach((src, i) => {
    const slide = document.createElement('div');
    slide.className = 'carousel-slide';
    slide.innerHTML = `<img src="${escHtml(src)}" alt="Zero Cee — photo ${i + 1}" loading="${i === 0 ? 'eager' : 'lazy'}" decoding="async">`;
    track.appendChild(slide);
    attachSkeleton(slide.querySelector('img'), `IMG_${String(i + 1).padStart(2, '0')}`);

    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'carousel-dot';
    dot.setAttribute('role', 'tab');
    dot.setAttribute('aria-label', `Go to photo ${i + 1}`);
    dot.addEventListener('click', () => manualGoTo(i));
    dotsWrap?.appendChild(dot);
  });

  const dots = dotsWrap ? Array.from(dotsWrap.children) : [];
  const multi = PHOTOS.length > 1;

  if (!multi) {
    prevBtn?.setAttribute('hidden', '');
    nextBtn?.setAttribute('hidden', '');
    dotsWrap?.setAttribute('hidden', '');
  } else {
    dotsWrap?.style.setProperty('--autoplay-ms', `${AUTOPLAY_MS}ms`);
  }

  function render() {
    track.style.transform = `translateX(-${index * 100}%)`;
    dots.forEach((d, i) => d.classList.toggle('active', i === index));
  }

  // goTo() ignores clicks while a slide transition is still playing.
  // Autoplay resets happen separately in the manual* wrappers so a click
  // always resets the autoplay clock, even when goTo ignores it.
  let unlockTimer = null;
  function goTo(i) {
    if (animating) return;
    animating = true;
    clearTimeout(unlockTimer);
    unlockTimer = setTimeout(() => { animating = false; }, TRANSITION_MS + 50);
    index = (i + PHOTOS.length) % PHOTOS.length;
    render();
  }

  track.addEventListener('transitionend', e => {
    if (e.target === track && e.propertyName === 'transform') {
      clearTimeout(unlockTimer);
      animating = false;
    }
  });

  function next()  { goTo(index + 1); }
  function prev()  { goTo(index - 1); }
  function manualGoTo(i) { goTo(i); restartAutoplay(); }
  function manualNext()  { next();   restartAutoplay(); }
  function manualPrev()  { prev();   restartAutoplay(); }

  function startAutoplay() {
    if (!multi) return;
    clearInterval(timer); // always clear first — safe to call even if already running
    timer = setInterval(next, AUTOPLAY_MS);
    dotsWrap?.classList.remove('paused');
  }
  function stopAutoplay() {
    clearInterval(timer);
    dotsWrap?.classList.add('paused');
  }
  function restartAutoplay() {
    stopAutoplay();
    startAutoplay();
    // Restart the active dot's fill animation so it matches the timer.
    const activeDot = dots[index];
    if (activeDot) {
      activeDot.classList.remove('active');
      void activeDot.offsetWidth; // force reflow so the animation restarts
      activeDot.classList.add('active');
    }
  }

  prevBtn?.addEventListener('click', manualPrev);
  nextBtn?.addEventListener('click', manualNext);

  carousel.addEventListener('mouseenter', stopAutoplay);
  carousel.addEventListener('mouseleave', startAutoplay);
  carousel.addEventListener('focusin', stopAutoplay);
  carousel.addEventListener('focusout', startAutoplay);

  carousel.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft')  manualPrev();
    if (e.key === 'ArrowRight') manualNext();
  });

  // Touch swipe support
  let touchStartX = null;
  track.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; }, { passive: true });
  track.addEventListener('touchend', e => {
    if (touchStartX === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) > 40) (dx < 0 ? manualNext : manualPrev)();
    touchStartX = null;
  }, { passive: true });

  render();
  startAutoplay();
}


/* ---- Techno Perspective Grid ---- */
function initParticles() {
  const canvas = document.getElementById('particles');
  if (!canvas) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const ctx = canvas.getContext('2d');
  let W, H;

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }
  resize();

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 150);
  });

  // Pull accent colour from CSS variables
  function hexToRgb(hex) {
    hex = hex.trim().replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    const n = parseInt(hex, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const cssVars  = getComputedStyle(document.documentElement);
  const [ar, ag, ab] = hexToRgb(cssVars.getPropertyValue('--accent').trim()   || '#e85d04');
  // Use accent for both (monochrome industrial look)
  const cr = ar, cg = ag, cb = ab;
  const pr = ar, pg = ag, pb = ab;

  const HORIZ = 20;   // horizontal grid lines
  const VERT  = 14;   // vertical grid lines
  const SPEED = 0.0005; // forward speed (increase for faster)
  let   time  = 0;

  // Perspective: normalised depth d (0=horizon → 1=viewer) → screen y
  function dToY(d, vy, groundH) {
    const t = d / (d + 0.18); // 1/d curve, compressed near horizon
    return vy + groundH * t;
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);

    time = (time + SPEED) % 1;

    const vx      = W / 2;
    const vy      = H * 0.42;   // horizon sits ~42% from top
    const groundH = H - vy;

    // --- Vertical lines radiating from vanishing point ---
    for (let i = 0; i <= VERT; i++) {
      const t     = i / VERT - 0.5;        // −0.5 … +0.5
      const bx    = vx + t * W * 1.5;      // bottom x
      const fade  = 1 - Math.abs(t) * 1.8; // fade edges
      if (fade <= 0) continue;

      const alpha = fade * 0.22;
      const grad  = ctx.createLinearGradient(vx, vy, bx, H);
      grad.addColorStop(0,   `rgba(${cr},${cg},${cb},0)`);
      grad.addColorStop(0.35,`rgba(${cr},${cg},${cb},${alpha * 0.4})`);
      grad.addColorStop(1,   `rgba(${cr},${cg},${cb},${alpha})`);

      ctx.beginPath();
      ctx.moveTo(vx, vy);
      ctx.lineTo(bx, H);
      ctx.strokeStyle = grad;
      ctx.lineWidth   = 0.6;
      ctx.stroke();
    }

    // --- Horizontal lines moving toward viewer ---
    for (let i = 0; i < HORIZ; i++) {
      let d = ((i / HORIZ) + time) % 1;
      if (d < 0.02) continue; // skip lines right at the horizon

      const y     = dToY(d, vy, groundH);
      if (y > H + 2) continue;

      const alpha = Math.pow(d, 0.65) * 0.7;
      const xspan = W * 0.88 * (d / (d + 0.18));
      const x0    = vx - xspan;
      const x1    = vx + xspan;

      ctx.save();
      ctx.shadowColor = `rgba(${cr},${cg},${cb},${alpha * 0.5})`;
      ctx.shadowBlur  = 10 * d;

      const grad = ctx.createLinearGradient(x0, y, x1, y);
      grad.addColorStop(0,    `rgba(${pr},${pg},${pb},0)`);
      grad.addColorStop(0.12, `rgba(${cr},${cg},${cb},${alpha})`);
      grad.addColorStop(0.5,  `rgba(${cr},${cg},${cb},${alpha})`);
      grad.addColorStop(0.88, `rgba(${cr},${cg},${cb},${alpha})`);
      grad.addColorStop(1,    `rgba(${pr},${pg},${pb},0)`);

      ctx.beginPath();
      ctx.moveTo(x0, y);
      ctx.lineTo(x1, y);
      ctx.strokeStyle = grad;
      ctx.lineWidth   = Math.max(0.3, d * 1.8);
      ctx.stroke();
      ctx.restore();
    }

    // --- Horizon glow band ---
    const hg = ctx.createLinearGradient(0, vy - 80, 0, vy + 80);
    hg.addColorStop(0,    `rgba(${pr},${pg},${pb},0)`);
    hg.addColorStop(0.42, `rgba(${pr},${pg},${pb},0.10)`);
    hg.addColorStop(0.5,  `rgba(${cr},${cg},${cb},0.20)`);
    hg.addColorStop(0.58, `rgba(${pr},${pg},${pb},0.10)`);
    hg.addColorStop(1,    `rgba(${pr},${pg},${pb},0)`);
    ctx.fillStyle = hg;
    ctx.fillRect(0, vy - 80, W, 160);

    // --- Upward atmospheric haze above horizon ---
    const haze = ctx.createLinearGradient(0, vy - 220, 0, vy);
    haze.addColorStop(0,   `rgba(${pr},${pg},${pb},0)`);
    haze.addColorStop(1,   `rgba(${pr},${pg},${pb},0.06)`);
    ctx.fillStyle = haze;
    ctx.fillRect(0, vy - 220, W, 220);

    // --- Edge vignette ---
    const vig = ctx.createRadialGradient(vx, H * 0.6, H * 0.1, vx, H * 0.6, H * 0.9);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.65)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);

    if (running) requestAnimationFrame(draw);
  }

  // Only animate while the hero is on screen / the tab is visible.
  let running = false;
  function start() {
    if (running) return;
    running = true;
    requestAnimationFrame(draw);
  }
  function stop() { running = false; }

  const visObs = new IntersectionObserver(entries => {
    entries.forEach(e => (e.isIntersecting ? start() : stop()));
  });
  visObs.observe(canvas);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop();
    else if (canvas.getBoundingClientRect().bottom > 0) start();
  });
}


/* ---- Sticky Nav ---- */
function initNav() {
  const nav    = document.getElementById('navbar');
  const toggle = document.querySelector('.nav-toggle');
  const links  = document.querySelector('.nav-links');

  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 30);
  }, { passive: true });

  toggle?.addEventListener('click', () => {
    const open = links.classList.toggle('open');
    toggle.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', String(open));
    document.body.style.overflow = open ? 'hidden' : '';
  });

  // Close on link click or outside click
  links?.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', closeMenu);
  });
  document.addEventListener('click', e => {
    if (links?.classList.contains('open') && !nav.contains(e.target)) closeMenu();
  });

  function closeMenu() {
    links?.classList.remove('open');
    toggle?.classList.remove('open');
    toggle?.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  }
}


/* ---- Active Nav Link on Scroll ---- */
function initActiveNav() {
  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('.nav-links a[href^="#"]');

  const obs = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.id;
        navLinks.forEach(a => {
          a.classList.toggle('active', a.getAttribute('href') === `#${id}`);
        });
      }
    });
  }, { rootMargin: '-40% 0px -55% 0px' });

  sections.forEach(s => obs.observe(s));
}


/* ---- Scroll Reveal ---- */
function initReveal() {
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        obs.unobserve(e.target);
      }
    });
  }, { threshold: 0.08 });

  document.querySelectorAll('.reveal').forEach(el => obs.observe(el));
}


/* ---- Booking Form ---- */
function initForm() {
  const form = document.getElementById('booking-form');
  const btn  = document.getElementById('submit-btn');
  if (!form || !btn) return;

  const grid      = document.querySelector('.booking-grid');
  const successEl = grid?.querySelector('[data-fs-success]');
  const errorEl   = grid?.querySelector('[data-fs-error]');
  const origText  = btn.textContent;

  // Validate required fields ourselves (form is novalidate). Registered in
  // the capture phase so it runs before Formspree's own submit handler and
  // can block the request when fields are invalid.
  document.addEventListener('submit', (e) => {
    if (e.target !== form) return;

    let firstInvalid = null;
    form.querySelectorAll('[required]').forEach(field => {
      const valid = field.type === 'checkbox' ? field.checked : field.checkValidity();
      const group = field.closest('.form-group');
      group?.classList.toggle('has-error', !valid);
      if (!valid && !firstInvalid) firstInvalid = field;
    });
    if (firstInvalid) {
      e.preventDefault();
      e.stopPropagation();
      firstInvalid.focus();
      return;
    }

    btn.disabled    = true;
    btn.textContent = 'Sending…';

    // Formspree signals outcome by adding data-fs-active to the success/error div
    const poll = setInterval(() => {
      if (successEl?.hasAttribute('data-fs-active')) {
        btn.textContent = 'Enquiry Sent ✓';
        clearInterval(poll);
      } else if (errorEl?.hasAttribute('data-fs-active')) {
        btn.textContent = origText;
        btn.disabled    = false;
        clearInterval(poll);
      }
    }, 250);

    setTimeout(() => clearInterval(poll), 30000);
  }, true);

  // Clear error state on input
  form.querySelectorAll('[required]').forEach(field => {
    field.addEventListener('input', () => {
      field.closest('.form-group')?.classList.remove('has-error');
    });
    field.addEventListener('change', () => {
      field.closest('.form-group')?.classList.remove('has-error');
    });
  });
}


/* ---- Music embeds ----
   SoundCloud iframes are only created once a visitor clicks — this delays
   the connection to SoundCloud's servers (and any cookies it sets) until
   there's a clear consenting action, instead of loading on every page visit. */
function initMusicFacades() {
  document.querySelectorAll('.music-facade').forEach(btn => {
    btn.addEventListener('click', () => {
      const trackId    = btn.dataset.trackId;
      const trackTitle = btn.dataset.trackTitle;
      const trackUrl   = btn.dataset.trackUrl;

      const iframe = document.createElement('iframe');
      iframe.width = '100%';
      iframe.height = '300';
      iframe.scrolling = 'no';
      iframe.frameBorder = 'no';
      iframe.allow = 'autoplay; encrypted-media';
      iframe.src = `https://w.soundcloud.com/player/?url=https%3A//api.soundcloud.com/tracks/soundcloud%253Atracks%253A${encodeURIComponent(trackId)}&color=%23ff5500&auto_play=true&hide_related=false&show_comments=true&show_user=true&show_reposts=false&show_teaser=true&visual=true`;

      const credit = document.createElement('div');
      credit.style.cssText = 'font-size: 10px; color: #cccccc; line-break: anywhere; word-break: normal; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; font-family: Interstate,Lucida Grande,Lucida Sans Unicode,Lucida Sans,Garuda,Verdana,Tahoma,sans-serif; font-weight: 100;';
      credit.innerHTML = `<a href="https://soundcloud.com/siro-cescutti" title="ZERO CEE" target="_blank" rel="noopener noreferrer" style="color: #cccccc; text-decoration: none;">ZERO CEE</a> · <a href="${trackUrl}" title="${escHtml(trackTitle)}" target="_blank" rel="noopener noreferrer" style="color: #cccccc; text-decoration: none;">${escHtml(trackTitle)}</a>`;

      // Wrap iframe so a skeleton can cover it until SoundCloud loads
      const embed = document.createElement('div');
      embed.className = 'music-embed';
      embed.appendChild(iframe);
      btn.replaceWith(embed, credit);
      attachSkeleton(iframe, 'Loading Player');
    });
  });
}


/* ---- Init ---- */
document.addEventListener('DOMContentLoaded', () => {
  renderEvents();
  initCarousel();
  initParticles();
  initNav();
  initActiveNav();
  initForm();
  initMusicFacades();
  initScrollProgress();

  // Skeleton for the about photo
  const aboutPhoto = document.querySelector('.about-photo');
  if (aboutPhoto) attachSkeleton(aboutPhoto, 'Artist_Bio');

  // Tag reveal elements in each section
  document.querySelectorAll(`
    #about .about-image-wrap,
    #about .about-text,
    #gallery .section-label, #gallery .section-title, #gallery .carousel,
    #events .section-label, #events .section-title, #events .events-list,
    #music .section-label, #music .section-title, #music .music-grid, #music .music-social-row,
    #booking .section-label, #booking .section-title, #booking .section-sub, #booking .booking-form, #booking .booking-info
  `).forEach((el, i) => {
    el.classList.add('reveal');
    if (i > 0 && i % 3 === 0) el.classList.add('reveal-delay-1');
    else if (i > 0 && i % 3 === 1) el.classList.add('reveal-delay-2');
    else if (i > 0 && i % 3 === 2) el.classList.add('reveal-delay-3');
  });

  initReveal();
});
