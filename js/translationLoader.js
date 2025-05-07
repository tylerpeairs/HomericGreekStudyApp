/****
 * Load and cache the Murray translation XML, indexed by book → line number.
 */
const TEI_NS = 'http://www.tei-c.org/ns/1.0';
// Cached translation index: maps book numbers to arrays of {n, text}
let _translationIndex = null;

/**
 * Build a per-book array of translation entries based on <milestone unit="line"/>
 * for every 5th line. Each entry has { n, text }.
 */
async function _buildTranslationIndex() {
  if (_translationIndex) return _translationIndex;
  const resp = await fetch('data/murrayTranslation.xml');
  if (!resp.ok) throw new Error(`Could not load translation XML: ${resp.status}`);
  const xmlText = await resp.text();
  const doc = new DOMParser().parseFromString(xmlText, 'application/xml');
 
  // Find the main translation container
  const transDiv = Array.from(doc.getElementsByTagNameNS(TEI_NS, 'div'))
    .find(el => el.getAttribute('type') === 'translation');
  if (!transDiv) throw new Error('No <div type="translation"> found');
 
  _translationIndex = {};
 
  // For each Book
  const bookEls = Array.from(transDiv.getElementsByTagNameNS(TEI_NS, 'div'))
    .filter(el => el.getAttribute('type') === 'textpart' && el.getAttribute('subtype') === 'book');
  bookEls.forEach(bookEl => {
    const bookNum = bookEl.getAttribute('n');

    // Build entries by walking all nodes and grouping text between 5-line milestones
    const entries = [];
    const walker = document.createTreeWalker(
      bookEl,
      NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
      null,
      false
    );
    let currentEntry = null;

    while (walker.nextNode()) {
      const node = walker.currentNode;
      // On encountering a line milestone:
      if (node.nodeType === Node.ELEMENT_NODE
          && node.localName === 'milestone'
          && node.getAttribute('unit') === 'line') {
        const n = parseInt(node.getAttribute('n'), 10);
        // Only start a new entry at multiples of 5:
        if (n % 5 === 0) {
          // Push the previous entry
          if (currentEntry) entries.push(currentEntry);
          // Begin a new entry
          currentEntry = { n, text: '' };
        }
      }
      // Accumulate text for the current entry
      else if (node.nodeType === Node.TEXT_NODE && currentEntry) {
        currentEntry.text += node.textContent;
      }
    }
    // Push the final entry
    if (currentEntry) entries.push(currentEntry);

    _translationIndex[bookNum] = entries;
  });
 
  return _translationIndex;
}

/**
 * Given a book and a line number, return a single 5-line chunk
 * starting at the nearest lower multiple of 5.
 */
export async function getTranslationChunk(bookNum, lineNum) {
  const idx = await _buildTranslationIndex();
  const list = idx[bookNum] || [];

  // Compute the chunk start: the nearest multiple of 5 ≤ lineNum
  const startLine = Math.floor(lineNum / 5) * 5;
  const endLine = startLine + 5;

  // Gather entries within [startLine, endLine)
  const chunkEntries = list.filter(entry => entry.n >= startLine && entry.n < endLine);

  // Merge their texts into one chunk string
  const combinedText = chunkEntries.map(e => e.text).join(' ').trim();

  // Return single chunk object
  return [{ n: startLine, text: combinedText }];
}