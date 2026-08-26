/**
 * homerIndex.js
 * Offline word lookup over the Perseus Homer treebanks.
 *
 * Replaces the ARTFL PhiloLogic and Logeion scrapes with an in-memory index
 * built by scripts/buildHomerIndex.js. Lookups are map hits, so a click costs
 * microseconds and needs no network.
 *
 * Author: Tyler Peairs
 */
import fs from 'fs/promises';
import path from 'path';
import { normalizeForm, splitElision } from './greekNormalize.js';

const INDEX_PATH = path.resolve('data', 'homerIndex.json');

let index = null;

/**
 * Loads the index into memory. Call once at startup.
 * @returns {Promise<{forms:object, lines:object, lemmas:object}>}
 */
export async function loadHomerIndex() {
  if (index) return index;
  let raw;
  try {
    raw = await fs.readFile(INDEX_PATH, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') {
      throw new Error(
        `Missing ${path.relative(process.cwd(), INDEX_PATH)}. Run: npm run build:index`
      );
    }
    throw err;
  }
  index = JSON.parse(raw);
  return index;
}

// --- Perseus/AGDT postag decoding -------------------------------------------
// The tag is nine positional characters: part of speech, person, number,
// tense, mood, voice, gender, case, degree. '-' means "not applicable".
const POS = {
  n: 'noun', v: 'verb', a: 'adj.', d: 'adv.', l: 'article', g: 'particle',
  c: 'conj.', r: 'prep.', p: 'pron.', m: 'numeral', i: 'interj.',
  e: 'exclam.', u: 'punct.', x: 'irregular',
};
const PERSON = { 1: '1st', 2: '2nd', 3: '3rd' };
const NUMBER = { s: 'sg.', p: 'pl.', d: 'dual' };
const TENSE = {
  p: 'pres.', i: 'imperf.', r: 'perf.', l: 'plup.', t: 'fut. perf.',
  f: 'fut.', a: 'aor.',
};
const MOOD = {
  i: 'indic.', s: 'subj.', o: 'opt.', n: 'inf.', m: 'imperat.', p: 'part.',
  d: 'gerund', g: 'gerundive', u: 'supine',
};
const VOICE = { a: 'act.', p: 'pass.', m: 'mid.', e: 'mid./pass.' };
const GENDER = { m: 'masc.', f: 'fem.', n: 'neut.' };
const CASE = { n: 'nom.', g: 'gen.', d: 'dat.', a: 'acc.', v: 'voc.', l: 'loc.' };
const DEGREE = { c: 'compar.', s: 'superl.' };

/**
 * Expands a nine-character postag into a readable parse.
 * @param {string} postag e.g. "n-s---fa-"
 * @returns {string} e.g. "noun, acc. sg. fem."
 */
export function describePostag(postag) {
  if (!postag) return '';
  const at = (i, table) => table[postag[i]] || '';
  const pos = at(0, POS);
  const person = at(1, PERSON);
  const number = at(2, NUMBER);
  const tense = at(3, TENSE);
  const mood = at(4, MOOD);
  const voice = at(5, VOICE);
  const gender = at(6, GENDER);
  const grammaticalCase = at(7, CASE);
  const degree = at(8, DEGREE);

  let parts;
  if (postag[4] === 'p') {
    // Participles carry both verbal and nominal morphology.
    parts = [tense, voice, mood, grammaticalCase, number, gender];
  } else if (postag[4] === 'n') {
    parts = [tense, voice, mood];
  } else if (postag[0] === 'v') {
    parts = [person, number, tense, voice, mood];
  } else {
    parts = [grammaticalCase, number, gender, degree];
  }
  const detail = parts.filter(Boolean).join(' ');
  if (!pos) return detail;
  return detail ? `${pos}, ${detail}` : pos;
}

/** Per-work and Homer-wide counts for a lemma. */
export function count(lemma) {
  const entry = index?.lemmas[lemma];
  if (!entry) return { iliad: 0, odyssey: 0, total: 0 };
  return { iliad: entry.iliad, odyssey: entry.odyssey, total: entry.iliad + entry.odyssey };
}

/**
 * Every place a lemma occurs in Homer, as "I:book.line" / "O:book.line".
 * @param {string} lemma
 * @param {number} [limit]
 */
export function concordance(lemma, limit = Infinity) {
  const cites = index?.lemmas[lemma]?.cites || [];
  return limit === Infinity ? cites : cites.slice(0, limit);
}

/** Builds the outward-facing analysis object for one [lemma, postag] pair. */
function analysis(lemma, postag) {
  const entry = index.lemmas[lemma];
  return {
    lemma,
    postag,
    parse: describePostag(postag),
    definition: entry?.def || '',
    iliad: entry?.iliad || 0,
    odyssey: entry?.odyssey || 0,
    total: (entry?.iliad || 0) + (entry?.odyssey || 0),
  };
}

/**
 * Resolves a clicked word to its analyses.
 *
 * Tries the treebank's own annotation for that exact line first — that parse is
 * disambiguated in context, which is strictly better than the ambiguous list a
 * dictionary lookup can offer. Falls back to the corpus-wide form map, then to
 * splitting compounds the treebank annotates as two tokens (οὐδʼ → οὐ + δέ).
 *
 * @param {string} word the surface form as it appears in the line
 * @param {string|number} [book] Iliad book, for the in-context parse
 * @param {string|number} [line] line number within that book
 * @returns {{word:string, key:string, source:string|null, analyses:Array}}
 */
export function lookup(word, book, line) {
  if (!index) throw new Error('Index not loaded — call loadHomerIndex() first');
  const key = normalizeForm(word);
  const result = { word, key, source: null, analyses: [] };
  if (!key) return result;

  if (book != null && line != null) {
    const tokens = index.lines[`${book}.${line}`];
    if (tokens) {
      const matches = tokens.filter(([form]) => normalizeForm(form) === key);
      if (matches.length) {
        result.source = 'context';
        // One form can legitimately repeat in a line; dedupe identical analyses.
        const seen = new Set();
        for (const [, lemma, postag] of matches) {
          const id = `${lemma} ${postag}`;
          if (seen.has(id)) continue;
          seen.add(id);
          result.analyses.push(analysis(lemma, postag));
        }
        return result;
      }
    }
  }

  const direct = index.forms[key];
  if (direct) {
    result.source = 'form';
    result.analyses = direct.map(([lemma, postag]) => analysis(lemma, postag));
    return result;
  }

  const pieces = splitElision(key, k => Object.hasOwn(index.forms, k));
  if (pieces) {
    result.source = 'split';
    for (const piece of pieces) {
      for (const [lemma, postag] of index.forms[piece]) {
        result.analyses.push(analysis(lemma, postag));
      }
    }
  }
  return result;
}
