'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const {
  loadManifest,
  findApprovedEntry,
  isReviewedEntry,
  resolveApprovedFilePath,
  readApprovedImage,
  LIBRARY_DIR,
} = require('../src/library');

test('every real on-disk manifest entry has review metadata and an existing image file', () => {
  const fs = require('node:fs');
  const manifest = loadManifest();
  assert.ok(Array.isArray(manifest.entries));
  for (const entry of manifest.entries) {
    assert.ok(isReviewedEntry(entry), `missing review metadata: ${entry.label}`);
    const file = resolveApprovedFilePath(entry.file);
    assert.ok(file && fs.existsSync(file), `missing image file: ${entry.label}`);
  }
});

test('findApprovedEntry matches on exact label + kind + resolved meaning, with valid review metadata', () => {
  const manifest = {
    entries: [
      {
        label: '사과',
        kind: 'n',
        visualMeaning: '먹는 과일 사과',
        file: 'apple.png',
        reviewedBy: 'reviewer-1',
        reviewedAt: '2026-01-15T00:00:00Z',
      },
    ],
  };
  const hit = findApprovedEntry({ label: '사과', kind: 'n', meaning: '먹는 과일 사과' }, manifest);
  assert.ok(hit);
  assert.equal(hit.file, 'apple.png');

  const wrongMeaning = findApprovedEntry({ label: '사과', kind: 'n', meaning: '잘못에 대해 사과하기' }, manifest);
  assert.equal(wrongMeaning, null);

  const wrongKind = findApprovedEntry({ label: '사과', kind: 'p', meaning: '먹는 과일 사과' }, manifest);
  assert.equal(wrongKind, null);
});

test('findApprovedEntry ignores an otherwise-matching entry that lacks valid reviewedBy/reviewedAt', () => {
  const baseEntry = { label: '사과', kind: 'n', visualMeaning: '먹는 과일 사과', file: 'apple.png' };

  const missingBoth = { entries: [{ ...baseEntry }] };
  assert.equal(findApprovedEntry({ label: '사과', kind: 'n', meaning: '먹는 과일 사과' }, missingBoth), null);

  const emptyReviewer = {
    entries: [{ ...baseEntry, reviewedBy: '   ', reviewedAt: '2026-01-15T00:00:00Z' }],
  };
  assert.equal(findApprovedEntry({ label: '사과', kind: 'n', meaning: '먹는 과일 사과' }, emptyReviewer), null);

  const badDate = { entries: [{ ...baseEntry, reviewedBy: 'reviewer-1', reviewedAt: 'not-a-date' }] };
  assert.equal(findApprovedEntry({ label: '사과', kind: 'n', meaning: '먹는 과일 사과' }, badDate), null);

  const missingDate = { entries: [{ ...baseEntry, reviewedBy: 'reviewer-1' }] };
  assert.equal(findApprovedEntry({ label: '사과', kind: 'n', meaning: '먹는 과일 사과' }, missingDate), null);
});

test('isReviewedEntry requires a non-empty reviewedBy and a parseable reviewedAt', () => {
  assert.equal(isReviewedEntry(null), false);
  assert.equal(isReviewedEntry({}), false);
  assert.equal(isReviewedEntry({ reviewedBy: 'x', reviewedAt: 'not-a-date' }), false);
  assert.equal(isReviewedEntry({ reviewedBy: '', reviewedAt: '2026-01-15T00:00:00Z' }), false);
  assert.equal(isReviewedEntry({ reviewedBy: 'x', reviewedAt: '2026-01-15T00:00:00Z' }), true);
});

test('resolveApprovedFilePath only accepts bare filenames inside server/library/', () => {
  const ok = resolveApprovedFilePath('apple.png');
  assert.equal(ok, path.join(LIBRARY_DIR, 'apple.png'));

  assert.equal(resolveApprovedFilePath('../secrets.png'), null);
  assert.equal(resolveApprovedFilePath('../../etc/passwd'), null);
  assert.equal(resolveApprovedFilePath('sub/apple.png'), null);
  assert.equal(resolveApprovedFilePath('/etc/passwd'), null);
  assert.equal(resolveApprovedFilePath('C:\\windows\\system.ini'), null);
  assert.equal(resolveApprovedFilePath(''), null);
  assert.equal(resolveApprovedFilePath(undefined), null);
  assert.equal(resolveApprovedFilePath('https://example.com/x.png'), null);
});

test('readApprovedImage returns null for a missing/invalid file instead of throwing', async () => {
  const bytes = await readApprovedImage({ file: 'does-not-exist.png' });
  assert.equal(bytes, null);

  const bytesTraversal = await readApprovedImage({ file: '../outside.png' });
  assert.equal(bytesTraversal, null);

  const bytesMissingEntry = await readApprovedImage(null);
  assert.equal(bytesMissingEntry, null);
});
