/**
 * storage.js
 * Manages saving and loading user translation logs in localStorage,
 * and integrates with the flashcard module for Anki export.
 * Author: Tyler Peairs
 */
// --- App timing and flashcard utilities ---
import { addFlashcard } from './flashcard.js';

// Timing progress import
import { startTime } from './app.js';

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
 * Retrieves the last saved “Original Line” entry from localStorage logs.
 * @returns {string|null} The last original line text or null if none.
 */
function getLastOriginalLine() {
  const raw = localStorage.getItem('translationLines') || '';
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
 * Gathers translation data from each .line-block, computes timing,
 * and appends formatted markdown blocks to localStorage.
 */
export function saveTranslations() {

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
  let logText = '';
  let lastOriginalLine = getLastOriginalLine();
  let originalLines = '';

  blocks.forEach(block => {
    const rows = Array.from(block.querySelectorAll('tbody tr'));
    if (rows.length === 0) return;
    if (!logText) {
    }
    originalLines = lastOriginalLine + block.dataset.originalLine
    originalLines = `${lastOriginalLine}<br>${block.dataset.originalLine}`;
    lastOriginalLine = block.dataset.originalLine
    
    logText += '===START_BLOCK===\n';
    // metadata
    if (block.dataset.lineNumber) {
      const num = parseInt(block.dataset.lineNumber, 10);
      logText += `Line Number: ${num}\n`;
      lastLineNumber = num;
    }
    // always include original line
    logText += `Original Line: ${block.dataset.originalLine}\n`;
    // header row for table
    logText += '| Word (Greek) | Word (Translation) | Form |\n';

    // phrase guess input (only one textarea now)
    const guessArea = block.querySelector('.phrase-input');
    const guess = guessArea ? guessArea.value.trim() : '';


    // each word row
    rows.forEach(tr => {
      const [greekTD, transTD, formTD] = Array.from(tr.children);
      const greek = greekTD.textContent.trim();
      const translation = transTD.textContent.trim();
      const form = formTD.textContent.trim();
      const checkbox = tr.querySelector('.add-to-anki-checkbox');
      if (checkbox?.checked) {

        addFlashcard(originalLines, greek, translation, guess);
      }
      logText += `| ${greek} | ${translation} | ${form} |\n`;
    });

    if (guess) {
      logText += `Phrase Guess: ${guess}\n`;
    }

    // timing info per line
    logText += `Time Data: ${secsPerLine} seconds per line\n`;
    logText += '===END_BLOCK===\n\n';
  });

  // 7) Append new logs to existing storage
  const existing = localStorage.getItem('translationLines') || '';
  localStorage.setItem('translationLines', existing + logText);

  // 8) Refresh displayed log
  loadTranslations();

  return lastLineNumber;
}

/**
 * Reads stored translation logs and renders the most recent entries
 * into the #translationLog element as formatted tables.
 */
export function loadTranslations() {
  const raw = localStorage.getItem('translationLines') || '';
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

    // Remaining lines (phrase & timing)
    const otherLines = lines.slice(tableEnd > -1 ? tableEnd + 1 : tableLines.length);

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
