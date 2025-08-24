/**
 * ui.js
 * Renders line blocks for Homeric Greek study:
 *  - Headers with line numbers and text
 *  - Word tables with editable fields and Anki checkboxes
 *  - Phrase‐guess inputs and translation reveal
 *  - Clickable Greek words loading corpus counts & morphology
 */

// --- Data fetch utilities ---
import { fetchResultsLength } from './corpusFetch.js';
import { loadMorphoData, generateMorphoHtml } from './morphoFetch.js';


// --- Translation loader for Murray chunks ---
import { getTranslationChunk } from './translationLoader.js';
import { requestAnalysis } from './analysisLoader.js';

export function createLineBlock(lineNumber, text) {
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
        <th>Add Form to Anki</th>
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
      <td><input type="checkbox" class="add-to-anki-form-checkbox" /></td>
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

  // On click, load and display the 5-line translation chunk
  phraseContainer.querySelector('.translation-btn').addEventListener('click', async () => {
    const bookNum = document.getElementById('bookSelector').value;
    const lineNum = parseInt(block.dataset.lineNumber, 10);
    const output = phraseContainer.querySelector('.translation-chunk');
    output.innerHTML = '<p>Loading translation...</p>';
    try {
      const chunk = await getTranslationChunk(bookNum, lineNum);
      const html = chunk
        .map(c => `<div><strong>${c.n}</strong> ${c.text}</div>`)
        .join('');
      output.innerHTML = html;
      // Add Tutor Analysis button
      const tutorBtn = document.createElement('button');
      tutorBtn.type = 'button';
      tutorBtn.className = 'tutor-btn';
      tutorBtn.textContent = 'Tutor Analysis';
      phraseContainer.appendChild(tutorBtn);
      tutorBtn.addEventListener('click', async () => {
        // Build payload for Tutor Analysis
        const lineNumber = block.dataset.lineNumber;
        const originalLine = block.dataset.originalLine;
        const translationLines = chunk; // use the `chunk` variable from the outer scope
        const words = [];
        table.querySelectorAll('tbody tr').forEach(row => {
          const word = row.querySelector('.morpho-word').textContent;
          const translationGuess = row.children[1].textContent.trim();
          const formGuess = row.children[2].textContent.trim();
          words.push({ word, translationGuess, formGuess });
        });
        const phraseGuess = phraseContainer.querySelector('.phrase-input').value.trim();
        const payload = {
          lineNumber,                         // target line number in the Iliad
          originalLine,                       // Greek text of the target line
          wordGuesses: words,                 // array of objects with { word, translationGuess, formGuess }
          userTranslation: phraseGuess        // the user’s full-phrase translation guess
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
      });
    } catch (err) {
      output.innerHTML = `<p>Error loading translation: ${err.message}</p>`;
    }
  });

  // Metadata for saving
  block.dataset.lineNumber = lineNumber;
  block.dataset.originalLine = text;
  container.appendChild(block);

  // --- Click handlers: load fresh corpus count, morphology, and display in morpho-output ---
  block.querySelectorAll('.morpho-word').forEach(span => {
    span.style.cursor = 'pointer';
    span.addEventListener('click', async () => {
      const word = span.textContent;
      let count, data;
      try {
        [count, data] = await Promise.all([
          fetchResultsLength(word),
          loadMorphoData(word)
        ]);
      } catch {
        count = await fetchResultsLength(word);
        data = null;
      }
      const html = `<p>Corpus hits: ${count}</p>` +
                   (data ? generateMorphoHtml(data) : '<p>Error loading morphology</p>');
      span.closest('.line-block')
          .querySelector('.morpho-output').innerHTML = html;
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
