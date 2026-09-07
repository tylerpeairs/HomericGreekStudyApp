# Homeric Greek Study App

A local web app for working through Homer's *Iliad* in the original Greek, line by line.

You pick a range of lines, translate them yourself, and check your work. Click any Greek word
for its parse, gloss, and how often its lemma appears in Homer. Save a session and it appends
to a translation journal on disk; tick a box and the word becomes an Anki card.

## Contents

- [What it does](#what-it-does)
- [Requirements](#requirements)
- [Setup](#setup)
- [Running it](#running-it)
- [How word lookup works](#how-word-lookup-works)
- [API](#api)
- [Project layout](#project-layout)
- [Data and sources](#data-and-sources)
- [Maintenance](#maintenance)
- [License](#license)

## What it does

**Reading.** Loads Iliad lines from TEI XML, fifteen at a time, and lets you drag-select a
range to work on. Each selected line becomes a block with a word-by-word table.

**Word lookup.** Clicking a Greek word gives you its lemma, a morphological parse, a short
definition, and its frequency in the Iliad and Odyssey. This is served from a local index and
takes about a millisecond — see [How word lookup works](#how-word-lookup-works).

**Translation practice.** Type your rendering of each word and of the phrase as a whole, then
reveal Lattimore's translation to compare. Timing starts when you generate the grids.

**Tutor feedback.** Submit your attempt and an OpenAI-backed endpoint returns corrections to
your morphology, notes on syntax, a literal translation, and a study tip. It streams, so the
first lines appear in about a second and a half.

**Journal and flashcards.** Saved sessions append to `data/translationJournal.md` on disk.
Checked words export to Anki over AnkiConnect: *Add to Anki* makes a vocabulary card prompted
by the word's lemma — the same unit the hit counts are reported for — over the untranslated
Greek for context, with your gloss and the inflected form on the back. *Add Conjugation to
Anki* makes a card fronted by the inflected form itself, backed by the treebank's parse of it
in context. Both check the deck first and skip a word already carded, matching on the prompt
alone so that meeting a word again in a later passage does not make a second card for it.

Clicking a word fills its translation cell with the dictionary gloss, unless you have already
written something there — checking an answer never overwrites it.

## Requirements

- macOS, for `studyGreek.sh` and `open`. The app itself is platform-agnostic.
- [Node.js 22.16.0](https://nodejs.org/), managed via [nvm](https://github.com/nvm-sh/nvm).
- Python 3, for the static file server.
- [Anki](https://apps.ankiweb.net/) with AnkiConnect, for flashcard export. Optional.
- An OpenAI API key, for tutor analysis. Optional — everything else works without it.

## Setup

```bash
git clone https://github.com/tylerpeairs/HomericGreekStudyApp
cd HomericGreekStudyApp
nvm install 22.16.0
nvm use 22.16.0
npm install
npm run build:index
```

Then create a `.env` in the project root:

```
OPENAI_API_KEY=your_openai_api_key_here
```

`npm run build:index` downloads the Perseus Homer treebanks and a short-definition list into
`data/sources/` (~40MB), then writes `data/homerIndex.json` (~9MB). Both are gitignored, so
this runs once after cloning — takes about six seconds. **The server will not start without
the index**; it exits with a one-line message telling you to run this.

The build prints a coverage report over every clickable word in the Iliad:

```
Alignment over 111,895 clickable Iliad words:
  in-context parse available  99.16%
  resolved by form map        99.68%
  + elision split             99.99%
```

It fails loudly if coverage regresses, which would mean an upstream source changed shape.

## Running it

```bash
./studyGreek.sh
```

This frees ports 8000 and 3001, launches Anki, starts both servers, and opens the browser.
Note that it kills whatever is already on those ports.

Manually:

```bash
python3 -m http.server 8000
```

```bash
arch -arm64 node js/server.js
```

Then open <http://localhost:8000>.

## How word lookup works

Word lookup used to scrape ARTFL PhiloLogic and Logeion through headless Chromium, which cost
seconds per click and needed network. It now reads a local index instead.

The index is built from the [Perseus Ancient Greek Dependency Treebank](https://github.com/PerseusDL/treebank_data),
where every token in the Iliad and Odyssey is annotated with a lemma and a nine-character
Perseus postag:

```xml
<word id="1" form="μῆνιν" lemma="μῆνις" postag="n-s---fa-" cite="...tlg0012.tlg001:1.1"/>
```

Frequency is a count over those tokens. The parse is the treebank's own annotation of that
exact line, so an ambiguous form arrives already disambiguated rather than as a list of
everything it could theoretically be. Glosses come from the Alpheios short-definition list,
extended with the senses and proper nouns Perseus' LSJ adds — the curated gloss always
leads, because an automatic read of LSJ picks the wrong homonym often enough to matter.

A clicked word resolves in three steps:

1. **In-context** — match against the treebank's tokens for that book and line. Covers 98.9%
   of words, and is the only path that yields a disambiguated parse.
2. **Form map** — match against every form attested anywhere in Homer.
3. **Elision split** — the treebank annotates elided compounds as two tokens (`οὐδʼ` as
   οὐ + δέ) while the UI treats them as one word, so the key is split and both halves resolved.

Anything still unresolved returns an explicit "no lemma found" rather than a silent zero.
Across books 1, 9, and 24 — 15,601 words — two fail to resolve, both places where the
treebank's text differs from the Monro-Allen edition this app ships.

### Counts differ from ARTFL, deliberately

`npm run verify:index` compares local lemma counts against ARTFL. They do not match exactly,
because the two are different lemmatizations of Homer:

- **ARTFL merges homographs the treebank keeps apart.** `Ἄλκιμος` the name (3) and `ἄλκιμος`
  "brave" (48) are one headword to ARTFL, totalling its 51.
- **The treebank splits elided compounds.** Annotating `οὐδʼ` as οὐ + δέ inflates δέ by ~1,290
  and οὐ by ~1,232 while deflating οὐδέ by ~1,011 and μηδέ by ~88.

The verify script labels both categories instead of reporting them as failures.

One consequence worth knowing while reading: clicking `οὐδʼ` reports οὐδέ as occurring 94
times. The gloss is right, but the frequency undercounts, because most instances are annotated
as two separate words.

## API

The server on port 3001 exposes:

| Endpoint | Purpose |
| --- | --- |
| `GET /api/hits?word=&book=&line=` | Lemma frequency across Homer |
| `GET /api/lookup?word=&book=&line=` | Parses and short definitions |
| `GET /api/concordance?lemma=&limit=` | Every line in Homer where a lemma occurs |
| `POST /api/tutor-analysis` | Tutor feedback on a translation attempt, streamed as server-sent events |
| `GET`/`POST /api/translation-log` | Read and append the translation journal |

`book` and `line` are optional everywhere they appear, but passing them is what enables the
in-context parse.

Only `/api/tutor-analysis` makes an outbound call. Word lookup works with the network off.

## Project layout

```
.
├── css/styles.css              # UI styles
├── data/                       # Texts and generated index
├── js/
│   ├── server.js               # Express: lookup, concordance, tutor analysis, journal
│   ├── homerIndex.js           # In-memory lookup + Perseus postag decoding
│   ├── greekNormalize.js       # Form normalization and elision splitting
│   ├── app.js                  # Bootstrap and loader controls
│   ├── ui.js                   # Line blocks, word tables, click handlers
│   ├── bookLoader.js           # Iliad TEI reader
│   ├── translationLoader.js    # Lattimore translation, indexed by book → line
│   ├── corpusFetch.js          # Frequency client, localStorage-cached
│   ├── morphoFetch.js          # Morphology client, localStorage-cached
│   ├── analysisLoader.js       # Tutor-analysis client
│   ├── storage.js              # Journal save/load, flashcard trigger
│   └── flashcard.js            # AnkiConnect integration
├── scripts/
│   ├── buildHomerIndex.js      # Builds data/homerIndex.json
│   └── verifyHomerIndex.js     # Compares lemma counts against ARTFL
├── index.html
├── studyGreek.sh               # Launch Anki, both servers, and the browser
└── package.json
```

## Data and sources

Committed:

- `data/illiadGreek.xml` — Homer's *Iliad*, Monro–Allen text, Perseus TEI.
- `data/lattimore_translation.xml` — Richmond Lattimore's English translation, TEI.
- `data/translationJournal.md` — your saved translations. Gitignored.

Downloaded by `npm run build:index`, gitignored:

- `data/homerIndex.json` — the generated lookup index.
- `data/sources/` — Homer treebanks from
  [PerseusDL/treebank_data](https://github.com/PerseusDL/treebank_data) (Ancient Greek
  Dependency Treebank, CC BY-SA), short definitions from
  [alpheios-project/majorplus](https://github.com/alpheios-project/majorplus), and LSJ from
  [PerseusDL/lexica](https://github.com/PerseusDL/lexica) (CC BY-SA). LSJ is 28 volumes and
  about 300MB; `npm run build:index` downloads it once into the gitignored `data/sources/`.

## Maintenance

```bash
npm run build:index
```

Rebuilds the index. Sources already in `data/sources/` are reused, so a rebuild is fast.
Delete that directory to force a fresh download.

```bash
npm run verify:index
```

Spot-checks 40 lemmas against ARTFL, sampled across the frequency range. Pass `-- --sample N`
for a different sample size. Read the results with the caveats in
[Counts differ from ARTFL](#counts-differ-from-artfl-deliberately) in mind.

Word lookups are deliberately **not** cached in the browser. The index answers in about a
millisecond, so a cache saves nothing measurable while creating a way for the UI to show
results from a previous build. If you change a lookup response shape, no cache invalidation
is needed — but do hard-reload, since browsers cache the ES modules themselves.

## Contributing

Bug reports and pull requests welcome.

## License

ISC.
