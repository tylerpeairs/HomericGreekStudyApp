# Homeric Greek Study App

A web-based interactive environment for studying Homeric Greek verse line by line. Load original Greek text from an XML Iliad, select passages, drill vocabulary and morphology, attempt translations, and compare against Murray. Hit-counts come from an ARTFL Philologic proxy, morphology & definitions from the Perseids Morpheus API—all via Dockerized services and a thin Node.js proxy.

---

## 🚀 Features

- **Line-by-line grids**  
  Display each verse as a grid of Greek words with editable translation, morphological form, and Anki checkbox.

- **Morphology & definitions**  
  Click a Greek word to fetch lemma, parse, and short definition from the Perseids Morpheus API.

- **Corpus hit counts**  
  View frequency of each lemma in the Homeric corpus via a local PhiloLogic5 proxy service.

- **Phrase guessing & reveal**  
  Enter your translation attempt, then click “Show Translation” to pull the 5-line Murray chunk.

- **Selectable lines**  
  Load a window of 15 lines from any Book, auto-select up to the first period, or drag-select a contiguous range.

- **Translation log**  
  Save and view your last 10 translation sessions in a toggleable log stored in `localStorage`.

- **Anki export**  
  Flag entries for Anki flashcards and push them directly via AnkiConnect.

---

## 🔧 Prerequisites

- **macOS** (Intel or Apple Silicon)  
- **Node.js** v16+ and **npm** or **yarn**  
- **Docker Desktop**  
- **Anki** desktop with the **AnkiConnect** plugin

---

## 🛠️ Installation

1. **Clone this repository**  
   ```bash
   git clone https://github.com/your-username/HomericGreekStudyApp.git
   cd HomericGreekStudyApp
   ```

2. **Install Node.js dependencies**  
   ```bash
   npm install
   ```

3. **Clone PhiloLogic5 for corpus proxy**  
   ```bash
   git clone https://github.com/ARTFL-Project/PhiloLogic5.git philoProxy
   ```

4. **Prepare the Homeric corpus**  
   Place `homeric_corpus.sqlite` under `./data/` as required by PhiloLogic5.

5. **Install global static server** (if needed)  
   ```bash
   npm install --global http-server
   ```

---

## 🚢 Running the App

Use the provided script to launch everything:

```bash
chmod +x studyGreek.sh
./studyGreek.sh
```

This will:

1. **Open Anki**  
2. **Start static file server** on `http://localhost:8000`  
3. **Start API proxy** on `http://localhost:3001`  
4. **Launch Docker services** for:
   - Perseids Morpheus API (port 1500)  
   - PhiloLogic5 proxy (port 8080)  
5. **Open** your browser to `http://localhost:8000`

To stop, press **Ctrl+C** in the terminal; Docker containers will be cleaned up automatically.

---

## ⚙️ Scripts

- **`npm start`**  
  Starts the Node.js API proxy (Express) on port 3001.

- **`npm run serve`**  
  Serves static files from the project root on port 8000 via `http-server`.

- **`./studyGreek.sh`**  
  One‑command launch script as described above.

---

## 📁 Project Structure

```
HomericGreekStudyApp/
├── css/
│   └── styles.css
├── data/
│   └── homeric_corpus.sqlite
├── docker-compose.yml
├── index.html
├── js/
│   ├── app.js
│   ├── ui.js
│   ├── bookLoader.js
│   ├── translationLoader.js
│   ├── morphoFetch.js
│   ├── corpusFetch.js
│   ├── server.js
│   └── storage.js
├── studyGreek.sh
├── package.json
└── README.md
```

---

## 🤝 Contributing

1. Fork the repo  
2. Create a feature branch (`git checkout -b feature/YourFeature`)  
3. Commit changes with clear messages  
4. Open a pull request

Please ensure any new dependencies are documented and code is well-commented.

---

## 📜 License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.