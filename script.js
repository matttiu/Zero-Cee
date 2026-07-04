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
    date:    "2026-08-13",
    venue:   "Venue TBA",
    city:    "Zürich",
    country: "CH",
    type:    "Club Night",
    tickets: ""
  },
  {
    date:    "Date TBA",
    venue:   "Venue TBA",
    city:    "City TBA",
    country: "Country TBA",
    type:    "Type TBA",
    tickets: ""
  }
];
// ============================================================


// ============================================================
// GALLERY PHOTOS — Edit this array to manage the carousel.
//
// 1. Drop your image files into the /photos folder.
// 2. List their filenames below, in the order they should appear.
//
// Works best with up to about 10 photos.
// ============================================================
const PHOTOS = [
  'photos/placeholder.png',
  'photos/placeholder1.png'
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
          ? `<a href="${ev.tickets}" target="_blank" rel="noopener noreferrer" class="btn btn-primary btn-sm">Tickets &rarr;</a>`
          : `<span class="event-tba">TBA</span>`
        }
      </div>
    `;
    list.appendChild(item);
  });
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
    slide.innerHTML = `<img src="${escHtml(src)}" alt="Zero Cee — photo ${i + 1}" loading="${i === 0 ? 'eager' : 'lazy'}">`;
    track.appendChild(slide);

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

  // Slide transitions and the autoplay clock are deliberately independent:
  // goTo() only guards against overlapping transitions (so a slide always
  // plays out at full length instead of being cut short and re-triggered
  // by a fast follow-up click). Autoplay resets happen separately in the
  // manual* wrappers below, so a click always resets the autoplay clock
  // even when goTo ignores it — otherwise a focus change from that same
  // click could stop the timer with nothing left to restart it.
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
    // Restart the active dot's fill animation so it always reflects the
    // real timer, even on a click that landed mid-transition and left
    // render() (and the fill it triggers) untouched.
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

  // Pull accent colours from CSS variables
  function hexToRgb(hex) {
    hex = hex.trim().replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    const n = parseInt(hex, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const cssVars  = getComputedStyle(document.documentElement);
  const [cr, cg, cb] = hexToRgb(cssVars.getPropertyValue('--cyan').trim()   || '#f7c216');
  const [pr, pg, pb] = hexToRgb(cssVars.getPropertyValue('--purple').trim() || '#df3165');

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

    requestAnimationFrame(draw);
  }
  draw();
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

  form.addEventListener('submit', () => {
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
  });

  // Clear error state on input
  form.querySelectorAll('[required]').forEach(field => {
    field.addEventListener('input', () => {
      field.closest('.form-group')?.classList.remove('has-error');
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

  // Tag reveal elements in each section
  document.querySelectorAll(`
    #about .about-grid,
    #gallery .section-label, #gallery .section-title, #gallery .carousel,
    #events .section-label, #events .section-title,
    #music .section-label, #music .section-title, #music .music-grid, #music .music-social-row,
    #booking .section-label, #booking .section-title, #booking .section-sub, #booking .booking-grid
  `).forEach((el, i) => {
    el.classList.add('reveal');
    if (i > 0 && i % 3 === 0) el.classList.add('reveal-delay-1');
  });

  initReveal();
});
