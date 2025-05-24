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
  // console.log("Parsed Murray translation XML");
 
  // Find the main translation container
  const transDiv = Array.from(doc.getElementsByTagNameNS(TEI_NS, 'div'))
    .find(el => el.getAttribute('type') === 'translation');
  if (!transDiv) throw new Error('No <div type="translation"> found');
 
  _translationIndex = {};
 
  // For each Book
  const bookEls = Array.from(transDiv.getElementsByTagNameNS(TEI_NS, 'div'))
    .filter(el => el.getAttribute('type') === 'textpart' && el.getAttribute('subtype') === 'book');
  // console.log(`Found ${bookEls.length} books in translation XML`);
bookEls.forEach(bookEl => {
  const bookNum = bookEl.getAttribute('n');
  // console.log(`Processing book ${bookNum}`);

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
          // Assign pre-milestone text to line 1
          currentEntry.n = 1;
          entries.push(currentEntry);
        } else if (currentEntry && currentEntry.n !== null) {
          entries.push(currentEntry);
        }

        foundFirstMilestone = true;
        currentEntry = { n, text: '' };
      }
    } else if (node.nodeType === Node.TEXT_NODE) {
      if (!currentEntry) {
        currentEntry = { n: null, text: '' };
      }
      currentEntry.text += node.textContent;
    }
  }

  // Push any remaining text
  if (currentEntry && currentEntry.n !== null) {
    entries.push(currentEntry);
  }

  // console.log(`Book ${bookNum} has ${entries.length} translation entries`);
  _translationIndex[bookNum] = entries;
});
 
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