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
- Fetches morphological data and definitions via a local Puppeteer proxy server.
- Fetches corpus hit counts from ARTFL PHILologic via the Puppeteer proxy server.
- Manages translation logs and timing in `localStorage`, with optional Anki export.
- AI-powered tutor analysis: users submit their translation guesses and receive detailed feedback on translation accuracy, morphology, and syntax.

## Prerequisites
- macOS (for shell script and `open`) with [Anki](https://apps.ankiweb.net/) installed.
- [Node.js 22.16.0](https://nodejs.org/) (managed via [nvm](https://github.com/nvm-sh/nvm)).
- Python 3 (for static file server).
- A Lambda Labs API key (set via the `LAMBDA_API_KEY` environment variable)

## Configuration
1. Obtain your Lambda Labs API key from your Lambda account dashboard.
2. Create a `.env` file in the project root with the following content:
   ```
   LAMBDA_API_KEY=your_lambda_api_key_here
   ```
3. Ensure your server loads this environment variable (e.g., via `dotenv`).

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

### Manual steps
```bash
# Start static server on port 8000
python3 -m http.server 8000

# Start the Puppeteer proxy and tutor-analysis server on port 3001
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
│   ├── server.js          # Puppeteer proxy and AI tutor-analysis service (Express)
│   ├── ui.js              # UI rendering logic
│   ├── bookLoader.js      # Iliad XML loader
│   ├── translationLoader.js# Translation XML loader
│   ├── corpusFetch.js     # ARTFL concordance fetcher
│   ├── morphoFetch.js     # Logeion morphology fetcher
│   ├── flashcard.js       # AnkiConnect integration
│   └── storage.js         # LocalStorage log & flashcard trigger
├── index.html             # Entry point for the study UI
├── studyGreek.sh          # Launch script (Anki, servers & browser)
├── package.json           # Project metadata & dependencies
└── README.md              # This file
```

## Data
- `data/illiadGreek.xml`: TEI XML text of Homer's *Iliad*.
- `data/lattimore_translation.xml`: TEI XML of Richmond Lattimore's English translation.

## Contributing
Bug reports and pull requests are welcome. Please follow standard GitHub workflows.

## License
This project is licensed under the ISC License.【F:package.json†L16-L16】
