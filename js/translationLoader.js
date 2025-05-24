/****
 * Load and cache the Murray translation XML, indexed by book → line number.
 */
const TEI_NS = 'http://www.tei-c.org/ns/1.0';
// Cached translation index: maps book numbers to arrays of {n, text}
let _translationIndex = null;

/**
 * Fetches and processes a single translation XML file.
 * @param {string} filePath - Path to the XML file.
 * @returns {Promise<object|null>} - A promise that resolves to the file index or null if loading fails.
 */
async function _fetchAndProcessFile(filePath) {
  try {
    const resp = await fetch(filePath);
    if (!resp.ok) {
      console.error(`Could not load translation XML: ${filePath} - Status: ${resp.status}`);
      return null;
    }
    const xmlText = await resp.text();
    const doc = new DOMParser().parseFromString(xmlText, 'application/xml');

    const transDiv = Array.from(doc.getElementsByTagNameNS(TEI_NS, 'div'))
      .find(el => el.getAttribute('type') === 'translation');
    if (!transDiv) {
      console.error(`No <div type="translation"> found in ${filePath}`);
      return null;
    }

    const fileIndex = {};
    const bookEls = Array.from(transDiv.getElementsByTagNameNS(TEI_NS, 'div'))
      .filter(el => el.getAttribute('type') === 'textpart' && el.getAttribute('subtype') === 'book');

    bookEls.forEach(bookEl => {
      const bookNum = bookEl.getAttribute('n');
      const entries = [];
      const walker = document.createTreeWalker(
        bookEl,
        NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
        null,
        false
      );

      let currentEntry = null;
      let foundFirstMilestone = false;

      while (walker.nextNode()) {
        const node = walker.currentNode;

        if (
          node.nodeType === Node.ELEMENT_NODE &&
          node.localName === 'milestone' &&
          node.getAttribute('unit') === 'line'
        ) {
          const n = parseInt(node.getAttribute('n'), 10);
          if (n % 5 === 0) {
            if (!foundFirstMilestone && currentEntry && currentEntry.text.trim()) {
              currentEntry.n = 1; // Assign pre-milestone text to line 1
              entries.push(currentEntry);
            } else if (currentEntry && currentEntry.n !== null) {
              entries.push(currentEntry);
            }
            foundFirstMilestone = true;
            currentEntry = { n, text: '' };
          }
        } else if (node.nodeType === Node.TEXT_NODE) {
          if (!currentEntry) {
            // Handles text before the first milestone (e.g. book title)
            // which we might want to assign to a nominal line number or handle differently.
            // For now, it initializes an entry that will get a line number at the first milestone.
            currentEntry = { n: null, text: '' };
          }
          currentEntry.text += node.textContent;
        }
      }

      if (currentEntry && currentEntry.n !== null) {
        entries.push(currentEntry);
      }
      fileIndex[bookNum] = entries;
    });
    return fileIndex;
  } catch (error) {
    console.error(`Error processing translation XML: ${filePath}`, error);
    return null;
  }
}

/**
 * Build a per-book array of translation entries based on <milestone unit="line"/>
 * for every 5th line. Each entry has { n, text }.
 */
async function _buildTranslationIndex() {
  if (_translationIndex) return _translationIndex;

  _translationIndex = {}; // Initialize

  const murrayIndex = await _fetchAndProcessFile('data/murrayTranslation.xml');
  if (!murrayIndex) {
    throw new Error('Could not load mandatory translation file: data/murrayTranslation.xml');
  }
  _translationIndex = murrayIndex;

  const butlerIndex = await _fetchAndProcessFile('data/butlerTranslation.xml');

  if (butlerIndex) {
    for (const bookNum in butlerIndex) {
      if (butlerIndex.hasOwnProperty(bookNum)) {
        const butlerBookEntries = butlerIndex[bookNum];
        if (_translationIndex[bookNum]) {
          // Book exists in Murray, merge entries
          const murrayBookEntries = _translationIndex[bookNum];
          butlerBookEntries.forEach(butlerEntry => {
            const existingEntry = murrayBookEntries.find(entry => entry.n === butlerEntry.n);
            if (existingEntry) {
              existingEntry.text = butlerEntry.text; // Overwrite
            } else {
              murrayBookEntries.push(butlerEntry); // Add new entry
            }
          });
          // Re-sort if new entries were added
          murrayBookEntries.sort((a, b) => a.n - b.n);
        } else {
          // Book does not exist in Murray, add entirely from Butler
          _translationIndex[bookNum] = butlerBookEntries;
        }
      }
    }
  }
  return _translationIndex;
}

/**
 * Given a book and a line number, return a single 5-line chunk
 * starting at the nearest lower multiple of 5.
 */
export async function getTranslationChunk(bookNum, lineNum) {
  // console.log('getTranslationChunk called with book', bookNum, 'line', lineNum);
  const idx = await _buildTranslationIndex();
  const list = idx[bookNum] || [];
  // console.log('Translation entries for book', bookNum, ':', list.map(e => e.n));

  // Find the nearest entry n value in the list that is less than or equal to lineNum
  const availableLines = list.map(e => e.n).filter(n => n <= lineNum);
  let startLine = Math.floor(lineNum / 5) * 5;
  if (startLine === 0) startLine = 1;
  const endLine = startLine + 4;
  // console.log('Chunk boundaries for line', lineNum, ':', startLine, '-', endLine);

  // Gather entries within [startLine, endLine)
  const chunkEntries = list.filter(entry => entry.n >= startLine && entry.n < endLine);

  // Merge their texts into one chunk string
  const combinedText = chunkEntries.map(e => e.text).join(' ').trim();
  // console.log('Chunk entries lines:', chunkEntries.map(e => e.n));
  // console.log('Combined translation text:', combinedText);

  // Return single chunk object
  return [{ n: startLine, text: combinedText }];
}