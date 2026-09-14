/* =====================================================
   ZERO CEE — Admin Panel
   Talks only to the Cloudflare Worker at API_BASE. No secrets live in
   this file — the Worker holds the real GitHub token server-side.
   ===================================================== */

const API_BASE = (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
  ? 'http://localhost:8787/api'
  : '/api';

const SESSION_KEY = 'zc_admin_session';

function getToken()       { return sessionStorage.getItem(SESSION_KEY); }
function setToken(token)  { sessionStorage.setItem(SESSION_KEY, token); }
function clearToken()     { sessionStorage.removeItem(SESSION_KEY); }

async function apiFetch(path, options = {}) {
  const token = getToken();
  const headers = { ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(`${API_BASE}${path}`, { ...options, headers });
}

/* Reads a response body as JSON without letting a non-JSON reply (a
   Cloudflare error page, a GitHub Pages 404 when the Worker route misses)
   surface as a bare "Unexpected token '<'" SyntaxError. */
async function readJson(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Server returned an unexpected response (HTTP ${res.status}). Please try again.`);
  }
}

/* Turns any response into a thrown Error carrying the server's own message
   when the request failed, or the parsed body when it succeeded. */
async function readJsonOrThrow(res, fallback) {
  const body = await readJson(res);
  if (!res.ok) throw new Error(body.error || fallback);
  return body;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function showStatus(el, message, isError = false) {
  el.textContent = message;
  el.hidden = false;
  el.classList.toggle('is-error', isError);
  if (!isError) setTimeout(() => { el.hidden = true; }, 4000);
}

/* ---- View switching ---- */
const loginView     = document.getElementById('login-view');
const dashboardView = document.getElementById('dashboard-view');

function showLogin() {
  loginView.hidden = false;
  dashboardView.hidden = true;
}

function showDashboard() {
  loginView.hidden = true;
  dashboardView.hidden = false;
  initDashboard();
}

async function checkSession() {
  if (!getToken()) { showLogin(); return; }
  const res = await apiFetch('/me');
  if (res.ok) { showDashboard(); return; }
  clearToken();
  showLogin();
}

/* ---- Login ---- */
const loginForm  = document.getElementById('login-form');
const loginError = document.getElementById('login-error');

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const password = document.getElementById('password').value;
  const btn = loginForm.querySelector('button[type="submit"]');
  btn.disabled = true;
  loginError.hidden = true;

  try {
    const res = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    const body = await readJson(res);
    if (!res.ok) throw new Error(body.error || 'Login failed');
    setToken(body.token);
    loginForm.reset();
    showDashboard();
  } catch (err) {
    loginError.textContent = err.message;
    loginError.hidden = false;
  } finally {
    btn.disabled = false;
  }
});

document.getElementById('logout-btn').addEventListener('click', () => {
  clearToken();
  showLogin();
});

/* ---- Tabs ---- */
document.querySelectorAll('.admin-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.admin-panel').forEach(p => { p.hidden = true; });
    tab.classList.add('active');
    document.getElementById(`panel-${tab.dataset.tab}`).hidden = false;
  });
});

let dashboardInitialized = false;
function initDashboard() {
  if (dashboardInitialized) return;
  dashboardInitialized = true;
  loadAbout();
  loadPhotos();
  loadEvents();
  loadMusic();
}

/* ===================== ABOUT ===================== */
let aboutSha = null;

async function loadAbout() {
  try {
    const res = await apiFetch('/content/about');
    const { data, sha } = await readJsonOrThrow(res, 'Could not load the about text');
    aboutSha = sha;
    renderAboutForm(data);
  } catch (err) {
    showStatus(document.getElementById('about-status'), `${err.message} — reload before editing.`, true);
  }
}

function renderAboutForm(data) {
  const wrap = document.getElementById('about-paragraphs-editor');
  wrap.innerHTML = '';
  (data.paragraphs || []).forEach(addParagraphField);

  const stats = data.stats || [];
  for (let i = 0; i < 3; i++) {
    document.getElementById(`stat${i + 1}-num`).value   = stats[i]?.num   || '';
    document.getElementById(`stat${i + 1}-label`).value = stats[i]?.label || '';
  }
}

function addParagraphField(value = '') {
  const wrap = document.getElementById('about-paragraphs-editor');
  if (wrap.children.length >= 6) return;
  const row = document.createElement('div');
  row.className = 'field-row';
  const textarea = document.createElement('textarea');
  textarea.rows = 3;
  textarea.className = 'about-paragraph-input';
  textarea.value = value;
  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'btn-remove';
  removeBtn.title = 'Remove paragraph';
  removeBtn.textContent = '×';
  removeBtn.addEventListener('click', () => row.remove());
  row.append(textarea, removeBtn);
  wrap.appendChild(row);
}

document.getElementById('add-paragraph-btn').addEventListener('click', () => addParagraphField());

document.getElementById('about-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!aboutSha) {
    showStatus(document.getElementById('about-status'), 'Nothing was loaded to edit — reload the page and try again.', true);
    return;
  }
  const paragraphs = Array.from(document.querySelectorAll('.about-paragraph-input'))
    .map(t => t.value.trim())
    .filter(Boolean);
  const stats = [1, 2, 3].map(i => ({
    num:   document.getElementById(`stat${i}-num`).value.trim(),
    label: document.getElementById(`stat${i}-label`).value.trim(),
  }));

  const statusEl = document.getElementById('about-status');
  const btn = e.target.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.textContent = 'Saving…';

  try {
    const res = await apiFetch('/content/about', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: { paragraphs, stats }, sha: aboutSha }),
    });
    const body = await readJson(res);
    if (res.status === 409) {
      showStatus(statusEl, 'Content changed elsewhere — reloaded the latest version, please redo your edit.', true);
      await loadAbout();
      return;
    }
    if (!res.ok) throw new Error(body.error || 'Save failed');
    aboutSha = body.sha;
    showStatus(statusEl, 'Saved — live in about a minute.');
  } catch (err) {
    showStatus(statusEl, err.message, true);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Save changes';
  }
});

/* ===================== PHOTOS ===================== */
let photosSha  = null;
let photosList = [];

async function loadPhotos() {
  try {
    const res = await apiFetch('/content/photos');
    const { data, sha } = await readJsonOrThrow(res, 'Could not load the photo list');
    photosSha = sha;
    photosList = data.photos || [];
    renderPhotoGrid();
  } catch (err) {
    showStatus(document.getElementById('photos-status'), `${err.message} — reload before editing.`, true);
  }
}

function renderPhotoGrid() {
  const grid = document.getElementById('photo-grid');
  grid.innerHTML = '';
  photosList.forEach((src, i) => {
    const tile = document.createElement('div');
    tile.className = 'photo-tile';
    tile.draggable = true;
    tile.dataset.index = String(i);

    const img = document.createElement('img');
    img.src = `/${src}`;
    img.alt = '';
    img.loading = 'lazy';

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'photo-remove';
    removeBtn.title = 'Remove photo';
    removeBtn.textContent = '×';
    removeBtn.addEventListener('click', () => removePhoto(i));

    tile.append(img, removeBtn);
    addDragHandlers(tile);
    grid.appendChild(tile);
  });
}

function addDragHandlers(tile) {
  tile.addEventListener('dragstart', () => tile.classList.add('dragging'));
  tile.addEventListener('dragend', () => {
    tile.classList.remove('dragging');
    commitPhotoOrder();
  });
  tile.addEventListener('dragover', (e) => {
    e.preventDefault();
    const grid = document.getElementById('photo-grid');
    const dragging = grid.querySelector('.dragging');
    if (!dragging || dragging === tile) return;
    const rect = tile.getBoundingClientRect();
    const before = (e.clientX - rect.left) < rect.width / 2;
    grid.insertBefore(dragging, before ? tile : tile.nextSibling);
  });
}

function commitPhotoOrder() {
  const grid = document.getElementById('photo-grid');
  const newOrder = Array.from(grid.children).map(tile => photosList[Number(tile.dataset.index)]);
  photosList = newOrder;
  renderPhotoGrid();
  savePhotos();
}

function removePhoto(index) {
  if (!confirm('Remove this photo from the gallery?')) return;
  photosList = photosList.filter((_, i) => i !== index);
  renderPhotoGrid();
  savePhotos();
}

async function savePhotos() {
  const statusEl = document.getElementById('photos-status');
  try {
    const res = await apiFetch('/content/photos', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: { photos: photosList }, sha: photosSha }),
    });
    const body = await readJson(res);
    if (res.status === 409) {
      showStatus(statusEl, 'Content changed elsewhere — reloaded the latest version.', true);
      await loadPhotos();
      return;
    }
    if (!res.ok) throw new Error(body.error || 'Save failed');
    photosSha = body.sha;
    showStatus(statusEl, 'Saved — live in about a minute.');
  } catch (err) {
    showStatus(statusEl, err.message, true);
    await loadPhotos();
  }
}

const uploadInput  = document.getElementById('photo-upload-input');
const uploadStatus = document.getElementById('upload-status');
const dropzone     = document.getElementById('upload-dropzone');

document.getElementById('upload-btn').addEventListener('click', () => uploadInput.click());
uploadInput.addEventListener('change', () => handleUploadFile(uploadInput.files[0]));

['dragenter', 'dragover'].forEach(evt => {
  dropzone.addEventListener(evt, (e) => { e.preventDefault(); dropzone.classList.add('drag-over'); });
});
['dragleave', 'drop'].forEach(evt => {
  dropzone.addEventListener(evt, (e) => { e.preventDefault(); dropzone.classList.remove('drag-over'); });
});
dropzone.addEventListener('drop', (e) => {
  const file = e.dataTransfer.files[0];
  if (file) handleUploadFile(file);
});

async function handleUploadFile(file) {
  uploadInput.value = '';
  if (!file) return;

  uploadStatus.hidden = false;
  uploadStatus.classList.remove('is-error');
  uploadStatus.textContent = 'Preparing photo…';

  try {
    const jpegBlob = await reencodeToJpeg(file, 2000);
    uploadStatus.textContent = 'Uploading…';
    const form = new FormData();
    form.append('photo', jpegBlob, 'photo.jpg');
    const res = await apiFetch('/photos/upload', { method: 'POST', body: form });
    const body = await readJson(res);
    if (!res.ok) throw new Error(body.error || 'Upload failed');

    uploadStatus.textContent = 'Processing… (usually under a minute)';
    await pollPhotoStatus(body.name);
    uploadStatus.textContent = 'Done!';
    await loadPhotos();
    setTimeout(() => { uploadStatus.hidden = true; }, 3000);
  } catch (err) {
    uploadStatus.classList.add('is-error');
    uploadStatus.textContent = `Error: ${err.message}`;
  }
}

function reencodeToJpeg(file, maxDim) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        const scale = maxDim / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        blob => (blob ? resolve(blob) : reject(new Error('Could not process image'))),
        'image/jpeg',
        0.85
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read that image file')); };
    img.src = url;
  });
}

async function pollPhotoStatus(name, attempts = 20) {
  for (let i = 0; i < attempts; i++) {
    await new Promise(r => setTimeout(r, 3000));
    const res = await apiFetch(`/photos/status/${encodeURIComponent(name)}`);
    if (res.ok) {
      const { pending } = await readJson(res).catch(() => ({ pending: true }));
      if (!pending) return;
    }
  }
  throw new Error('Still processing — check back in a minute, it will appear once ready');
}

/* ===================== EVENTS ===================== */
let eventsSha  = null;

function newId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

async function loadEvents() {
  try {
    const res = await apiFetch('/content/events');
    const { data, sha } = await readJsonOrThrow(res, 'Could not load the events list');
    eventsSha = sha;
    const wrap = document.getElementById('events-editor');
    wrap.innerHTML = '';
    (data.events || []).forEach(ev => wrap.appendChild(buildEventRow(ev)));
  } catch (err) {
    showStatus(document.getElementById('events-status'), `${err.message} — reload before editing.`, true);
  }
}

function buildEventRow(ev) {
  const row = document.createElement('div');
  row.className = 'entry-row';
  row.dataset.id = ev.id || newId('evt');

  const fields = document.createElement('div');
  fields.className = 'entry-fields';
  fields.innerHTML = `
    <div><label>Date</label><input type="date" class="ev-date"></div>
    <div><label>Venue</label><input type="text" class="ev-venue" placeholder="Venue"></div>
    <div><label>City</label><input type="text" class="ev-city" placeholder="City"></div>
    <div><label>Country</label><input type="text" class="ev-country" placeholder="CH" maxlength="2"></div>
    <div><label>Type</label><input type="text" class="ev-type" placeholder="Club Night"></div>
    <div><label>Ticket link</label><input type="url" class="ev-tickets" placeholder="https://... (optional)"></div>
  `;
  fields.querySelector('.ev-date').value     = ev.date || '';
  fields.querySelector('.ev-venue').value    = ev.venue || '';
  fields.querySelector('.ev-city').value     = ev.city || '';
  fields.querySelector('.ev-country').value  = ev.country || '';
  fields.querySelector('.ev-type').value     = ev.type || '';
  fields.querySelector('.ev-tickets').value  = ev.tickets || '';
  fields.querySelector('.ev-country').addEventListener('input', (e) => {
    e.target.value = e.target.value.toUpperCase().slice(0, 2);
  });

  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'btn-remove';
  removeBtn.title = 'Remove event';
  removeBtn.textContent = '×';
  removeBtn.addEventListener('click', () => row.remove());

  row.append(fields, removeBtn);
  return row;
}

document.getElementById('add-event-btn').addEventListener('click', () => {
  document.getElementById('events-editor').appendChild(buildEventRow({}));
});

document.getElementById('events-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!eventsSha) {
    showStatus(document.getElementById('events-status'), 'Nothing was loaded to edit — reload the page and try again.', true);
    return;
  }
  const rows = Array.from(document.querySelectorAll('#events-editor .entry-row'));
  const events = rows.map(row => ({
    id:      row.dataset.id,
    date:    row.querySelector('.ev-date').value,
    venue:   row.querySelector('.ev-venue').value.trim(),
    city:    row.querySelector('.ev-city').value.trim(),
    country: row.querySelector('.ev-country').value.trim().toUpperCase(),
    type:    row.querySelector('.ev-type').value.trim(),
    tickets: row.querySelector('.ev-tickets').value.trim(),
  }));

  const statusEl = document.getElementById('events-status');
  const btn = e.target.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.textContent = 'Saving…';

  try {
    const res = await apiFetch('/content/events', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: { events }, sha: eventsSha }),
    });
    const body = await readJson(res);
    if (res.status === 409) {
      showStatus(statusEl, 'Content changed elsewhere — reloaded the latest version, please redo your edit.', true);
      await loadEvents();
      return;
    }
    if (!res.ok) throw new Error(body.error || 'Save failed');
    eventsSha = body.sha;
    showStatus(statusEl, 'Saved — live in about a minute.');
  } catch (err) {
    showStatus(statusEl, err.message, true);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Save changes';
  }
});

/* ===================== MUSIC ===================== */
let musicSha = null;

async function loadMusic() {
  try {
    const res = await apiFetch('/content/music');
    const { data, sha } = await readJsonOrThrow(res, 'Could not load the track list');
    musicSha = sha;
    const wrap = document.getElementById('music-editor');
    wrap.innerHTML = '';
    (data.tracks || []).forEach(t => wrap.appendChild(buildTrackRow(t)));
  } catch (err) {
    showStatus(document.getElementById('music-status'), `${err.message} — reload before editing.`, true);
  }
}

function buildTrackRow(track) {
  const row = document.createElement('div');
  row.className = 'entry-row';
  row.dataset.id = track.id || newId('trk');

  const fields = document.createElement('div');
  fields.className = 'entry-fields';
  fields.innerHTML = `
    <div><label>Title</label><input type="text" class="mu-title" placeholder="Track title"></div>
    <div><label>SoundCloud URL</label><input type="url" class="mu-url" placeholder="https://soundcloud.com/..."></div>
    <div><label>Track ID</label><input type="text" class="mu-trackid" placeholder="looked up automatically"></div>
  `;
  fields.querySelector('.mu-title').value   = track.title || '';
  fields.querySelector('.mu-url').value     = track.url || '';
  fields.querySelector('.mu-trackid').value = track.trackId || '';

  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'btn-remove';
  removeBtn.title = 'Remove track';
  removeBtn.textContent = '×';
  removeBtn.addEventListener('click', () => row.remove());

  row.append(fields, removeBtn);
  return row;
}

document.getElementById('resolve-track-btn').addEventListener('click', async () => {
  const urlInput   = document.getElementById('new-track-url');
  const titleInput = document.getElementById('new-track-title');
  const statusEl   = document.getElementById('resolve-status');
  const url = urlInput.value.trim();

  if (!url) {
    showStatus(statusEl, 'Paste a SoundCloud track link first.', true);
    return;
  }

  const btn = document.getElementById('resolve-track-btn');
  btn.disabled = true;
  btn.textContent = 'Looking up…';

  try {
    const res = await apiFetch('/music/resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    const body = await readJson(res);
    if (!res.ok) throw new Error(body.error || 'Could not resolve that link');

    const title = titleInput.value.trim() || body.title || '';
    document.getElementById('music-editor').appendChild(
      buildTrackRow({ title, url: body.url, trackId: body.trackId })
    );
    urlInput.value = '';
    titleInput.value = '';
    showStatus(statusEl, 'Added below — click "Save changes" to publish it.');
  } catch (err) {
    showStatus(statusEl, err.message, true);
  } finally {
    btn.disabled = false;
    btn.textContent = '+ Add';
  }
});

document.getElementById('music-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!musicSha) {
    showStatus(document.getElementById('music-status'), 'Nothing was loaded to edit — reload the page and try again.', true);
    return;
  }
  const rows = Array.from(document.querySelectorAll('#music-editor .entry-row'));
  const tracks = rows.map(row => ({
    id:      row.dataset.id,
    title:   row.querySelector('.mu-title').value.trim(),
    url:     row.querySelector('.mu-url').value.trim(),
    trackId: row.querySelector('.mu-trackid').value.trim(),
  }));

  const statusEl = document.getElementById('music-status');
  const btn = e.target.querySelector('button[type="submit"]');
  btn.disabled = true;
  btn.textContent = 'Saving…';

  try {
    const res = await apiFetch('/content/music', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: { tracks }, sha: musicSha }),
    });
    const body = await readJson(res);
    if (res.status === 409) {
      showStatus(statusEl, 'Content changed elsewhere — reloaded the latest version, please redo your edit.', true);
      await loadMusic();
      return;
    }
    if (!res.ok) throw new Error(body.error || 'Save failed');
    musicSha = body.sha;
    showStatus(statusEl, 'Saved — live in about a minute.');
  } catch (err) {
    showStatus(statusEl, err.message, true);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Save changes';
  }
});

checkSession();
