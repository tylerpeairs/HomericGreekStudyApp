// Core UI and storage modules
import { createLineBlock, clearLinesContainer } from './ui.js';
import { saveTranslations, loadTranslations, restoreLineSelector } from './storage.js';

// Data loaders
import { loadBookWindow } from './bookLoader.js';

export let startTime;



function initializeApp() {
  // --- Translation log controls ---
  document.getElementById('saveBtn').addEventListener('click', () => {
    // Save translations and get the highest saved line number
    const lastLine = saveTranslations();
    // Advance the selector window to the next batch of lines
    const firstInput = document.getElementById('firstLineInput');
    firstInput.value = lastLine + 1;
    // Reload the selector to show the next window
    document.getElementById('loadBookBtn').click();
  });
  
    // Toggle translation log visibility
    const toggleBtn = document.getElementById('toggleLogBtn');
    toggleBtn.addEventListener('click', () => {
      const logEl = document.getElementById('logContainer');
      if (logEl.style.display === 'none') {
        logEl.style.display = 'block';
        loadTranslations();
        toggleBtn.textContent = '❌';
        toggleBtn.title = 'Hide Translation Log';
      } else {
        logEl.style.display = 'none';
        toggleBtn.textContent = '📜';
        toggleBtn.title = 'Show Translation Log';
      }
    });
  

  // --- Iliad Book/Range Loader ---
  document.getElementById('loadBookBtn').addEventListener('click', async () => {
    clearLinesContainer();

    const bookNum    = document.getElementById('bookSelector').value;
    let firstLine    = parseInt(document.getElementById('firstLineInput').value, 10);

    if (!bookNum || isNaN(firstLine)) {
      return alert('Please pick a book and first line.');
    }

    // Load the window of 15 lines for this book starting at firstLine
    const window = await loadBookWindow(bookNum, firstLine, firstLine + 14, 15);

    // 4) Populate the selector list
    const container = document.getElementById('line-selector');
    container.innerHTML = window.map(({n,text}) => `
  <div class="line-item" data-n="${n}" data-text="${text}">
    ${n}. ${text}
  </div>
    `).join('');

    // Auto-select lines leading up to (and including) the first ASCII period '.'
    const autoItems = Array.from(container.querySelectorAll('.line-item'));
    for (const autoItem of autoItems) {
      const text = autoItem.getAttribute('data-text');
      if (text.includes('·')) {
        autoItem.classList.add('selected');
        break;
      }
      autoItem.classList.add('selected');
    }

    // Drag-range contiguous selection: click and drag to select a block of lines
    const items = Array.from(container.querySelectorAll('.line-item'));
    let isMouseDown = false;
    let dragStartIndex = null;

    // Prevent text selection during drag
    container.style.userSelect = 'none';

    items.forEach((item, idx) => {
      // Start drag-selection on mousedown
      item.addEventListener('mousedown', e => {
        isMouseDown = true;
        dragStartIndex = idx;
        // Clear previous selection
        items.forEach(i => i.classList.remove('selected'));
        // Select the start item
        item.classList.add('selected');
        e.preventDefault();
      });

      // Expand or contract selection on mouseover while dragging
      item.addEventListener('mouseover', () => {
        if (!isMouseDown || dragStartIndex === null) return;
        const start = Math.min(dragStartIndex, idx);
        const end = Math.max(dragStartIndex, idx);
        items.forEach((i, j) => {
          if (j >= start && j <= end) {
            i.classList.add('selected');
          } else {
            i.classList.remove('selected');
          }
        });
      });
    });

    // End drag-selection on mouseup
    document.addEventListener('mouseup', () => {
      isMouseDown = false;
      dragStartIndex = null;
    });

    // Cache current loader state
    localStorage.setItem('iliadCache', JSON.stringify({ bookNum, firstLine }));
  });

  // --- Generate Grids for Selected Lines ---
  document.getElementById('generateSelectedBtn').addEventListener('click', () => {
    // Find all highlighted items instead of checkboxes
    const selected = Array.from(
      document.querySelectorAll('#line-selector .line-item.selected')
    );
    startTime = Date.now()
    if (!selected.length) return alert('Select at least one line to generate.');
    clearLinesContainer();
    selected.forEach(item => {
      const n = item.getAttribute('data-n');
      const text = item.getAttribute('data-text');
      // Create the line block (row)
      const row = createLineBlock(n, text);
      // Add the "Add Formless to Anki" column (checkbox)
      if (row && row.querySelector) {
        // Try to find the table row; if createLineBlock returns the tr, append td; if not, try to find it
        let tr = row;
        // If row is not a tr, try to find tr inside row
        if (!(tr instanceof HTMLTableRowElement)) {
          tr = row.querySelector && row.querySelector('tr') ? row.querySelector('tr') : null;
        }
        if (tr) {
          const td = document.createElement('td');
          td.className = 'anki-form-col';
          const checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.className = 'anki-form-checkbox';
          checkbox.title = 'Add Form to Anki';
          td.appendChild(checkbox);
          tr.appendChild(td);
        }
      }
    });
  });

  // On app load, restore previous book and line range
  restoreLineSelector();
}

// Bootstrap our app
initializeApp();