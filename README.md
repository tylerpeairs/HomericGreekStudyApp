# Homeric Greek Study App

A web-based tool for studying Homer's *Iliad* in the original Greek.

## Table of Contents
- [Features](#features)
- [Prerequisites](#prerequisites)
- [Configuration](#configuration)
- [Installation](#installation)
- [Usage](#usage)
- [Project Structure](#project-structure)
- [Data](#data)
- [Contributing](#contributing)
- [License](#license)

## Features
- Renders line blocks for Homeric Greek study: headers with line numbers and text; word tables with editable fields and Anki checkboxes; phrase-guess inputs and translation reveal; clickable Greek words loading corpus counts & morphology.
- Loads Iliad Greek lines from TEI XML file.
- Loads and caches Lattimore translation XML, indexed by book and line number.
- Offline word lookup from a local index built on the Perseus Homer treebanks: lemma
  frequency across the Iliad and Odyssey, the morphological parse the treebank records
  for that exact token, and a short definition. Lookups take about a millisecond and
  need no network.
- Manages translation logs and timing in `localStorage`, with optional Anki export.
- AI-powered tutor analysis: users submit their translation guesses and receive detailed feedback on translation accuracy, morphology, and syntax.

## Prerequisites
- macOS (for shell script and `open`) with [Anki](https://apps.ankiweb.net/) installed.
- [Node.js 22.16.0](https://nodejs.org/) (managed via [nvm](https://github.com/nvm-sh/nvm)).
- Python 3 (for static file server).
- An OpenAI API key, for the tutor-analysis endpoint (set via `OPENAI_API_KEY`)

## Configuration
1. Obtain your OpenAI API key from your OpenAI account dashboard.
2. Create a `.env` file in the project root with the following content:
   ```
   OPENAI_API_KEY=your_openai_api_key_here
   ```
3. Ensure your server loads this environment variable (e.g., via `dotenv`).

## Installation
```bash
git clone <repository-url>
cd HomericGreekStudyApp
nvm install 22.16.0
nvm use 22.16.0
npm install
npm run build:index
```

Ensure that the TEI XML files are present in the `data/` directory.

`npm run build:index` downloads the Perseus treebanks and the short-definition list into
`data/sources/` and writes `data/homerIndex.json` (~9MB). Both are gitignored, so run it
once after cloning — the server refuses to start without the index. It prints a coverage
report; expect ~99.7% of clickable Iliad words to resolve directly and ~100% once elided
compounds are split.

`npm run verify:index` spot-checks local lemma counts against ARTFL PhiloLogic. Some
divergence is expected: the treebank and ARTFL are two different lemmatizations of Homer.
ARTFL merges homographs the treebank keeps apart (Ἄλκιμος the name vs ἄλκιμος "brave"), and
the treebank annotates elided compounds as two tokens (οὐδʼ = οὐ + δέ) where ARTFL keeps
them whole. The script labels both cases rather than reporting them as errors.

## Usage
### Automated launch (macOS)
Run the helper script to launch Anki, start servers, and open your browser:
```bash
./studyGreek.sh
```

### Manual steps
```bash
# Start static server on port 8000
python3 -m http.server 8000

# Start the lookup and tutor-analysis server on port 3001
arch -arm64 node js/server.js

# Open the app in your browser
open http://localhost:8000
```

## Project Structure
```
.
├── css/                   # Stylesheets for the UI
├── data/                  # TEI XML sources (Greek text and translation)
├── js/                    # JavaScript modules (front-end and lookup server)
│   ├── server.js          # Word lookup and AI tutor-analysis service (Express)
│   ├── homerIndex.js      # Offline lookup over the Perseus treebank index
│   ├── greekNormalize.js  # Shared form normalization and elision splitting
│   ├── ui.js              # UI rendering logic
│   ├── bookLoader.js      # Iliad XML loader
│   ├── translationLoader.js# Translation XML loader
│   ├── corpusFetch.js     # Lemma frequency fetcher
│   ├── morphoFetch.js     # Morphology & definition fetcher
│   ├── flashcard.js       # AnkiConnect integration
│   └── storage.js         # LocalStorage log & flashcard trigger
├── scripts/
│   ├── buildHomerIndex.js # Builds data/homerIndex.json from public sources
│   └── verifyHomerIndex.js# Spot-checks lemma counts against ARTFL
├── index.html             # Entry point for the study UI
├── studyGreek.sh          # Launch script (Anki, servers & browser)
├── package.json           # Project metadata & dependencies
└── README.md              # This file
```

## Data
- `data/illiadGreek.xml`: TEI XML text of Homer's *Iliad*.
- `data/lattimore_translation.xml`: TEI XML of Richmond Lattimore's English translation.
- `data/homerIndex.json`: generated word-lookup index (gitignored, see Installation).
- `data/sources/`: downloaded inputs to that index (gitignored):
  - Homer treebanks from [PerseusDL/treebank_data](https://github.com/PerseusDL/treebank_data),
    the Ancient Greek Dependency Treebank (CC BY-SA) — every token annotated with a lemma
    and a nine-character Perseus postag.
  - Short definitions from [alpheios-project/majorplus](https://github.com/alpheios-project/majorplus).

## Contributing
Bug reports and pull requests are welcome. Please follow standard GitHub workflows.

## License
This project is licensed under the ISC License.【F:package.json†L16-L16】
