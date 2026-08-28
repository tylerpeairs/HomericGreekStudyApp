/**
 * ui.js
 * Renders line blocks for Homeric Greek study:
 *  - Headers with line numbers and text
 *  - Word tables with editable fields and Anki checkboxes
 *  - Phrase‐guess inputs and translation reveal
 *  - Clickable Greek words loading corpus counts & morphology
 */

// --- Data fetch utilities ---
import { fetchHits } from './corpusFetch.js';
import { LookupUnavailableError } from './lookupClient.js';
import { loadMorphoData, generateMorphoHtml } from './morphoFetch.js';


// --- Translation loader for Murray chunks ---
import { getTranslationChunk } from './translationLoader.js';
import { requestAnalysis } from './analysisLoader.js';

export function createLineBlock(lineNumber, text, bookNumber) {
  const container = document.getElementById('linesContainer');


  // --- Build header (line number + Greek text) ---
  const block = document.createElement('div');
  block.className = 'line-block';

  const header = document.createElement('div');
  header.className = 'line-header';
  header.innerHTML = (lineNumber ? `${lineNumber} ` : '') + text;
  block.appendChild(header);

  // --- Container for corpus & morphology results ---
  const morphoContainer = document.createElement('div');
  morphoContainer.className = 'morpho-output';
  block.appendChild(morphoContainer);

  // --- Word table: split words, strip punctuation, editable cells, Anki checkbox ---
  const table = document.createElement('table');
  table.innerHTML = `
    <thead>
      <tr>
        <th>Word (Greek)</th>
        <th>Word (Translation)</th>
        <th>Form</th>
        <th>Add to Anki</th>
        <th>Add Conjugation to Anki</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;
  const tbody = table.querySelector('tbody');
  text.split(/\s+/).forEach(raw => {
    // Extract only letters and apostrophes (both straight and typographic)
    const match = raw.match(/[\p{L}'’]+/gu);
    if (!match) return; 
    const word = match[0];
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><span lang="grc" class="morpho-word" style="cursor:pointer">${word}</span></td>
      <td contenteditable="true"></td>
      <td contenteditable="true"></td>
      <td><input type="checkbox" class="add-to-anki-checkbox" /></td>
      <td><input type="checkbox" class="add-to-anki-conjugation-checkbox" /></td>
    `;
    tbody.appendChild(tr);
  });
  block.appendChild(table);

  // --- Phrase-guess input & translation reveal controls ---
  const phraseContainer = document.createElement('div');
  phraseContainer.className = 'phrase-container';
  phraseContainer.innerHTML = `
    <label>Phrase Guess:</label>
    <textarea class="phrase-input" rows="2"></textarea>
    <button type="button" class="translation-btn">Show Translation</button>
    <div class="translation-chunk"></div>
  `;
  block.appendChild(phraseContainer);

  // The translation last revealed for this block. Tutor Analysis reads it from
  // here rather than closing over one reveal's result, so re-revealing keeps
  // the two in step.
  let revealedChunk = [];

  /**
   * Adds the Tutor Analysis button, once. "Show Translation" can be clicked
   * any number of times, and the button belongs to the block rather than to a
   * particular reveal.
   */
  function ensureTutorButton() {
    if (phraseContainer.querySelector('.tutor-btn')) return;
    const tutorBtn = document.createElement('button');
    tutorBtn.type = 'button';
    tutorBtn.className = 'tutor-btn';
    tutorBtn.textContent = 'Tutor Analysis';
    phraseContainer.appendChild(tutorBtn);
    tutorBtn.addEventListener('click', onTutorAnalysis);
  }

  /** Sends this line's guesses, with the revealed translation, for feedback. */
  async function onTutorAnalysis() {
    const words = [];
    table.querySelectorAll('tbody tr').forEach(row => {
      const word = row.querySelector('.morpho-word').textContent;
      const translationGuess = row.children[1].textContent.trim();
      const formGuess = row.children[2].textContent.trim();
      words.push({ word, translationGuess, formGuess });
    });
    const payload = {
      lineNumber: block.dataset.lineNumber,   // target line number in the Iliad
      originalLine: block.dataset.originalLine, // Greek text of the target line
      wordGuesses: words,                     // array of { word, translationGuess, formGuess }
      userTranslation: phraseContainer.querySelector('.phrase-input').value.trim(),
      actualTranslation: revealedChunk.map(c => c.text).join(' '),
    };
    try {
      console.log('Tutor Analysis Payload:', payload);
      const analysis = await requestAnalysis(payload);
      console.log('Tutor Analysis Response:', analysis);
      // Display analysis below button
      let outputDiv = phraseContainer.querySelector('.tutor-output');
      if (!outputDiv) {
        outputDiv = document.createElement('div');
        outputDiv.className = 'tutor-output';
        outputDiv.style.whiteSpace = 'pre-wrap';
        phraseContainer.appendChild(outputDiv);
      }
      outputDiv.textContent = analysis;
    } catch (err) {
      console.error('Tutor Analysis Error:', err);
    }
  }

  // On click, load and display the 5-line translation chunk
  phraseContainer.querySelector('.translation-btn').addEventListener('click', async () => {
    // The book this block was generated from — not whatever the selector shows
    // now. Reading the selector at click time resolved against the wrong book
    // whenever it had been changed without regenerating the blocks.
    const bookNum = bookNumber ?? document.getElementById('bookSelector').value;
    const lineNum = parseInt(block.dataset.lineNumber, 10);
    const output = phraseContainer.querySelector('.translation-chunk');
    output.innerHTML = '<p>Loading translation...</p>';
    try {
      const chunk = await getTranslationChunk(bookNum, lineNum);
      revealedChunk = chunk;
      if (chunk.length) {
        output.innerHTML = chunk
          .map(c => `<div><strong>${c.n}</strong> ${c.text}</div>`)
          .join('');
      } else {
        // The translation file stops short in seven books — book 24 ends at 536
        // against the Greek text's 804 — so a missing line is a known gap, not
        // a failure. Rendered as <p> rather than <div> on purpose: storage.js
        // reads this panel's <div> children as the reference translation, and
        // must not log this notice as if it were Lattimore's text.
        output.innerHTML =
          `<p class="translation-missing">No translation available for book ${bookNum}, line ${lineNum}.</p>`;
      }
      ensureTutorButton();
    } catch (err) {
      output.innerHTML = `<p>Error loading translation: ${err.message}</p>`;
    }
  });

  // Metadata for saving
  block.dataset.lineNumber = lineNumber;
  block.dataset.originalLine = text;
  // The book is what lets word lookups use the treebank's in-context parse.
  if (bookNumber != null) block.dataset.book = bookNumber;
  container.appendChild(block);

  // --- Click handlers: load fresh corpus count, morphology, and display in morpho-output ---
  block.querySelectorAll('.morpho-word').forEach(span => {
    span.style.cursor = 'pointer';
    span.addEventListener('click', async () => {
      const word = span.textContent;
      const output = span.closest('.line-block').querySelector('.morpho-output');
      // Both endpoints resolve the inflected form to its lemma themselves, so
      // these no longer have to run in sequence. Settled rather than all: one
      // failing should not discard what the other returned.
      const [hitsResult, dataResult] = await Promise.allSettled([
        fetchHits(word, bookNumber, lineNumber),
        loadMorphoData(word, bookNumber, lineNumber),
      ]);

      // A dead lookup server fails both calls and has one fix, so say that
      // rather than reporting it twice as missing data.
      const serverDown = [hitsResult, dataResult].some(
        r => r.status === 'rejected' && r.reason instanceof LookupUnavailableError
      );
      if (serverDown) {
        output.innerHTML =
          '<p class="lookup-unavailable">Lookup server is not running. '
          + 'Start it with <code>./studyGreek.sh</code>, or <code>node js/server.js</code>.</p>';
        return;
      }

      const hits = hitsResult.status === 'fulfilled' ? hitsResult.value : null;
      const data = dataResult.status === 'fulfilled' ? dataResult.value : null;

      // The vocabulary card is keyed on the lemma, so hold on to the one this
      // lookup resolved; saving falls back to its own lookup for words the
      // reader checked without ever clicking.
      const row = span.closest('tr');
      if (row && hits?.lemma) row.dataset.lemma = hits.lemma;

      let hitsHtml;
      if (!hits) {
        hitsHtml = `<p class="lookup-unavailable">Corpus hits unavailable: ${hitsResult.reason.message}</p>`;
      } else if (!hits.lemma) {
        hitsHtml = `<p>Corpus hits: no lemma found for ${word}</p>`;
      } else {
        hitsHtml = `<p>Corpus hits: <strong>${hits.resultsLength}</strong> in Homer `
                 + `(${hits.lemma} — Iliad ${hits.iliad}, Odyssey ${hits.odyssey})</p>`;
      }

      const html = hitsHtml + (data
        ? generateMorphoHtml(data)
        : `<p class="lookup-unavailable">Morphology unavailable: ${dataResult.reason.message}</p>`);
      output.innerHTML = html;
    });
  });

  const saveContainer = document.getElementById('saveContainer');
  if (saveContainer) {
    saveContainer.style.display = 'block';
  }
}

/**
 * Clears out all generated line blocks.
 */
export function clearLinesContainer() {
  document.getElementById('linesContainer').innerHTML = '';
}
