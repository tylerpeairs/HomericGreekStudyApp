/**
 * Test function: adds a note to the "Greek Autoadd" deck using invoke().
 * Front: two lines (originalLine and greekTD)
 * Back: two lines (transTD and formTD)
 */
export function addFlashcard(originalLine, greekTD, transTD, formTD) {
    const note = {
        deckName: "Greek Autoadd",
        modelName: "Basic",
        fields: {
            Front: `${greekTD}<br>${originalLine}`,
            Back: `${transTD}<br>${formTD}`
        },
        options: {
            allowDuplicate: false,
            duplicateScope: "deck",
            duplicateScopeOptions: {
                deckName: "Greek AutoAdd",
                checkChildren: false,
                checkAllModels: false
            }
        },
        tags: ["auto-greek"]
    };

    invoke("addNote", 6, { note })
        .then(result => console.log("Note added successfully:", result))
        .catch(error => console.error("Error adding note:", error));
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

        xhr.open('POST', 'http://127.0.0.1:8765');
        xhr.send(JSON.stringify({action, version, params}));
    });
}