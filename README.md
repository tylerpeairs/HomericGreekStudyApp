# Homeric Greek Study App

A web-based interactive environment for studying Homeric Greek verse line by line.  Paste or load the original Greek text (from an XML or plain-text Iliad), select lines or sense-units, drill vocabulary forms and morphology, attempt translations, and compare against Murray/Lattimore.  Hit-counts come from an ARTFL Philologic proxy, morphology & definitions from the Perseids Morpheus API—all via Dockerized services and a thin Node.js proxy.

---

## 🚀 Features

- **Line-by-line grids**  
  Split Homeric lines into word-cells with editable translation, form, and “add to Anki” checkbox.

- **Morphology & definitions**  
  Click any Greek word to fetch its lemma, morphological parse, and short gloss from the Perseids Morpheus API.

- **Corpus hit-counts**  
  Instantly see how often a lemma occurs in the Homeric corpus via a Philologic-proxy service.

- **Phrase guessing & reveal**  
  Enter your translation attempt and click the “Show Translation” button to pull the 5-line Murray chunk.

- **Selectable verses**  
  Load any Book and starting line, auto-select up to the first period, or drag-select a contiguous block of lines.

- **Translation log**  
  Save your session’s translations to localStorage, then view the last 10 entries in a toggleable log.

- **Anki export**  
  Flag entries for Anki and bundle them as flashcards via the integrated AnkiConnect API.

---

## 🔧 Prerequisites

1. **OS**: macOS (Intel or Apple Silicon)  
2. **Node.js**: ≥ 16.x  
3. **npm** or **yarn**  
4. **Docker Desktop** (for Mac)  
6. **Anki** (desktop, with AnkiConnect plugin installed)

---

## 🛠️ Installation

1. **Clone the repo**  
   ```bash
   git clone https://github.com/your-username/HomericGreekStudyApp.git
   cd HomericGreekStudyApp