/**
 * buildHomerIndex.js
 * Builds data/homerIndex.json — the offline word-lookup index that replaces the
 * ARTFL PhiloLogic and Logeion scrapes.
 *
 * Sources (downloaded into data/sources/, gitignored):
 *  - PerseusDL/treebank_data v2.1 Homer treebanks (Iliad + Odyssey).
 *    Every token carries a lemma and a 9-character Perseus postag, so lemma
 *    frequencies and in-context parses come straight out of the annotation.
 *    License: CC BY-SA (Ancient Greek Dependency Treebank, Perseus Project).
 *  - PerseusDL/lexica LSJ, 27 volumes. The gloss source: it carries several
 *    senses per headword and the proper nouns Homer is full of.
 *  - alpheios-project/majorplus short definitions (lemma|gloss|source), used
 *    for the headwords LSJ's own spelling does not reach.
 *  - data/homericNames.js, curated by hand rather than downloaded: LSJ has
 *    almost no proper nouns, and Homer is full of them.
 *
 * Usage: npm run build:index
 * Author: Tyler Peairs
 */
import fs from 'fs/promises';
import path from 'path';
import { normalizeForm, splitElision } from '../js/greekNormalize.js';
import { HOMERIC_NAMES } from '../data/homericNames.js';

const DATA_DIR = path.resolve('data');
const SOURCE_DIR = path.join(DATA_DIR, 'sources');
const OUTPUT_PATH = path.join(DATA_DIR, 'homerIndex.json');

const TREEBANK_BASE =
  'https://raw.githubusercontent.com/PerseusDL/treebank_data/master/v2.1/Greek/texts';
const LSJ_BASE =
  'https://raw.githubusercontent.com/PerseusDL/lexica/master/CTS_XML_TEI/perseus/pdllex/grc/lsj';
const SOURCES = [
  { key: 'iliad', file: 'tlg0012.tlg001.perseus-grc1.tb.xml', url: `${TREEBANK_BASE}/tlg0012.tlg001.perseus-grc1.tb.xml` },
  { key: 'odyssey', file: 'tlg0012.tlg002.perseus-grc1.tb.xml', url: `${TREEBANK_BASE}/tlg0012.tlg002.perseus-grc1.tb.xml` },
  { key: 'defs', file: 'grc-mjp-defs.dat', url: 'https://raw.githubusercontent.com/alpheios-project/majorplus/master/dat/grc-mjp-defs.dat' },
  // LSJ, split across 27 volumes. Worth the download: majorplus carries one
  // sense per headword and almost no proper nouns, which is why ἀλωή read
  // "threshing-floor" with no hint of the orchard Homer usually means, and why
  // Ὀδυσσεύς had no gloss at all.
  ...Array.from({ length: 27 }, (_, i) => ({
    key: `lsj${i + 1}`,
    file: `grc.lsj.perseus-eng${i + 1}.xml`,
    url: `${LSJ_BASE}/grc.lsj.perseus-eng${i + 1}.xml`,
  })),
];

// Coverage floors from the measurements taken when this index was designed.
// A material drop means a source changed shape and the matching needs revisiting.
const MIN_GLOBAL_COVERAGE = 0.98;
const MIN_TOTAL_COVERAGE = 0.999;

/** Downloads a source file unless it is already on disk. */
async function ensureSource({ file, url }) {
  const dest = path.join(SOURCE_DIR, file);
  try {
    const { size } = await fs.stat(dest);
    console.log(`  cached   ${file} (${(size / 1e6).toFixed(1)}MB)`);
    return dest;
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
  process.stdout.write(`  fetching ${file} … `);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await fs.writeFile(dest, buf);
  console.log(`${(buf.length / 1e6).toFixed(1)}MB`);
  return dest;
}

const ATTR_RE = /(\w+)="([^"]*)"/g;

/**
 * Strips breathing marks from a lemma's interior.
 *
 * Breathings only ever sit on a word-initial vowel or diphthong, so one on the
 * third letter or later is an elision mark that leaked into the headword during
 * annotation — the treebank has δαί̓ς where it means δαίς.
 *
 * @param {string} lemma
 * @returns {string} the lemma with interior breathings removed
 */
function stripInteriorBreathings(lemma) {
  const decomposed = lemma.normalize('NFD');
  let letterIndex = -1;
  let cleaned = '';
  for (const char of decomposed) {
    if (/\p{M}/u.test(char)) {
      // Index 0 and 1 cover an initial vowel and the second half of a diphthong.
      if (letterIndex >= 2 && /[̓̔]/.test(char)) continue;
    } else {
      letterIndex += 1;
    }
    cleaned += char;
  }
  return cleaned.normalize('NFC');
}

/**
 * Pulls every non-punctuation token out of a treebank file.
 * @returns {Array<{form:string, lemma:string, postag:string, cite:string}>}
 */
function parseTreebank(xml) {
  const tokens = [];
  for (const match of xml.matchAll(/<word ([^>]*?)\/>/g)) {
    const attrs = {};
    for (const [, name, value] of match[1].matchAll(ATTR_RE)) attrs[name] = value;
    const postag = attrs.postag || '';
    // 'u' is punctuation — it carries no lemma worth counting.
    if (!attrs.lemma || postag.startsWith('u')) continue;
    const cite = attrs.cite || '';
    tokens.push({
      form: attrs.form || '',
      lemma: attrs.lemma,
      postag,
      cite: cite.includes(':') ? cite.slice(cite.lastIndexOf(':') + 1) : '',
    });
  }
  return tokens;
}

// --- LSJ ---------------------------------------------------------------------
// LSJ headwords are beta code: "a)lwh/" is ἀλωή, "*)aqh/nh" is Ἀθήνη. The map
// below is only what appears in headwords — no need for the full transliteration.
const BETA_LETTERS = {
  a: 'α', b: 'β', g: 'γ', d: 'δ', e: 'ε', z: 'ζ', h: 'η', q: 'θ', i: 'ι',
  k: 'κ', l: 'λ', m: 'μ', n: 'ν', c: 'ξ', o: 'ο', p: 'π', r: 'ρ', s: 'σ',
  t: 'τ', u: 'υ', f: 'φ', x: 'χ', y: 'ψ', w: 'ω',
};
const BETA_MARKS = {
  ')': '̓', '(': '̔', '/': '́', '\\': '̀',
  '=': '͂', '|': 'ͅ', '+': '̈',
};
// Combining marks have to be applied in this order for NFC to compose them.
const MARK_ORDER = ['̈', '̓', '̔', '́', '̀', '͂', 'ͅ'];

/**
 * Converts an LSJ beta-code headword to Greek.
 *
 * Two things in the key are not part of the word: a trailing digit numbering
 * homonyms (a)1, a)2), and the metrical quantity marks ^ and _ that mark a
 * vowel short or long — "au)ti/ka^" is αὐτίκα, and leaving the caret in place
 * is why every entry carrying one failed to match.
 *
 * @param {string} key the value of an entryFree's key attribute
 * @returns {string} the headword in composed Greek
 */
function betaToGreek(key) {
  const cleaned = key.replace(/\d+$/, '').replace(/[\^_]/g, '');
  let out = '';
  let i = 0;
  while (i < cleaned.length) {
    let capital = false;
    if (cleaned[i] === '*') { capital = true; i += 1; }
    const marks = [];
    // Marks sit before the letter on capitals and after it on lower case.
    while (i < cleaned.length && BETA_MARKS[cleaned[i]]) { marks.push(BETA_MARKS[cleaned[i]]); i += 1; }
    if (i >= cleaned.length) break;
    const char = cleaned[i];
    i += 1;
    let base = BETA_LETTERS[char.toLowerCase()];
    if (!base) { out += char; continue; }
    if (base === 'σ' && (i >= cleaned.length || cleaned[i] === ' ' || cleaned[i] === '-')) base = 'ς';
    while (i < cleaned.length && BETA_MARKS[cleaned[i]]) { marks.push(BETA_MARKS[cleaned[i]]); i += 1; }
    if (capital) base = base.toUpperCase();
    marks.sort((a, b) => MARK_ORDER.indexOf(a) - MARK_ORDER.indexOf(b));
    out += (base + marks.join('')).normalize('NFC');
  }
  return out.normalize('NFC');
}

// Abbreviations and connectives that open a fragment rather than a definition.
const NOT_A_GLOSS = /^(later|cf|codd|v\.l|gen|pl|sq|etc|ibid|dim|Ep|Dor|Att|Ion|also|and|or)\b/i;
const LEADS_NOWHERE = /^(at|in|of|and|also|or|from|with|by|for|prob|ap)\b/i;

/** Strips tags and entities from a fragment of entry markup. */
function plainText(xml) {
  return xml
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[\s,.;:—-]+|[\s,.;:—-]+$/g, '');
}

/**
 * Whether a fragment reads as a definition rather than as apparatus.
 *
 * Rules out grammatical abbreviations, fragments that open with a preposition
 * (the tail of a stripped citation, "at Thebes and Argos"), and anything still
 * carrying beta-code punctuation, which means untransliterated Greek.
 */
function isGloss(text) {
  return Boolean(
    text
    && text.length > 2
    && text.length < 60
    && !NOT_A_GLOSS.test(text)
    && !LEADS_NOWHERE.test(text)
    && /[a-z]{3}/.test(text)
    && !/[)(/\\=|+]/.test(text)
  );
}

/**
 * The translations LSJ marks with <tr>, which is where a common noun's meaning
 * lives. Senses at level 1 are preferred: a <tr> nested deeper describes some
 * narrower idiom, which is how Ἀθήνη came back as "casting vote".
 */
function translationGlosses(body) {
  for (const topLevelOnly of [true, false]) {
    const glosses = [];
    const segments = [];
    if (topLevelOnly) {
      const SENSE_RE = /<sense\b([^>]*)>([\s\S]*?)<\/sense>/g;
      let sense;
      while ((sense = SENSE_RE.exec(body)) !== null) {
        if (sense[1].includes('level="1"')) segments.push(sense[2]);
      }
    } else {
      segments.push(body);
    }
    for (const segment of segments) {
      const TR_RE = /<tr\b[^>]*>([\s\S]*?)<\/tr>/g;
      let tr;
      while ((tr = TR_RE.exec(segment)) !== null) {
        const gloss = plainText(tr[1]);
        if (isGloss(gloss) && !glosses.includes(gloss)) glosses.push(gloss);
      }
    }
    if (glosses.length) return glosses;
  }
  return [];
}

/**
 * The English name in an entry's head, which is where LSJ glosses a proper
 * noun — "Ἀθήνη, ἡ, Athene" — rather than in a <tr>. LSJ writes ":—" ahead of
 * the definition when the head is long with variant forms, so that part is
 * read first, and the whole head after it.
 */
function headName(body) {
  const head = body
    .split('<sense')[0]
    .replace(/<(bibl|cit|quote|foreign|ref|etym)\b[^>]*>[\s\S]*?<\/\1>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\([^)]*\)/g, ' ');
  const regions = head.includes(':—') ? [head.slice(head.indexOf(':—') + 2), head] : [head];
  for (const region of regions) {
    for (const segment of region.split(/[,;]/)) {
      const text = plainText(segment);
      if (isGloss(text) && text[0] === text[0].toUpperCase()) return [text];
    }
  }
  return [];
}

/**
 * Parses one LSJ volume into headword → short definition.
 *
 * Keeps up to three senses for an ordinary word rather than only the first:
 * one sense is what made ἀλωή read "threshing-floor" alone, when the sense
 * Homer usually wants — garden, orchard, vineyard — is the one after it. A
 * proper noun keeps one, since its later senses are things named after it
 * ("games in honour of Odysseus").
 *
 * @param {string} xml one grc.lsj.perseus-engN.xml volume
 * @param {Map<string,string>} into accumulated headword → definition
 */
function parseLsjVolume(xml, into) {
  const ENTRY_RE = /<entryFree\b([^>]*)>([\s\S]*?)<\/entryFree>/g;
  let match;
  while ((match = ENTRY_RE.exec(xml)) !== null) {
    const key = /\bkey="([^"]+)"/.exec(match[1])?.[1];
    if (!key) continue;
    const headword = betaToGreek(key);
    if (!headword || into.has(headword)) continue;

    const body = match[2];
    const proper = headword[0] === headword[0].toUpperCase();
    // A proper noun falls back to <tr> only when that reads as a name too.
    // Ἀθήνη's first translation is "casting vote" — a real idiom involving her,
    // and worse than no gloss on a card asking what the word means.
    const named = translationGlosses(body).filter(g => g[0] === g[0].toUpperCase());
    const glosses = proper
      ? (headName(body).length ? headName(body) : named)
      : (translationGlosses(body).length ? translationGlosses(body) : headName(body));
    if (glosses.length) into.set(headword, glosses.slice(0, proper ? 1 : 3).join('; '));
  }
}

// --- LSJ cross-references -----------------------------------------------
// Many Epic or dialectal spellings carry no gloss of their own in LSJ: the
// entry just points elsewhere ("ἠέλιος, Ep. for ἥλιος"). Two shapes of
// pointer are worth reading:
//  (a) a short headword bundled inside a larger entry, immediately followed
//      by an <xr> — LSJ packs several minor spellings into one entry this
//      way (h)e/lios sits inside the entry for h)e/, tucked among h)/|ei and
//      h)ei/dhs).
//  (b) an entry's own <sense> holding nothing but an <xr>, or its head prose
//      reading "[dialect] for X" before any <sense> opens.
// Only the labels below actually mean "same word, look there": lbl values
// like "gloss on" or "f.l. for" mark a scribal note or a textual error, not
// a spelling of the headword, and are left alone.
const SAFE_XR_LABELS = new Set(['=', 'v.', 's.v.', 'v.l.']);
const XR_EMBED_RE =
  /<orth\b[^>]*>([^<]+)<\/orth>,?\s*(?:<gen\b[^>]*>[^<]*<\/gen>,?\s*)?(?:<gramGrp\b[^>]*>[\s\S]{0,80}?<\/gramGrp>\s*)?<xr\b[^>]*>\s*<lbl\b[^>]*>([^<]*)<\/lbl>\s*<ref\b[^>]*>([^<]+)<\/ref>\s*<\/xr>/g;
const XR_ANY_RE = /<xr\b[^>]*>\s*<lbl\b[^>]*>([^<]*)<\/lbl>\s*<ref\b[^>]*>([^<]+)<\/ref>\s*<\/xr>/;
const FOR_HEAD_RE = /for\s*<foreign\b[^>]*>([^<]+)<\/foreign>/;
// How much head prose (before the first <sense>) a bare-xr entry may carry
// and still count as a stub: enough for "τό, Ion." but not a real headnote.
const XR_HEAD_MAX = 100;

/**
 * Picks the first candidate out of a cross-reference's target text and
 * converts it to Greek — or null if it is not safely resolvable: a
 * multi-word target is an illustrative phrase or quotation, not a headword.
 */
function firstCrossRefTarget(raw) {
  const candidate = raw.split(/[,;]| and /)[0].trim().replace(/\.$/, '');
  if (!candidate || candidate.includes(' ')) return null;
  return betaToGreek(candidate);
}

/**
 * Reads one LSJ volume for cross-reference pointers and adds
 * source headword → target headword (both in Greek) to `into`.
 * @param {string} xml one grc.lsj.perseus-engN.xml volume
 * @param {Map<string,string>} into accumulated source → target
 */
function parseLsjCrossRefs(xml, into) {
  // (a) a minor spelling bundled inside a larger entry, e.g. ἠέλιος inside
  // the entry for ἠέ, written as "<orth>ἠέλιος</orth>, <xr>v. ἥλιος</xr>".
  let match;
  XR_EMBED_RE.lastIndex = 0;
  while ((match = XR_EMBED_RE.exec(xml)) !== null) {
    if (!SAFE_XR_LABELS.has(match[2].trim())) continue;
    const source = betaToGreek(match[1]);
    // A capitalised source is a name: LSJ's proper-noun cross-references are
    // too easily a different headword that happens to share a spelling
    // (Δανάη the girl vs. Δανάη "= δάφνη", a plant) — left to curated names.
    if (!source || source[0] !== source[0].toLowerCase()) continue;
    const target = firstCrossRefTarget(match[3]);
    if (!target || target === source) continue;
    if (!into.has(source)) into.set(source, target);
  }

  // (b) an entry whose own headword is the bare cross-reference.
  const ENTRY_RE = /<entryFree\b([^>]*)>([\s\S]*?)<\/entryFree>/g;
  ENTRY_RE.lastIndex = 0;
  while ((match = ENTRY_RE.exec(xml)) !== null) {
    const key = /\bkey="([^"]+)"/.exec(match[1])?.[1];
    if (!key) continue;
    const body = match[2];
    if (/<tr\b/.test(body)) continue; // a real sense already glosses this entry
    const source = betaToGreek(key);
    if (!source || into.has(source) || source[0] !== source[0].toLowerCase()) continue;

    const senseStart = body.indexOf('<sense');
    const head = senseStart === -1 ? body : body.slice(0, senseStart);

    // "[dialect] for X" head prose, read before any <sense> opens.
    const forMatch = FOR_HEAD_RE.exec(head);
    if (forMatch) {
      const target = firstCrossRefTarget(forMatch[1]);
      if (target && target !== source) into.set(source, target);
      continue;
    }

    // A first <sense> holding nothing but an <xr>, citations aside.
    if (senseStart === -1 || plainText(head).length > XR_HEAD_MAX) continue;
    const rest = body.slice(senseStart);
    const senseEnd = rest.indexOf('</sense>');
    if (senseEnd === -1) continue;
    const senseBlock = rest.slice(0, senseEnd + '</sense>'.length);
    const xrMatch = XR_ANY_RE.exec(senseBlock);
    if (!xrMatch || !SAFE_XR_LABELS.has(xrMatch[1].trim())) continue;
    const before = senseBlock.slice(senseBlock.indexOf('>') + 1, xrMatch.index);
    const after = senseBlock
      .slice(xrMatch.index + xrMatch[0].length)
      .replace(/<(bibl|cit)\b[^>]*>[\s\S]*?<\/\1>/g, ' ');
    if (plainText(before) !== '' || plainText(after).replace(/[\s,.;:()—-]+/g, '') !== '') continue;
    const target = firstCrossRefTarget(xrMatch[2]);
    if (target && target !== source) into.set(source, target);
  }
}

/**
 * Follows a chain of cross-references to a headword that already has a
 * gloss, guarding against cycles. Returns null rather than a partial guess:
 * a cross-reference only counts as resolved when it bottoms out on a real
 * gloss, never on another unresolved stub.
 * @param {string} headword
 * @param {Map<string,string>} crossRefs source → target
 * @param {Map<string,{def?:string}>} lemmas
 * @param {Set<string>} visited headwords already tried in this chain
 * @returns {string|null}
 */
function resolveCrossRef(headword, crossRefs, lemmas, visited) {
  if (visited.has(headword)) return null; // cycle
  visited.add(headword);
  const target = crossRefs.get(headword);
  if (!target) return null;
  const targetEntry = lemmas.get(target);
  if (targetEntry?.def) return targetEntry.def;
  return resolveCrossRef(target, crossRefs, lemmas, visited);
}

/** Parses `lemma|gloss|source` lines into a lemma → gloss map. */
function parseDefinitions(text) {
  const defs = new Map();
  for (const line of text.split('\n')) {
    if (!line) continue;
    const parts = line.split('|');
    if (parts.length < 2) continue;
    // Some headwords carry a leading '@' marking a proper-noun entry.
    const lemma = parts[0].replace(/^@/, '').trim();
    const gloss = parts[1].trim();
    if (!lemma || !gloss) continue;
    if (!defs.has(lemma)) defs.set(lemma, gloss);
  }
  return defs;
}

/**
 * Tokenizes a line exactly the way ui.js does, so the alignment report
 * measures the strings a user can actually click.
 */
function tokenizeLikeUi(text) {
  const words = [];
  for (const raw of text.split(/\s+/)) {
    const match = raw.match(/[\p{L}'’]+/gu);
    if (match) words.push(match[0]);
  }
  return words;
}

/** Strips tags from the app's TEI and returns [{ book, line, text }]. */
function readAppLines(xml) {
  const lines = [];
  const bookRe = /<div[^>]*subtype="Book"[^>]*n="(\d+)"[^>]*>([\s\S]*?)<\/div>/g;
  for (const [, book, body] of xml.matchAll(bookRe)) {
    for (const [, n, raw] of body.matchAll(/<l n="(\d+)"[^>]*>([\s\S]*?)<\/l>/g)) {
      lines.push({ book, line: n, text: raw.replace(/<[^>]+>/g, ' ').trim() });
    }
  }
  return lines;
}

async function main() {
  console.log('Homer index build\n');
  await fs.mkdir(SOURCE_DIR, { recursive: true });

  console.log('Sources:');
  const paths = {};
  for (const source of SOURCES) paths[source.key] = await ensureSource(source);

  console.log('\nParsing treebanks:');
  const iliad = parseTreebank(await fs.readFile(paths.iliad, 'utf8'));
  const odyssey = parseTreebank(await fs.readFile(paths.odyssey, 'utf8'));
  console.log(`  Iliad    ${iliad.length.toLocaleString()} tokens`);
  console.log(`  Odyssey  ${odyssey.length.toLocaleString()} tokens`);

  const definitions = parseDefinitions(await fs.readFile(paths.defs, 'utf8'));
  console.log(`  Glosses  ${definitions.size.toLocaleString()} majorplus entries`);

  const lsj = new Map();
  const crossRefs = new Map();
  for (let volume = 1; volume <= 27; volume += 1) {
    const xml = await fs.readFile(paths[`lsj${volume}`], 'utf8');
    parseLsjVolume(xml, lsj);
    parseLsjCrossRefs(xml, crossRefs);
  }
  console.log(`  LSJ      ${lsj.size.toLocaleString()} headwords`);
  console.log(`  LSJ xr   ${crossRefs.size.toLocaleString()} cross-references`);

  // --- forms: normalized surface form → deduped [lemma, postag] analyses ---
  const forms = new Map();
  const addForm = ({ form, lemma, postag }) => {
    const key = normalizeForm(form);
    if (!key) return;
    let analyses = forms.get(key);
    if (!analyses) forms.set(key, (analyses = []));
    if (!analyses.some(([l, p]) => l === lemma && p === postag)) analyses.push([lemma, postag]);
  };

  // --- lines: "book.line" → ordered tokens, for the in-context parse ---
  const lines = new Map();

  // --- lemmas: per-work counts, gloss, and Homer-wide concordance ---
  const lemmas = new Map();
  const lemmaEntry = lemma => {
    let entry = lemmas.get(lemma);
    if (!entry) lemmas.set(lemma, (entry = { iliad: 0, odyssey: 0, cites: [] }));
    return entry;
  };

  for (const token of iliad) {
    addForm(token);
    const entry = lemmaEntry(token.lemma);
    entry.iliad += 1;
    if (token.cite) {
      entry.cites.push(`I:${token.cite}`);
      const key = token.cite;
      let bucket = lines.get(key);
      if (!bucket) lines.set(key, (bucket = []));
      bucket.push([token.form, token.lemma, token.postag]);
    }
  }
  for (const token of odyssey) {
    addForm(token);
    const entry = lemmaEntry(token.lemma);
    entry.odyssey += 1;
    if (token.cite) entry.cites.push(`O:${token.cite}`);
  }

  // Fold annotation typos into the headword they meant — but only when that
  // headword is itself attested, so a merge can never invent a lemma.
  let merged = 0;
  for (const [lemma, entry] of [...lemmas]) {
    const canonical = stripInteriorBreathings(lemma);
    if (canonical === lemma || !lemmas.has(canonical)) continue;
    const target = lemmas.get(canonical);
    target.iliad += entry.iliad;
    target.odyssey += entry.odyssey;
    target.cites.push(...entry.cites);
    lemmas.delete(lemma);
    merged += 1;
    for (const analyses of forms.values()) {
      for (const item of analyses) if (item[0] === lemma) item[0] = canonical;
    }
    for (const tokens of lines.values()) {
      for (const token of tokens) if (token[1] === lemma) token[1] = canonical;
    }
  }
  // Rewriting can leave duplicate analyses behind.
  for (const [key, analyses] of forms) {
    const seen = new Set();
    forms.set(key, analyses.filter(([lemma, postag]) => {
      const id = `${lemma} ${postag}`;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    }));
  }
  if (merged) console.log(`  merged ${merged} mis-accented headword(s)`);

  // --- glosses: LSJ first, majorplus for what it does not reach ---------------
  // LSJ headwords differ from treebank lemmas in ways that are not differences
  // of word: it capitalises αἶσα as the personified Αἶσα, and editors accent
  // some headwords differently. So an exact match is tried first, then case,
  // then a diacritic-blind match — but that last one only when it is
  // unambiguous, because stripping accents merges τίς with τις.
  const lsjLower = new Map();
  const lsjFolded = new Map();
  for (const [headword, gloss] of lsj) {
    const lower = headword.toLowerCase();
    if (!lsjLower.has(lower)) lsjLower.set(lower, gloss);
    const folded = normalizeForm(headword);
    if (!folded) continue;
    // null marks a key more than one headword folds onto: ambiguous, so unused.
    lsjFolded.set(folded, lsjFolded.has(folded) ? null : gloss);
  }

  const sources = { majorplus: 0, extended: 0, lsjOnly: 0 };
  let glossed = 0;
  for (const [lemma, entry] of lemmas) {
    // majorplus is one curated gloss per headword and it leads: LSJ is a
    // richer source but an automatic read of it picks the wrong homonym often
    // enough to matter — its first λέγω is the one meaning "lay", not "say".
    const curated = definitions.get(lemma);
    // A capitalised lemma is a name, so it must not fold onto a lower-case LSJ
    // headword: that is what glossed Ἕκτωρ as ἕκτωρ, "holding fast".
    const capitalised = lemma[0] !== lemma[0].toLowerCase();
    const fromLsj = lsj.get(lemma)
      || (capitalised ? null : lsjLower.get(lemma.toLowerCase()))
      || (capitalised ? null : lsjFolded.get(normalizeForm(lemma)) || null);

    let gloss = curated;
    if (curated && fromLsj) {
      // Senses LSJ adds to the curated one. Kept only if they say something:
      // a bare short word here is usually LSJ's Latin equivalent ("ibo") or a
      // homonym's meaning, not a second sense of this word.
      const have = curated.toLowerCase();
      const extra = fromLsj.split('; ').filter(sense =>
        (sense.length >= 5 || sense.includes(' '))
        && !have.includes(sense.toLowerCase())
      );
      if (extra.length) {
        gloss = [curated, ...extra].join('; ');
        sources.extended += 1;
      } else {
        sources.majorplus += 1;
      }
    } else if (curated) {
      sources.majorplus += 1;
    } else if (fromLsj) {
      gloss = fromLsj;
      sources.lsjOnly += 1;
    }

    if (gloss) {
      entry.def = gloss;
      glossed += 1;
    }
  }

  // A lemma still without a gloss may be an Epic or dialectal spelling LSJ
  // only ever points elsewhere for ("ἠέλιος, Ep. for ἥλιος"). Follow the
  // pointer to a headword that already has a gloss — never onto another
  // unresolved stub — and inherit it. This never touches a lemma that
  // already has a def, curated or otherwise.
  let crossRefResolved = 0;
  let crossRefTokens = 0;
  for (const [lemma, entry] of lemmas) {
    if (entry.def) continue;
    const gloss = resolveCrossRef(lemma, crossRefs, lemmas, new Set());
    if (gloss) {
      entry.def = gloss;
      glossed += 1;
      crossRefResolved += 1;
      crossRefTokens += entry.iliad + entry.odyssey;
    }
  }

  // Curated proper names, applied last: a fallback for whatever majorplus,
  // LSJ, and LSJ cross-references still leave ungloss-ed. Never overwrites —
  // the loop above already skips any lemma that already has a def.
  let namesResolved = 0;
  let namesTokens = 0;
  for (const [lemma, entry] of lemmas) {
    if (entry.def) continue;
    const gloss = HOMERIC_NAMES[lemma];
    if (gloss) {
      entry.def = gloss;
      glossed += 1;
      namesResolved += 1;
      namesTokens += entry.iliad + entry.odyssey;
    }
  }

  console.log(`\nGlosses:`);
  console.log(`  curated only            ${sources.majorplus.toLocaleString()}`);
  console.log(`  curated + LSJ senses    ${sources.extended.toLocaleString()}`);
  console.log(`  LSJ only (mostly names) ${sources.lsjOnly.toLocaleString()}`);
  console.log(`  LSJ cross-reference     ${crossRefResolved.toLocaleString()} lemmas (${crossRefTokens.toLocaleString()} occurrences)`);
  console.log(`  curated proper names    ${namesResolved.toLocaleString()} lemmas (${namesTokens.toLocaleString()} occurrences)`);

  console.log(`\nIndex:`);
  console.log(`  ${forms.size.toLocaleString()} distinct normalized forms`);
  console.log(`  ${lemmas.size.toLocaleString()} lemmas (${glossed.toLocaleString()} with a gloss)`);
  console.log(`  ${lines.size.toLocaleString()} Iliad lines`);

  // --- Alignment report: can every clickable word actually be resolved? ---
  const appLines = readAppLines(await fs.readFile(path.join(DATA_DIR, 'illiadGreek.xml'), 'utf8'));
  let total = 0;
  let inContext = 0;
  let global = 0;
  let viaSplit = 0;
  const unresolved = [];

  for (const { book, line, text } of appLines) {
    const bucket = lines.get(`${book}.${line}`) || [];
    const contextForms = new Set(bucket.map(([form]) => normalizeForm(form)));
    for (const word of tokenizeLikeUi(text)) {
      total += 1;
      const key = normalizeForm(word);
      if (contextForms.has(key)) inContext += 1;
      if (forms.has(key)) {
        global += 1;
      } else if (splitElision(key, k => forms.has(k))) {
        viaSplit += 1;
      } else {
        if (unresolved.length < 20) unresolved.push(`${book}.${line} ${word}`);
      }
    }
  }

  const globalRate = global / total;
  const totalRate = (global + viaSplit) / total;
  const pct = n => `${(n * 100).toFixed(2)}%`;
  console.log(`\nAlignment over ${total.toLocaleString()} clickable Iliad words:`);
  console.log(`  in-context parse available  ${pct(inContext / total)}`);
  console.log(`  resolved by form map        ${pct(globalRate)}`);
  console.log(`  + elision split             ${pct(totalRate)}`);
  if (unresolved.length) console.log(`  unresolved sample: ${unresolved.slice(0, 5).join(', ')}`);

  if (globalRate < MIN_GLOBAL_COVERAGE || totalRate < MIN_TOTAL_COVERAGE) {
    throw new Error(
      `Coverage regressed (form map ${pct(globalRate)} < ${pct(MIN_GLOBAL_COVERAGE)} ` +
      `or total ${pct(totalRate)} < ${pct(MIN_TOTAL_COVERAGE)}). A source likely changed shape.`
    );
  }

  const index = {
    version: 1,
    builtAt: new Date().toISOString(),
    forms: Object.fromEntries(forms),
    lines: Object.fromEntries(lines),
    lemmas: Object.fromEntries(lemmas),
  };
  await fs.writeFile(OUTPUT_PATH, JSON.stringify(index), 'utf8');
  const { size } = await fs.stat(OUTPUT_PATH);
  console.log(`\nWrote ${path.relative(process.cwd(), OUTPUT_PATH)} (${(size / 1e6).toFixed(1)}MB)`);
}

main().catch(err => {
  console.error(`\nBuild failed: ${err.message}`);
  process.exit(1);
});
