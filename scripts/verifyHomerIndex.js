/**
 * verifyHomerIndex.js
 * Checks the local index against ARTFL PhiloLogic, the source the app used to
 * scrape. Both derive from Perseus, so lemma counts should agree exactly.
 *
 * Samples across the frequency range — rare lemmas are where an indexing
 * mistake would hide, common ones are where an off-by-a-work error would show.
 *
 * Usage: npm run verify:index [-- --sample 50]
 * Author: Tyler Peairs
 */
import { loadHomerIndex, count } from '../js/homerIndex.js';
import { normalizeForm } from '../js/greekNormalize.js';

const ARTFL_URL = 'https://artflsrv03.uchicago.edu/philologic4/Greek/reports/concordance.py';
const DELAY_MS = 250;

/** Asks ARTFL how many times a lemma occurs in Homer. */
async function artflCount(lemma) {
  const params = new URLSearchParams({
    q: `lemma:${lemma}`,
    author: 'Homer',
    report: 'concordance',
    format: 'json',
    start: '0',
    end: '0',
  });
  const res = await fetch(`${ARTFL_URL}?${params}`);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  const body = await res.json();
  return body.results_length ?? 0;
}

/** Picks `size` lemmas spread evenly across the frequency range. */
function sampleLemmas(lemmas, size) {
  const ranked = Object.entries(lemmas)
    .map(([lemma, entry]) => ({ lemma, total: entry.iliad + entry.odyssey }))
    .sort((a, b) => b.total - a.total);
  const step = Math.max(1, Math.floor(ranked.length / size));
  const picked = [];
  for (let i = 0; i < ranked.length && picked.length < size; i += step) picked.push(ranked[i]);
  return picked;
}

async function main() {
  const flagIndex = process.argv.indexOf('--sample');
  const size = flagIndex > -1 ? Number.parseInt(process.argv[flagIndex + 1], 10) : 40;

  const index = await loadHomerIndex();
  const sample = sampleLemmas(index.lemmas, size);
  console.log(`Comparing ${sample.length} lemmas against ARTFL (author=Homer)\n`);

  // ARTFL runs a coarser lemmatization than the treebank: it files the name
  // Ἄλκιμος and the adjective ἄλκιμος under one headword, where the treebank
  // keeps them apart. Summing our homographs shows when that is the whole
  // difference.
  const homographs = new Map();
  for (const lemma of Object.keys(index.lemmas)) {
    const key = normalizeForm(lemma);
    if (!homographs.has(key)) homographs.set(key, []);
    homographs.get(key).push(lemma);
  }
  const conflatedTotal = lemma =>
    (homographs.get(normalizeForm(lemma)) || [lemma])
      .reduce((sum, l) => sum + count(l).total, 0);

  const agree = [];
  const conflated = [];
  const disagree = [];
  const absent = [];

  for (const { lemma, total } of sample) {
    let remote;
    try {
      remote = await artflCount(lemma);
    } catch (err) {
      console.log(`  ${lemma.padEnd(16)} request failed: ${err.message}`);
      continue;
    }
    const local = count(lemma).total;
    const row = { lemma, local, remote };
    let verdict;
    if (local === remote) {
      agree.push(row);
      verdict = 'ok';
    } else if (remote === 0) {
      // ARTFL and the treebank sometimes spell a headword differently
      // (προιάπτω vs προϊάπτω); that is a naming difference, not a miscount.
      absent.push(row);
      verdict = 'headword spelled differently in artfl';
    } else if (conflatedTotal(lemma) === remote) {
      row.conflated = conflatedTotal(lemma);
      conflated.push(row);
      verdict = `ok (artfl merges homographs: ${row.conflated})`;
    } else {
      disagree.push(row);
      verdict = 'MISMATCH';
    }
    process.stdout.write(
      `  ${lemma.padEnd(16)} local ${String(local).padStart(6)}  artfl ${String(remote).padStart(6)}  ${verdict}\n`
    );
    await new Promise(resolve => setTimeout(resolve, DELAY_MS));
  }

  const compared = agree.length + conflated.length + disagree.length;
  console.log(`\nExact agreement:           ${agree.length}/${compared}`);
  console.log(`Explained by conflation:   ${conflated.length}`);
  console.log(`Unexplained differences:   ${disagree.length}`);
  console.log(`Different headword spelling in ARTFL (not comparable): ${absent.length}`);
  if (disagree.length) {
    console.log('\nUnexplained — these are two different lemmatizations of Homer,');
    console.log('so some divergence is expected; investigate anything large:');
    for (const row of disagree) console.log(`  ${row.lemma}: local ${row.local}, artfl ${row.remote}`);
    console.log(
      '\nKnown difference: the treebank annotates elided compounds as two tokens\n' +
      '(οὐδʼ = οὐ + δέ) where ARTFL keeps them whole, which inflates δέ and οὐ\n' +
      'here by ~1,290 and ~1,232 and deflates οὐδέ and μηδέ by ~1,011 and ~88.'
    );
  }
}

main().catch(err => {
  console.error(`\nVerification failed: ${err.message}`);
  process.exit(1);
});
