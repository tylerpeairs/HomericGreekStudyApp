/**
 * flashcard.js
 * AnkiConnect export for the two kinds of card this app makes:
 *  - a vocabulary card, keyed on the lemma (the headword the corpus counts are
 *    reported against), showing the inflected form that prompted it
 *  - a conjugation card, keyed on the inflected form itself, for drilling the
 *    parse of a particular verb form
 */

// The vocabulary deck. Cards here are one-per-lemma: the duplicate check below
// keys on the Front field, so meeting a lemma again in a later line does not
// pile up a second card for the same headword.
const VOCAB_DECK = "Greek Autoadd";
// The conjugation deck. Cards here are one-per-form, so the same lemma may
// legitimately appear many times.
const CONJUGATION_DECK = "Greek Forms";

/** Builds an AnkiConnect note, refusing duplicates within its own deck. */
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
 * Adds a vocabulary card for a word.
 *
 * The front is the lemma alone, rather than the word as it appeared in the
 * line: hits are counted per lemma, so the card that gets reviewed should be
 * the same unit that gets counted, and a bare lemma is what makes the deck's
 * duplicate check collapse later encounters onto the one card. The form that
 * prompted the card and the line it came from move to the back, which keeps
 * the link to where the reader actually met it.
 *
 * @param {object} card
 * @param {string} card.lemma - dictionary headword; the front of the card
 * @param {string} card.form - the inflected form as it appeared in the line
 * @param {string} card.translation - the reader's gloss for the word
 * @param {string} card.originalLines - the Greek line(s) for context
 * @param {string} card.phraseGuess - the reader's translation of the phrase
 */
export function addFlashcard({ lemma, form, translation, originalLines, phraseGuess }) {
    // A lemma spelled the same as the form on the page needs no "as ..." line —
    // it would just repeat the front.
    const formLine = form && form !== lemma ? `as ${form}<br>` : '';
    const note = buildNote(
        VOCAB_DECK,
        lemma,
        `${translation}<br>${formLine}${originalLines}<br>${phraseGuess}`
    );

    invoke("addNote", 6, { note })
        .then(result => console.log("Note added successfully:", result))
        .catch(error => console.error("Error adding note:", error));
}

/**
 * Adds a conjugation card: the inflected form on the front, the reader's parse
 * of it on the back. Unlike the vocabulary card this one stays keyed on the
 * form, since the form is the thing being drilled.
 *
 * @param {string} originalLines - the Greek line(s) for context
 * @param {string} form - the inflected form as it appeared in the line
 * @param {string} formGuess - the reader's parse of that form
 * @param {string} transLine - the reader's translation of the phrase
 */
export function addConjugationFlashcard(originalLines, form, formGuess, transLine) {
    const note = buildNote(
        CONJUGATION_DECK,
        `${form}<br>${originalLines}`,
        `${formGuess}<br>${transLine}`
    );

    invoke("addNote", 6, { note })
        .then(result => console.log("Conjugation note added successfully:", result))
        .catch(error => console.error("Error adding conjugation note:", error));
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