/**
 * flashcard.js
 * AnkiConnect export for the two kinds of card this app makes:
 *  - a vocabulary card, keyed on the lemma (the headword the corpus counts are
 *    reported against), showing the inflected form that prompted it
 *  - a conjugation card, keyed on the inflected form itself, for drilling the
 *    parse of a particular verb form
 *
 * Both check the deck before writing. Anki's own duplicate check compares the
 * whole Front field, which now carries the context lines, so it only catches
 * the very same word checked twice in the very same passage — meeting a word
 * again fifty lines later slipped straight past it. The check here compares
 * only the prompt, which is the thing you are actually being asked to know.
 */

// The vocabulary deck, one card per lemma.
const VOCAB_DECK = "Greek Vocabulary";
// The conjugation deck, one card per inflected form — the same lemma
// legitimately appears here many times, once per form being drilled.
const CONJUGATION_DECK = "Greek Forms";

/** Builds an AnkiConnect note. Duplicates are caught by findExistingNote first. */
function buildNote(deckName, front, back) {
    return {
        deckName,
        modelName: "Basic",
        fields: { Front: front, Back: back },
        options: {
            allowDuplicate: false,
            duplicateScope: "deck",
            duplicateScopeOptions: {
                deckName,
                checkChildren: false,
                checkAllModels: false
            }
        },
        tags: ["auto-greek"]
    };
}

/**
 * Escapes the characters Anki's search parser treats as syntax, so a prompt is
 * matched literally.
 */
function escapeSearch(text) {
    return String(text).replace(/[\\"*_:()-]/g, '\\$&');
}

/**
 * Puts a prompt in the form the deck stores it in.
 *
 * Composition only — accents and breathings are left alone, because they are
 * what separates τίς from τις. Anki normalizes fields to NFC on the way in, so
 * a decomposed word out of the TEI has to be composed to match one.
 */
function normalizePrompt(text) {
    return String(text ?? '').normalize('NFC').trim();
}

/**
 * The prompts a card's Front field answers to.
 *
 * Three shapes live in the deck. Cards this app writes lead with the prompt and
 * put the context lines below it; older ones are the bare prompt with nothing
 * after it; hand-written ones sometimes gather related headwords onto the one
 * line, "ὄπισθε / ὄπισθεν / ὀπίσσω". All three are read here as the set of
 * words that card already covers.
 */
function promptsOf(front) {
    const firstLine = String(front).split(/<br\s*\/?>/i)[0];
    return firstLine
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/gi, ' ')
        .split('/')
        .map(part => normalizePrompt(part))
        .filter(Boolean);
}

/**
 * Finds a card in `deckName` that already prompts for `prompt`.
 *
 * The search is a substring match over the whole Front field, and the boundary
 * is then checked here: a prefix search would answer from Anki's index, but it
 * cannot see a word sitting third on a hand-written "a / b / c" card. Widening
 * the search and narrowing it in promptsOf catches those without letting "θεά"
 * count as carded because the deck holds "θεάομαι".
 *
 * @returns {Promise<number|null>} the existing note's id, or null
 */
async function findExistingNote(deckName, prompt) {
    const key = normalizePrompt(prompt);
    if (!key) return null;

    const query = `deck:"${escapeSearch(deckName)}" "Front:*${escapeSearch(key)}*"`;
    const candidates = await invoke("findNotes", 6, { query });
    if (!candidates.length) return null;

    // The substring match is deliberately loose, so confirm against the real field.
    const notes = await invoke("notesInfo", 6, { notes: candidates });
    const hit = notes.find(note => promptsOf(note.fields?.Front?.value ?? "").includes(key));
    return hit ? hit.noteId : null;
}

/**
 * Adds `note` unless its prompt is already carded in the same deck.
 *
 * A dedupe check that cannot reach Anki falls through to the add rather than
 * silently dropping the card: if the server really is down, addNote reports it,
 * and if it is not, a duplicate is a smaller loss than a card never written.
 *
 * @param {object} note - the AnkiConnect note to add
 * @param {string} prompt - the word the card asks about
 * @returns {Promise<{added: boolean, noteId: number|null, reason?: string}>}
 */
async function addUnlessCarded(note, prompt) {
    try {
        const existing = await findExistingNote(note.deckName, prompt);
        if (existing !== null) {
            console.log(`Skipped "${prompt}": already in ${note.deckName} (note ${existing})`);
            return { added: false, noteId: existing, reason: "duplicate" };
        }
    } catch (error) {
        console.error(`Duplicate check failed for "${prompt}", adding anyway:`, error);
    }

    try {
        const noteId = await invoke("addNote", 6, { note });
        console.log(`Added "${prompt}" to ${note.deckName} (note ${noteId})`);
        return { added: true, noteId };
    } catch (error) {
        console.error(`Error adding "${prompt}" to ${note.deckName}:`, error);
        return { added: false, noteId: null, reason: "error" };
    }
}

/**
 * Adds a vocabulary card for a word.
 *
 * The prompt is the lemma rather than the word as it appeared in the line:
 * hits are counted per lemma, so the card that gets reviewed is the same unit
 * that gets counted. It sits above the untranslated Greek, which stays on the
 * front — the lines are the context you recall the word from, not part of the
 * answer. The back is what you were trying to produce: the gloss, the inflected
 * form the lemma turned up as, and your reading of the phrase.
 *
 * @param {object} card
 * @param {string} card.lemma - dictionary headword; the card's prompt
 * @param {string} card.form - the inflected form as it appeared in the line
 * @param {string} card.translation - the reader's gloss for the word
 * @param {string} card.originalLines - the untranslated Greek, for context
 * @param {string} card.phraseGuess - the reader's translation of the phrase
 * @returns {Promise<{added: boolean, noteId: number|null, reason?: string}>}
 */
export async function addFlashcard({ lemma, form, translation, originalLines, phraseGuess }) {
    // A lemma spelled the same as the form on the page needs no "as ..." line —
    // it would just repeat the prompt.
    const formLine = form && form !== lemma ? `as ${form}<br>` : '';
    const note = buildNote(
        VOCAB_DECK,
        `${lemma}<br>${originalLines}`,
        `${translation}<br>${formLine}${phraseGuess}`
    );

    return addUnlessCarded(note, lemma);
}

/**
 * Adds a conjugation card: the inflected form on the front, its parse on the
 * back. Unlike the vocabulary card this one stays keyed on the form, since the
 * form is the thing being drilled.
 *
 * @param {string} originalLines - the Greek line(s) for context
 * @param {string} form - the inflected form as it appeared in the line
 * @param {string} parse - the treebank's parse of that form in context
 * @param {string} transLine - the reader's translation of the phrase
 * @returns {Promise<{added: boolean, noteId: number|null, reason?: string}>}
 */
export async function addConjugationFlashcard(originalLines, form, parse, transLine) {
    const note = buildNote(
        CONJUGATION_DECK,
        `${form}<br>${originalLines}`,
        `${parse}<br>${transLine}`
    );

    return addUnlessCarded(note, form);
}

/**
 * Placeholder: gathers all words with checked 'Add to Anki' boxes.
 * This will later be used to build flashcards.
 */


export function invoke(action, version, params={}) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.addEventListener('error', () => reject('failed to issue request'));
        xhr.addEventListener('load', () => {
            try {
                console.log('Raw response:', xhr.responseText); // Log raw response
                const response = JSON.parse(xhr.responseText);
                if (Object.getOwnPropertyNames(response).length != 2) {
                    throw 'response has an unexpected number of fields';
                }
                if (!response.hasOwnProperty('error')) {
                    throw 'response is missing required error field';
                }
                if (!response.hasOwnProperty('result')) {
                    throw 'response is missing required result field';
                }
                if (response.error) {
                    throw response.error;
                }
                resolve(response.result);
            } catch (e) {
                reject(e);
            }
        });

        console.log('Sending request:', { action, version, params }); // Log request details
        xhr.open('POST', 'http://127.0.0.1:8765');
        xhr.send(JSON.stringify({action, version, params}));
    });
}