'use strict';

const fs = require('node:fs');
const path = require('node:path');

const LIBRARY_DIR = path.join(__dirname, '..', 'library');
const MANIFEST_PATH = path.join(LIBRARY_DIR, 'approved.json');

let cachedManifest = null;

/**
 * Loads server/library/approved.json: a manually, humanly reviewed library
 * of AAC images, completely separate from the generation cache. This
 * manifest starts empty and ONLY grows when a human reviewer adds an entry
 * here directly (e.g. via a future admin tool or hand edit). Nothing is ever
 * auto-promoted into it — not a successful generation, not a cache hit, and
 * not a guardian/user's own "this looks fine" approval of a generated
 * image. Treating generated-cache output as clinically or editorially
 * reviewed would be a false claim; this file exists to keep that boundary
 * explicit and enforced in code, not just in docs.
 */
function loadManifest() {
  if (cachedManifest) return cachedManifest;
  let raw;
  try {
    raw = fs.readFileSync(MANIFEST_PATH, 'utf8');
  } catch (err) {
    if (err && err.code === 'ENOENT') {
      cachedManifest = { entries: [] };
      return cachedManifest;
    }
    throw err;
  }
  const parsed = JSON.parse(raw);
  cachedManifest = { entries: Array.isArray(parsed.entries) ? parsed.entries : [] };
  return cachedManifest;
}

/** Test-only: force a reload of the on-disk manifest on next loadManifest() call. */
function clearManifestCache() {
  cachedManifest = null;
}

/**
 * Resolves an approved entry's `file` field to an absolute path, but ONLY
 * if it is a bare filename with no path separators or traversal, and the
 * resolved path stays strictly inside server/library/. This blocks any
 * manifest entry (however it got there) from pointing at an arbitrary
 * absolute path or escaping the library directory. Never a remote URL.
 */
function resolveApprovedFilePath(file) {
  if (typeof file !== 'string' || file.length === 0) return null;
  if (file.includes('..') || file.includes('/') || file.includes('\\')) return null;
  const resolved = path.join(LIBRARY_DIR, file);
  const rel = path.relative(LIBRARY_DIR, resolved);
  if (rel.startsWith('..') || path.isAbsolute(rel)) return null;
  return resolved;
}

/**
 * True only if an entry carries valid human-review metadata: a non-empty
 * `reviewedBy` string and a `reviewedAt` that actually parses as a date.
 * An entry missing or malformed on either field is never treated as
 * reviewed/approved, no matter how it ended up in the manifest file —
 * this keeps a hand-edited-but-incomplete row from silently being served.
 */
function isReviewedEntry(entry) {
  if (!entry) return false;
  const hasReviewer = typeof entry.reviewedBy === 'string' && entry.reviewedBy.trim().length > 0;
  const reviewedAtMs = typeof entry.reviewedAt === 'string' ? Date.parse(entry.reviewedAt) : NaN;
  const hasValidDate = Number.isFinite(reviewedAtMs);
  return hasReviewer && hasValidDate;
}

/**
 * Finds a reviewed entry by EXACT label + kind + resolved-meaning match,
 * AND valid review metadata (see isReviewedEntry). `meaning` here is
 * already the fully resolved, disambiguated meaning (same value used for
 * prompt/cache), not the raw guardian input, so two different resolved
 * meanings for the same label/kind never collide. An entry that matches
 * label/kind/meaning but lacks reviewedBy/reviewedAt is treated as not
 * found (ignored), not as an approved result.
 */
function findApprovedEntry({ label, kind, meaning }, manifest = loadManifest()) {
  const entries = manifest.entries || [];
  return (
    entries.find(
      (entry) =>
        entry &&
        entry.label === label &&
        entry.kind === kind &&
        entry.visualMeaning === meaning &&
        isReviewedEntry(entry),
    ) || null
  );
}

/** Reads the approved image bytes for a manifest entry, or null if missing/invalid. */
async function readApprovedImage(entry) {
  const filePath = resolveApprovedFilePath(entry && entry.file);
  if (!filePath) return null;
  try {
    return await fs.promises.readFile(filePath);
  } catch {
    return null;
  }
}

module.exports = {
  loadManifest,
  clearManifestCache,
  isReviewedEntry,
  findApprovedEntry,
  readApprovedImage,
  resolveApprovedFilePath,
  LIBRARY_DIR,
  MANIFEST_PATH,
};
