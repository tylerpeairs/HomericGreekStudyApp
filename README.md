# Homeric Greek Study App

A web-based tool for studying Homer's *Iliad* in the original Greek.

## Table of Contents
- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Usage](#usage)
- [Project Structure](#project-structure)
- [Data](#data)
- [Contributing](#contributing)
- [License](#license)

## Features
- Renders line blocks for Homeric Greek study: headers with line numbers and text; word tables with editable fields and Anki checkboxes; phrase-guess inputs and translation reveal; clickable Greek words loading corpus counts & morphology.【F:js/ui.js†L2-L8】
- Loads Iliad Greek lines from TEI XML file.【F:js/bookLoader.js†L1-L7】
- Loads and caches Lattimore translation XML, indexed by book and line number.【F:js/translationLoader.js†L1-L3】
- Fetches morphological data and definitions via a local Puppeteer proxy server.【F:js/morphoFetch.js†L6-L8】【F:js/server.js†L1-L6】
- Fetches corpus hit counts from ARTFL PHILologic via the Puppeteer proxy server.【F:js/corpusFetch.js†L6-L9】【F:js/server.js†L1-L6】
- Manages translation logs and timing in `localStorage`, with optional Anki export.【F:js/storage.js†L2-L6】【F:js/flashcard.js†L2-L5】

## Prerequisites
- macOS (for shell script and `open`) with [Anki](https://apps.ankiweb.net/) installed.
- [Node.js 22.16.0](https://nodejs.org/) (managed via [nvm](https://github.com/nvm-sh/nvm)).
- Python 3 (for static file server).

## Installation
```bash
git clone <repository-url>
cd HomericGreekStudyApp
nvm install 22.16.0
nvm use 22.16.0
npm install
```

Ensure that the TEI XML files are present in the `data/` directory.

## Usage
### Automated launch (macOS)
Run the helper script to launch Anki, start servers, and open your browser:
```bash
./studyGreek.sh
```
【F:studyGreek.sh†L2-L8】【F:studyGreek.sh†L26-L28】【F:studyGreek.sh†L29-L31】

### Manual steps
```bash
# Start static server on port 8000
python3 -m http.server 8000

# Start the Puppeteer proxy server on port 3001
arch -arm64 node js/server.js

# Open the app in your browser
open http://localhost:8000
```

## Project Structure
```
.
├── css/                   # Stylesheets for the UI
├── data/                  # TEI XML sources (Greek text and translation)
├── js/                    # JavaScript modules (front-end and proxy server)
│   ├── server.js          # Puppeteer proxy service (Express)【F:js/server.js†L1-L6】
│   ├── ui.js              # UI rendering logic【F:js/ui.js†L2-L8】
│   ├── bookLoader.js      # Iliad XML loader【F:js/bookLoader.js†L1-L7】
│   ├── translationLoader.js# Translation XML loader【F:js/translationLoader.js†L1-L3】
│   ├── corpusFetch.js     # ARTFL concordance fetcher【F:js/corpusFetch.js†L6-L9】
│   ├── morphoFetch.js     # Logeion morphology fetcher【F:js/morphoFetch.js†L6-L8】
│   ├── flashcard.js       # AnkiConnect integration【F:js/flashcard.js†L2-L5】
│   └── storage.js         # LocalStorage log & flashcard trigger【F:js/storage.js†L2-L6】
├── index.html             # Entry point for the study UI【F:index.html†L5-L8】
├── studyGreek.sh          # Launch script (Anki, servers & browser)【F:studyGreek.sh†L2-L8】
├── package.json           # Project metadata & dependencies【F:package.json†L2-L6】【F:package.json†L7-L16】
└── README.md              # This file
```

## Data
- `data/illiadGreek.xml`: TEI XML text of Homer's *Iliad*.
- `data/lattimore_translation.xml`: TEI XML of Richmond Lattimore's English translation.

## Contributing
Bug reports and pull requests are welcome. Please follow standard GitHub workflows.

## License
This project is licensed under the ISC License.【F:package.json†L16-L16】