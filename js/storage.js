/**
 * storage.js
 * Manages saving and loading user translation logs in a server-side file
 * (data/translationJournal.md, via the /api/translation-log endpoint),
 * and integrates with the flashcard module for Anki export.
 * Author: Tyler Peairs
 */
// --- App timing and flashcard utilities ---
import { addFlashcard, addConjugationFlashcard } from './flashcard.js';

// Lemma resolution for the vocabulary cards, parses for the conjugation cards
// and the journal.
import { fetchHits } from './corpusFetch.js';
import { loadMorphoData } from './morphoFetch.js';

// Timing progress import
import { startTime } from './app.js';

const LOG_ENDPOINT = 'http://localhost:3001/api/translation-log';

// In-memory cache of the translation journal, mirrors the on-disk file.
let logCache = null;

/**
 * Fetches the translation journal from the server, caching the result.
 * @param {boolean} force - refetch even if a cached copy exists.
 * @returns {Promise<string>}
 */
async function fetchLog(force = false) {
  if (logCache !== null && !force) return logCache;
  const res = await fetch(LOG_ENDPOINT);
  if (!res.ok) {
    throw new Error(`Failed to load translation log (HTTP ${res.status})`);
  }
  const { text } = await res.json();
  logCache = text || '';
  return logCache;
}

/**
 * Appends text to the translation journal on the server and updates the cache.
 * Throws if the server did not confirm the write, so callers never treat a
 * failed save as successful.
 * @param {string} text
 */
async function appendLog(text) {
  const res = await fetch(LOG_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Failed to save translation log (HTTP ${res.status}): ${body}`);
  }
  logCache = (logCache || '') + text;
}

/**
 * Restores book, firstLine, and lastLine inputs from localStorage
 * and re-triggers the line-loader to repopulate the selector.
 */
export function restoreLineSelector() {
  const cacheJSON = localStorage.getItem('iliadCache');
  if (!cacheJSON) return;
  const { bookNum, firstLine } = JSON.parse(cacheJSON);
  document.getElementById('bookSelector').value = bookNum;
  document.getElementById('firstLineInput').value = firstLine;
  // Re-trigger loading of lines
  document.getElementById('loadBookBtn').click();
}


/**
 * Retrieves the last saved “Original Line” entry from the translation journal.
 * @param {string} raw - the current journal text.
 * @returns {string|null} The last original line text or null if none.
 */
function getLastOriginalLine(raw) {
  const blocks = raw
    .split('===START_BLOCK===')
    .slice(1)
    .map(chunk => chunk.split('===END_BLOCK===')[0].trim());

  if (blocks.length < 1) return null;

  const lastBlock = blocks[blocks.length - 1];
  const match = lastBlock.match(/Original Line:\s*(.*)/);
  return match ? match[1] : null;
}

/**
 * Resolves a word to the lemma its corpus hits are counted under.
 *
 * Clicking a word already resolves this, so the common path is a dataset read;
 * a word the reader checked without ever clicking gets its own lookup here.
 * A failed lookup falls back to the surface form rather than dropping the card.
 *
 * @param {HTMLTableRowElement} tr - the word's row, used as the lemma cache
 * @param {string} word - the Greek word as it appears in the line
 * @param {string|number} [book] - Iliad book number
 * @param {string|number} [line] - line number within that book
 * @returns {Promise<string>}
 */
async function resolveLemma(tr, word, book, line) {
  if (tr.dataset.lemma) return tr.dataset.lemma;
  try {
    const { lemma } = await fetchHits(word, book, line);
    if (lemma) {
      tr.dataset.lemma = lemma;
      return lemma;
    }
    console.warn(`No lemma found for "${word}"; carding the form itself.`);
  } catch (err) {
    console.error(`Lemma lookup failed for "${word}":`, err);
  }
  return word;
}

/**
 * Resolves the parse the treebank records for a word.
 *
 * This replaces the Form column the reader used to fill in by hand: the
 * treebank already knows the parse in context, so it is read from there rather
 * than typed. Cached on the row by the click handler; looked up here for words
 * that were never clicked.
 *
 * @param {HTMLTableRowElement} tr - the word's row, used as the parse cache
 * @param {string} word - the Greek word as it appears in the line
 * @param {string|number} [book] - Iliad book number
 * @param {string|number} [line] - line number within that book
 * @returns {Promise<string>} the parse, or '' if none could be resolved
 */
async function resolveParse(tr, word, book, line) {
  if (tr.dataset.parse) return tr.dataset.parse;
  try {
    const { parses } = await loadMorphoData(word, book, line);
    const parse = parses?.[0]?.parse || '';
    if (parse) tr.dataset.parse = parse;
    return parse;
  } catch (err) {
    console.error(`Parse lookup failed for "${word}":`, err);
    return '';
  }
}

/**
 * Records what one card add did. A card the deck already held is a skip, not a
 * failure — it means the word is already being reviewed.
 */
function tally(cards, result) {
  if (result?.added) cards.added += 1;
  else if (result?.reason === 'duplicate') cards.duplicate += 1;
  else cards.error += 1;
}

/** Summarises a save's Anki export in one line, and says nothing if none ran. */
function reportCards({ added, duplicate, error }) {
  if (!added && !duplicate && !error) return;
  const parts = [`${added} added`];
  if (duplicate) parts.push(`${duplicate} already carded`);
  if (error) parts.push(`${error} failed`);
  console.log(`Anki export: ${parts.join(', ')}.`);
}

/**
 * Gathers translation data from each .line-block, computes timing,
 * and appends formatted markdown blocks to the server-side translation journal.
 */
export async function saveTranslations() {

  let lastLineNumber = 0;
  // 1) Capture the save timestamp
  const saveTime = Date.now();
  // 2) Compute elapsed time since generation
  const elapsed = saveTime - startTime;

  // 3) Collect all generated line-block elements
  const blocks = Array.from(document.querySelectorAll('.line-block'));

  // 4) Count blocks with word entries; abort if none
  const validCount = blocks.filter(block => block.querySelectorAll('tbody tr').length > 0).length;
  if (validCount === 0) return; // nothing to save

  // 5) Calculate average seconds per line
  const secsPerLine = (elapsed / 1000 / validCount).toFixed(2);

  // 6) Build markdown log text for each block
  // Anki export runs as a side effect of saving, so its outcome is summarised
  // at the end rather than interrupting the save line by line.
  const cards = { added: 0, duplicate: 0, error: 0 };
  let logText = '';
  let lastOriginalLine = getLastOriginalLine(await fetchLog());
  let originalLines = '';

  for (const block of blocks) {
    const rows = Array.from(block.querySelectorAll('tbody tr'));
    if (rows.length === 0) continue;
    if (!logText) {
    }
    originalLines = lastOriginalLine + block.dataset.originalLine
    originalLines = `${lastOriginalLine}<br>${block.dataset.originalLine}`;
    lastOriginalLine = block.dataset.originalLine
    
    logText += '===START_BLOCK===\n';
    // metadata
    logText += `Date: ${new Date(saveTime).toISOString()}\n`;
    const bookNum = document.getElementById('bookSelector')?.value;
    if (bookNum) {
      logText += `Book: ${bookNum}\n`;
    }
    if (block.dataset.lineNumber) {
      const num = parseInt(block.dataset.lineNumber, 10);
      logText += `Line Number: ${num}\n`;
      lastLineNumber = num;
    }
    // always include original line
    logText += `Original Line: ${block.dataset.originalLine}\n`;
    // header row for table
    logText += '| Word (Greek) | Word (Translation) | Parse |\n';

    // phrase guess input (only one textarea now)
    const guessArea = block.querySelector('.phrase-input');
    const guess = guessArea ? guessArea.value.trim() : '';


    // each word row
    for (const tr of rows) {
      const [greekTD, transTD] = Array.from(tr.children);
      const greek = greekTD.textContent.trim();
      const translation = transTD.textContent.trim();
      const book = block.dataset.book ?? bookNum;
      // The parse comes from the treebank now rather than a typed Form cell.
      const parse = await resolveParse(tr, greek, book, block.dataset.lineNumber);
      const checkbox = tr.querySelector('.add-to-anki-checkbox');
      if (checkbox?.checked) {
        // Vocabulary is learned per lemma — the same unit the hit counts are
        // reported for — with the inflected form along for the ride.
        const lemma = await resolveLemma(tr, greek, book, block.dataset.lineNumber);
        tally(cards, await addFlashcard({
          lemma,
          form: greek,
          translation,
          originalLines,
          phraseGuess: guess,
        }));
      }
      const conjugationCheckbox = tr.querySelector('.add-to-anki-conjugation-checkbox');
      if (conjugationCheckbox?.checked) {
        tally(cards, await addConjugationFlashcard(originalLines, greek, parse, guess));
      }
      logText += `| ${greek} | ${translation} | ${parse} |\n`;
    }

    // blank line separates the word table from the trailing metadata below
    logText += '\n';

    if (guess) {
      logText += `Phrase Guess: ${guess}\n`;
    }

    // reference (Lattimore) translation, if the user revealed it for this line
    const chunkEl = block.querySelector('.translation-chunk');
    const referenceTranslation = chunkEl
      ? Array.from(chunkEl.querySelectorAll('div')).map(d => d.textContent.trim()).join(' ')
      : '';
    if (referenceTranslation) {
      logText += `Reference Translation: ${referenceTranslation}\n`;
    }

    // tutor analysis, if the user generated one for this line
    const tutorOutput = block.querySelector('.tutor-output');
    const tutorAnalysis = tutorOutput ? tutorOutput.textContent.trim() : '';
    if (tutorAnalysis) {
      logText += `Tutor Analysis:\n${tutorAnalysis}\n`;
    }

    // timing info per line
    logText += `Time Data: ${secsPerLine} seconds per line\n`;
    logText += '===END_BLOCK===\n\n';
  }

  // 7) Report what the Anki export did, if it was asked to do anything
  reportCards(cards);

  // 8) Append new logs to the server-side translation journal file
  await appendLog(logText);

  // 9) Refresh displayed log
  await loadTranslations();

  return lastLineNumber;
}

/**
 * Reads the translation journal from the server and renders the most recent
 * entries into the #translationLog element as formatted tables.
 */
export async function loadTranslations() {
  const raw = await fetchLog(true);
  const logEl = document.getElementById('translationLog');

  // If no logs exist, show placeholder
  if (!raw.trim()) {
    logEl.textContent = 'No translations logged yet.';
    return;
  }

  // Parse raw storage into individual blocks
  const blocks = raw
    .split('===START_BLOCK===')
    .slice(1)
    .map(chunk => chunk.split('===END_BLOCK===')[0].trim());

  // Only render the last 10 blocks
  const lastTen = blocks.slice(-10);

  // Clear existing log display
  logEl.innerHTML = '';

  // Render one translation-block with metadata, table, and details
  lastTen.forEach(block => {
    // Parse lines
    const lines = block.split('\n');
    // Metadata until the table header
    const metaLines = lines.slice(0, lines.findIndex(l => l.startsWith('|')));
    // Table rows between the header and the next blank line
    const tableStart = lines.findIndex(l => l.startsWith('|'));
    const tableEnd = lines.indexOf('', tableStart);
    const tableLines = lines.slice(tableStart, tableEnd > -1 ? tableEnd : lines.length);

    // Remaining lines (phrase, tutor analysis & timing)
    const otherLines = lines.slice(tableEnd > -1 ? tableEnd + 1 : lines.length);

    // Create block container
    const blockEl = document.createElement('div');
    blockEl.className = 'translation-block';

    // Add metadata
    metaLines.forEach(line => {
      const [key, value] = line.split(': ');
      const p = document.createElement('p');
      p.textContent = `${key}: ${value}`;
      blockEl.appendChild(p);
    });

    // Build table grid
    const table = document.createElement('table');
    table.className = 'translation-grid';
    tableLines.forEach((line, idx) => {
      // Skip header separator
      if (idx === 0 && line.startsWith('| Word')) {
        // Create header row
        const headers = line.slice(1).split('|').map(h => h.trim()).filter(text => text);
        const thead = document.createElement('thead');
        const tr = document.createElement('tr');
        headers.forEach(text => {
          const th = document.createElement('th');
          th.textContent = text;
          tr.appendChild(th);
        });
        thead.appendChild(tr);
        table.appendChild(thead);
        return;
      }
      if (!line.startsWith('|')) return;
      // Data rows
      const cells = line.slice(1).split('|').map(c => c.trim()).filter(text => text);
      const tr = document.createElement('tr');
      cells.forEach(text => {
        const td = document.createElement('td');
        td.textContent = text;
        tr.appendChild(td);
      });
      table.appendChild(tr);
    });
    blockEl.appendChild(table);

    // Add phrase and timing info (only show phrase fields if they have content)
    otherLines.forEach(line => {
      if (!line) return;
      // Skip empty Phrase Guess/Actual entries
      if (line.startsWith('Phrase Guess:') && !line.split(':')[1].trim()) return;
      const p = document.createElement('p');
      p.textContent = line;
      blockEl.appendChild(p);
    });

    // Append to log
    logEl.appendChild(blockEl);
  });
}
