// Every field the admin panel can write is validated here before any
// GitHub commit happens. Rules are deliberately strict and simple (plain
// text only, no angle brackets) since About/Events/Music text is rendered
// back into real visitors' pages — this is the one place stored XSS from
// a public admin page must be stopped.

const FORBIDDEN_CHARS = /[<>]/;

function isPlainText(value, maxLen) {
  return typeof value === 'string' && value.length >= 1 && value.length <= maxLen && !FORBIDDEN_CHARS.test(value);
}

function isHttpsUrl(value, hostPattern) {
  if (value === '') return true;
  if (typeof value !== 'string') return false;
  let url;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:') return false;
  if (hostPattern && !hostPattern.test(url.hostname)) return false;
  return true;
}

export const CONTENT_TYPES = ['about', 'photos', 'events', 'music'];

export function validateAbout(data) {
  if (!data || typeof data !== 'object') return 'Invalid data';
  const { paragraphs, stats } = data;

  if (!Array.isArray(paragraphs) || paragraphs.length < 1 || paragraphs.length > 6) {
    return 'About text needs 1-6 paragraphs';
  }
  for (const p of paragraphs) {
    if (!isPlainText(p, 1000)) return 'Each paragraph must be plain text, 1-1000 characters, with no < or > characters';
  }

  if (!Array.isArray(stats) || stats.length !== 3) return 'Exactly 3 stats are required';
  for (const s of stats) {
    if (!s || !isPlainText(String(s.num ?? ''), 10) || !isPlainText(String(s.label ?? ''), 20)) {
      return 'Each stat needs a short number and label (no < or > characters)';
    }
  }
  return null;
}

export function validateEvents(data) {
  if (!data || !Array.isArray(data.events)) return 'Invalid data';
  if (data.events.length > 100) return 'Too many events (max 100)';

  const seenIds = new Set();
  for (const ev of data.events) {
    if (!ev || typeof ev.id !== 'string' || !ev.id) return 'Every event needs an id';
    if (seenIds.has(ev.id)) return 'Duplicate event id';
    seenIds.add(ev.id);

    if (typeof ev.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(ev.date) || Number.isNaN(Date.parse(ev.date))) {
      return `Event "${ev.venue || ev.id}" has an invalid date (must be YYYY-MM-DD)`;
    }
    if (!isPlainText(ev.venue, 100)) return 'Venue must be plain text, 1-100 characters';
    if (!isPlainText(ev.city, 100)) return 'City must be plain text, 1-100 characters';
    if (!isPlainText(ev.type, 100)) return 'Event type must be plain text, 1-100 characters';
    if (typeof ev.country !== 'string' || !/^[A-Z]{2}$/.test(ev.country)) {
      return 'Country must be a 2-letter code, e.g. CH';
    }
    if (!isHttpsUrl(ev.tickets)) return 'Ticket link must be a valid https:// URL, or left blank';
  }
  return null;
}

export function validateMusic(data) {
  if (!data || !Array.isArray(data.tracks)) return 'Invalid data';
  if (data.tracks.length > 50) return 'Too many tracks (max 50)';

  const seenIds = new Set();
  for (const t of data.tracks) {
    if (!t || typeof t.id !== 'string' || !t.id) return 'Every track needs an id';
    if (seenIds.has(t.id)) return 'Duplicate track id';
    seenIds.add(t.id);

    if (typeof t.trackId !== 'string' || !/^\d{6,12}$/.test(t.trackId)) {
      return `Track "${t.title || t.id}" has an invalid SoundCloud track ID`;
    }
    if (!isPlainText(t.title, 150)) return 'Track title must be plain text, 1-150 characters';
    if (!isHttpsUrl(t.url, /(^|\.)soundcloud\.com$/)) return 'Track URL must be a https://soundcloud.com/... link';
  }
  return null;
}

export function validatePhotos(data, previousPhotos) {
  if (!data || !Array.isArray(data.photos)) return 'Invalid data';
  if (data.photos.length > 30) return 'Too many photos (max 30)';

  const allowed = new Set(previousPhotos || []);
  for (const p of data.photos) {
    if (typeof p !== 'string' || !/^photos\/[A-Za-z0-9_-]+\.webp$/.test(p)) return 'Invalid photo filename';
    if (!allowed.has(p)) return 'Photos can only be reordered or removed here — use Upload to add a new one';
  }
  return null;
}
