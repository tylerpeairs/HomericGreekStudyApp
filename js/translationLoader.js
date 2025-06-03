/****
 * Load and cache the Lattimore translation XML, indexed by book → line number.
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
    console.log(`[translationLoader] Fetching XML from: ${filePath}`);
    const resp = await fetch(filePath);
    if (!resp.ok) {
      console.error(`Could not load translation XML: ${filePath} - Status: ${resp.status}`);
      return null;
    }
    const xmlText = await resp.text();
    const doc = new DOMParser().parseFromString(xmlText, 'application/xml');
    console.log('[translationLoader] XML parsed, searching for <div type="translation">');

    const transDiv = Array.from(doc.getElementsByTagNameNS(TEI_NS, 'div'))
      .find(el => el.getAttribute('type') === 'translation');
    if (!transDiv) {
      console.error(`No <div type="translation"> found in ${filePath}`);
      return null;
    }
    console.log('[translationLoader] Found translation div, processing books...');

    const fileIndex = {};
    const bookEls = Array.from(transDiv.getElementsByTagNameNS(TEI_NS, 'div'))
      .filter(el => el.getAttribute('type') === 'textpart' && el.getAttribute('subtype') === 'book');

    bookEls.forEach(bookEl => {
      const bookNum = bookEl.getAttribute('n');
      console.log(`[translationLoader] Processing book number: ${bookNum}`);
      const entries = [];
      // Find all milestone elements and their corresponding text siblings
      const msEls = bookEl.getElementsByTagNameNS(TEI_NS, 'milestone');
      Array.from(msEls).forEach(msEl => {
        const n = parseInt(msEl.getAttribute('n'), 10);
        // Find the next TEI <text> element sibling
        let textEl = msEl.nextElementSibling;
        while (textEl && (textEl.namespaceURI !== TEI_NS || textEl.localName !== 'text')) {
          textEl = textEl.nextElementSibling;
        }
        const lineText = textEl ? textEl.getAttribute('text') || textEl.textContent.trim() : '';
        entries.push({ n, text: lineText });
      });
      console.log(`[translationLoader] Book ${bookNum} has ${entries.length} entries`);
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
  _translationIndex = await _fetchAndProcessFile('data/lattimore_translation.xml');
  if (!_translationIndex) {
    throw new Error('Could not load Lattimore translation file: data/lattimore_translation.xml');
  }
  console.log('[translationLoader] Translation index built for books:', Object.keys(_translationIndex));
  return _translationIndex;
}

/**
 * Given a book and a line number, return the exact matching translation entry.
 */
export async function getTranslationChunk(bookNum, lineNum) {
  console.log(`[translationLoader] getTranslationChunk called for book ${bookNum}, line ${lineNum}`);
  const idx = await _buildTranslationIndex();
  const entries = idx[bookNum] || [];
  const entry = entries.find(e => e.n === lineNum);
  console.log(entry ? '[translationLoader] Found entry:' : '[translationLoader] No entry found');
  if (entry) {
    return [entry];
  } else {
    return [];
  }
}