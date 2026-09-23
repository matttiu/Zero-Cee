import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateAbout, validateEvents, validateMusic, validatePhotos } from './validate.js';

function validAbout() {
  return {
    paragraphs: ['We throw parties.', 'Since 2018.'],
    stats: [
      { num: '50+', label: 'Events' },
      { num: '10k', label: 'Guests' },
      { num: '8', label: 'Years' },
    ],
  };
}

test('validateAbout accepts well-formed data', () => {
  assert.equal(validateAbout(validAbout()), null);
});

test('validateAbout rejects non-object input', () => {
  assert.ok(validateAbout(null));
  assert.ok(validateAbout('nope'));
});

test('validateAbout rejects too many paragraphs', () => {
  const data = validAbout();
  data.paragraphs = Array(7).fill('text');
  assert.ok(validateAbout(data));
});

test('validateAbout rejects paragraphs containing angle brackets', () => {
  const data = validAbout();
  data.paragraphs[0] = '<script>alert(1)</script>';
  assert.ok(validateAbout(data));
});

test('validateAbout rejects an over-length paragraph', () => {
  const data = validAbout();
  data.paragraphs[0] = 'a'.repeat(1001);
  assert.ok(validateAbout(data));
});

test('validateAbout requires exactly 3 stats', () => {
  const data = validAbout();
  data.stats = data.stats.slice(0, 2);
  assert.ok(validateAbout(data));
});

test('validateAbout rejects a stat missing its number', () => {
  const data = validAbout();
  data.stats[0].num = '';
  assert.ok(validateAbout(data));
});

function validEvent(overrides = {}) {
  return {
    id: 'evt_1',
    date: '2026-06-15',
    venue: 'Warehouse 9',
    city: 'Zurich',
    country: 'CH',
    type: 'Club Night',
    tickets: 'https://tickets.example.com/evt1',
    ...overrides,
  };
}

test('validateEvents accepts a well-formed event', () => {
  assert.equal(validateEvents({ events: [validEvent()] }), null);
});

test('validateEvents allows a blank ticket link', () => {
  assert.equal(validateEvents({ events: [validEvent({ tickets: '' })] }), null);
});

test('validateEvents rejects more than 100 events', () => {
  const events = Array.from({ length: 101 }, (_, i) => validEvent({ id: `evt_${i}` }));
  assert.ok(validateEvents({ events }));
});

test('validateEvents rejects a missing id', () => {
  assert.ok(validateEvents({ events: [validEvent({ id: '' })] }));
});

test('validateEvents rejects duplicate ids', () => {
  assert.ok(validateEvents({ events: [validEvent(), validEvent()] }));
});

test('validateEvents rejects a calendar date that does not exist', () => {
  assert.ok(validateEvents({ events: [validEvent({ date: '2026-02-31' })] }));
});

test('validateEvents rejects a venue containing angle brackets', () => {
  assert.ok(validateEvents({ events: [validEvent({ venue: '<b>Venue</b>' })] }));
});

test('validateEvents rejects a lowercase country code', () => {
  assert.ok(validateEvents({ events: [validEvent({ country: 'ch' })] }));
});

test('validateEvents rejects a non-https ticket link', () => {
  assert.ok(validateEvents({ events: [validEvent({ tickets: 'http://tickets.example.com' })] }));
});

function validTrack(overrides = {}) {
  return {
    id: 'trk_1',
    title: 'Late Night Set',
    trackId: '123456789',
    url: 'https://soundcloud.com/artist/late-night-set',
    ...overrides,
  };
}

test('validateMusic accepts a well-formed track', () => {
  assert.equal(validateMusic({ tracks: [validTrack()] }), null);
});

test('validateMusic rejects a non-numeric track id', () => {
  assert.ok(validateMusic({ tracks: [validTrack({ trackId: 'abc123' })] }));
});

test('validateMusic rejects an over-length title', () => {
  assert.ok(validateMusic({ tracks: [validTrack({ title: 'a'.repeat(151) })] }));
});

test('validateMusic rejects a non-SoundCloud url', () => {
  assert.ok(validateMusic({ tracks: [validTrack({ url: 'https://example.com/track' })] }));
});

test('validateMusic rejects a non-https SoundCloud url', () => {
  assert.ok(validateMusic({ tracks: [validTrack({ url: 'http://soundcloud.com/artist/track' })] }));
});

test('validateMusic rejects more than 50 tracks', () => {
  const tracks = Array.from({ length: 51 }, (_, i) => validTrack({ id: `trk_${i}` }));
  assert.ok(validateMusic({ tracks }));
});

test('validatePhotos accepts a reordered subset of existing photos', () => {
  const previous = ['photos/a.webp', 'photos/b.webp', 'photos/c.webp'];
  assert.equal(validatePhotos({ photos: [previous[2], previous[0]] }, previous), null);
});

test('validatePhotos rejects a filename that was not previously uploaded', () => {
  const previous = ['photos/a.webp'];
  assert.ok(validatePhotos({ photos: ['photos/not-uploaded.webp'] }, previous));
});

test('validatePhotos rejects a malformed filename', () => {
  const previous = ['photos/a.webp'];
  assert.ok(validatePhotos({ photos: ['photos/../secret.webp'] }, previous));
});

test('validatePhotos blocks saving at/above the cap', () => {
  const previous = Array.from({ length: 31 }, (_, i) => `photos/p${i}.webp`);
  assert.ok(validatePhotos({ photos: previous }, previous));
});

test('validatePhotos allows trimming an over-cap gallery back down', () => {
  const previous = Array.from({ length: 31 }, (_, i) => `photos/p${i}.webp`);
  const trimmed = previous.slice(0, 30);
  assert.equal(validatePhotos({ photos: trimmed }, previous), null);
});
