/**
 * greekNormalize.js
 * Shared normalization for matching clicked words against the Perseus treebank.
 *
 * The app's TEI and the treebank disagree on surface detail: the app writes
 * elision with U+02BC (μυρίʼ) while the treebank uses a combining comma
 * (μυρί̓), and accentuation differs where editors differ. Stripping diacritics
 * to a bare-letter key makes the two comparable; ambiguity introduced by the
 * stripping is harmless because lookups return every matching analysis.
 */

// Apostrophes, koronis, and the quotation marks that stand in for elision.
const ELISION_MARKS = /['’ʼ᾽᾿‘`´]/g;
const TRAILING_PUNCT = /[.,·;:!?"»«;·…—–-]+$/;
const COMBINING = /\p{M}/gu;

/**
 * Reduces a Greek word to a diacritic-free lowercase key.
 * @param {string} word
 * @returns {string} the normalized key, or '' if nothing survives
 */
export function normalizeForm(word) {
  if (!word) return '';
  return word
    .normalize('NFD')
    .replace(COMBINING, '')
    .normalize('NFC')
    .toLowerCase()
    .replace(ELISION_MARKS, '')
    .replace(TRAILING_PUNCT, '')
    // ς and σ are positional variants of one letter, never contrastive.
    .replace(/ς/g, 'σ')
    .trim();
}

/**
 * Recovers the pieces of a token the treebank splits but the app does not —
 * chiefly crasis and elided compounds like οὐδʼ, which the treebank annotates
 * as οὐ + δέ while ui.js hands us a single clickable word.
 *
 * Only ever called after a direct lookup has already failed, so it cannot
 * shadow a legitimate whole-word match.
 *
 * @param {string} key normalized form
 * @param {(key: string) => boolean} has membership test against the form map
 * @returns {string[]|null} the resolved pieces, or null if nothing matched
 */
export function splitElision(key, has) {
  if (!key || key.length < 2) return null;
  for (let i = 1; i < key.length; i += 1) {
    const head = key.slice(0, i);
    const tail = key.slice(i);
    if (has(head) && has(tail)) return [head, tail];
  }
  // A trailing letter the treebank's edition drops (or an elision the app kept).
  if (key.length > 2 && has(key.slice(0, -1))) return [key.slice(0, -1)];
  return null;
}
