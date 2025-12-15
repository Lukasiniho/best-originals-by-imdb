# Best Originals by IMDB

Die bestbewerteten TV-Serien von Netflix, Amazon Prime und Apple TV+ - sortiert nach IMDB-Rating.

## Features

- Scraping von IMDB für Netflix, Amazon und Apple TV+ Originals
- Filter nach Streaming-Plattform
- Sortierung nach IMDB-Rating
- Poster, Titel, Jahr, Votes und Rating für jede Serie
- Direktlinks zu IMDB
- Dunkles, modernes UI

## Tech Stack

- **Framework**: Nuxt 3
- **Styling**: Tailwind CSS + shadcn-vue
- **Scraper**: Cheerio
- **Daten**: JSON-Dateien

## Setup

```bash
# Dependencies installieren
npm install

# Daten scrapen (optional - Daten sind bereits enthalten)
npm run scrape

# Dev-Server starten
npm run dev
```

## Daten aktualisieren

Um die Serien-Daten zu aktualisieren:

```bash
npm run scrape
```

Dies scrapt IMDB und aktualisiert die JSON-Dateien in `/data`.

## Hinweise

- Scraping ist für persönlichen Gebrauch gedacht
- Rate-Limiting ist im Scraper eingebaut
- IMDB Company IDs:
  - Netflix: co0144901
  - Amazon Studios: co0319272
  - Apple TV+: co0546168
