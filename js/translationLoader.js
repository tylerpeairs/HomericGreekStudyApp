/****
 * translationLoader.js
 * Load and cache the Lattimore translation XML, indexed by book → line number.
 *
 * The file is 2.3MB of a very regular machine-generated shape: a line milestone
 * followed by the line it introduces.
 *
 *   <milestone unit="line" n="8" />
 *   <text text="What god was it then set them together in bitter collision?" />
 *
 * Handing that to DOMParser builds a 15,000-node tree that then has to be
 * walked, which measured at ~180ms to produce a flat lookup table. One pass
 * with a regex produces a byte-identical table in ~32ms, so that is what this
 * does. It is only safe because the input is generated and uniform — if the
 * translation source is ever hand-edited or restructured, go back to the DOM.
 */

// Cached *promise*, not the resolved value: several line blocks can ask for a
// translation before the first load settles, and caching the value alone let
// each of them fetch and parse the whole file again.
let _indexPromise = null;

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

/** Expands the XML entities that survive inside an attribute value. */
function decodeEntities(text) {
  if (!text.includes('&')) return text;
  return text.replace(/&(amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);/g, (whole, entity) => {
    if (entity[0] !== '#') return ENTITIES[entity] ?? whole;
    const code = entity[1] === 'x'
      ? Number.parseInt(entity.slice(2), 16)
      : Number.parseInt(entity.slice(1), 10);
    return String.fromCodePoint(code);
  });
}

// Alternation of the only two things worth stopping on: a book boundary, or a
// line milestone together with the <text> that follows it.
const TOKEN_RE =
  /<div\b[^>]*\bsubtype="book"[^>]*\bn="(\d+)"|<milestone\b[^>]*\bn="(\d+)"[^>]*\/>\s*<text\b[^>]*\btext="([^"]*)"/g;

/**
 * Scans the translation XML into book → Map(lineNumber → text).
 * @param {string} xmlText
 * @returns {Map<string, Map<number, string>>}
 */
function buildIndex(xmlText) {
  const index = new Map();
  let book = null;
  let match;
  TOKEN_RE.lastIndex = 0;
  while ((match = TOKEN_RE.exec(xmlText)) !== null) {
    const [, bookNum, lineNum, lineText] = match;
    if (bookNum !== undefined) {
      book = bookNum;
      index.set(book, new Map());
    } else if (book !== null) {
      index.get(book).set(Number(lineNum), decodeEntities(lineText));
    }
  }
  return index;
}

/**
 * Loads and indexes the translation, once per session.
 * @returns {Promise<Map<string, Map<number, string>>>}
 */
function loadTranslationIndex() {
  if (_indexPromise) return _indexPromise;
  _indexPromise = (async () => {
    const path = 'data/lattimore_translation.xml';
    const resp = await fetch(path);
    if (!resp.ok) {
      throw new Error(`Could not load translation XML: ${path} — HTTP ${resp.status}`);
    }
    const index = buildIndex(await resp.text());
    if (index.size === 0) {
      throw new Error(`No books found in ${path}; the file shape may have changed`);
    }
    return index;
  })();
  // A failed load should not poison every later attempt.
  _indexPromise.catch(() => { _indexPromise = null; });
  return _indexPromise;
}

/**
 * Given a book and a line number, return the matching translation entry.
 * @param {string|number} bookNum
 * @param {string|number} lineNum
 * @returns {Promise<Array<{n:number, text:string}>>} one entry, or empty if absent
 */
export async function getTranslationChunk(bookNum, lineNum) {
  const index = await loadTranslationIndex();
  const n = Number(lineNum);
  const text = index.get(String(bookNum))?.get(n);
  return text === undefined ? [] : [{ n, text }];
}
