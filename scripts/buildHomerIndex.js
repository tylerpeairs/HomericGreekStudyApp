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
 *  - alpheios-project/majorplus short definitions (lemma|gloss|source).
 *
 * Usage: npm run build:index
 * Author: Tyler Peairs
 */
import fs from 'fs/promises';
import path from 'path';
import { normalizeForm, splitElision } from '../js/greekNormalize.js';

const DATA_DIR = path.resolve('data');
const SOURCE_DIR = path.join(DATA_DIR, 'sources');
const OUTPUT_PATH = path.join(DATA_DIR, 'homerIndex.json');

const TREEBANK_BASE =
  'https://raw.githubusercontent.com/PerseusDL/treebank_data/master/v2.1/Greek/texts';
const SOURCES = [
  { key: 'iliad', file: 'tlg0012.tlg001.perseus-grc1.tb.xml', url: `${TREEBANK_BASE}/tlg0012.tlg001.perseus-grc1.tb.xml` },
  { key: 'odyssey', file: 'tlg0012.tlg002.perseus-grc1.tb.xml', url: `${TREEBANK_BASE}/tlg0012.tlg002.perseus-grc1.tb.xml` },
  { key: 'defs', file: 'grc-mjp-defs.dat', url: 'https://raw.githubusercontent.com/alpheios-project/majorplus/master/dat/grc-mjp-defs.dat' },
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
  console.log(`  Glosses  ${definitions.size.toLocaleString()} entries`);

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

  let glossed = 0;
  for (const [lemma, entry] of lemmas) {
    const gloss = definitions.get(lemma);
    if (gloss) {
      entry.def = gloss;
      glossed += 1;
    }
  }

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
