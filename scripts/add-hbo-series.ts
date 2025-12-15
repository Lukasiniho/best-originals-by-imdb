#!/usr/bin/env npx tsx
/**
 * ➕ Add Missing HBO Series
 * 
 * Fügt fehlende HBO-Serien zur Datenbank hinzu.
 */

import * as cheerio from 'cheerio'
import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import type { Series } from '../types/series'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_PATH = join(__dirname, '..', 'data', 'all.json')

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

interface IMDBData {
  rating: number
  votes: number
  year: string
  poster: string
}

async function fetchIMDBData(imdbId: string, title: string): Promise<IMDBData | null> {
  const url = `https://www.imdb.com/title/${imdbId}/`
  
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml',
      },
    })
    
    if (!response.ok) return null
    
    const html = await response.text()
    const $ = cheerio.load(html)
    
    // Get rating
    let rating = 0
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const json = JSON.parse($(el).html() || '{}')
        if (json.aggregateRating) {
          rating = parseFloat(json.aggregateRating.ratingValue) || 0
        }
      } catch {}
    })
    
    if (rating === 0) {
      const ratingText = $('[data-testid="hero-rating-bar__aggregate-rating__score"] span').first().text()
      rating = parseFloat(ratingText) || 0
    }
    
    // Get votes
    let votes = 0
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const json = JSON.parse($(el).html() || '{}')
        if (json.aggregateRating) {
          votes = parseInt(json.aggregateRating.ratingCount) || 0
        }
      } catch {}
    })
    
    if (votes === 0) {
      const votesText = $('[data-testid="hero-rating-bar__aggregate-rating__score"] + div').text()
      const votesMatch = votesText.match(/([\d,]+)/)
      if (votesMatch) {
        votes = parseInt(votesMatch[1].replace(/,/g, '')) || 0
      }
    }
    
    // Get year
    const yearText = $('[data-testid="hero-title-block__metadata"]').first().text() || ''
    const yearMatch = yearText.match(/(\d{4})(?:[–-](\d{4})?)?/)
    let year = ''
    if (yearMatch) {
      if (yearMatch[2]) {
        year = `${yearMatch[1]}–${yearMatch[2]}`
      } else if (yearText.includes('–') || yearText.includes('-')) {
        year = `${yearMatch[1]}–`
      } else {
        year = yearMatch[1]
      }
    }
    
    // Get poster
    let poster = $('img.ipc-image[srcset]').first().attr('src') || ''
    if (!poster) {
      poster = $('meta[property="og:image"]').attr('content') || ''
    }
    if (poster && poster.includes('._V1_')) {
      poster = poster.replace(/\._V1_.*\./, '._V1_QL75_UX280_CR0,3,280,414_.')
    }
    
    return { rating, votes, year, poster }
  } catch (error) {
    console.error(`Error fetching ${title}:`, error)
    return null
  }
}

// HBO Series to add with their IMDB IDs
const HBO_SERIES_TO_ADD: Array<{ title: string; id: string; year?: string }> = [
  { title: 'Curb Your Enthusiasm', id: 'tt0264235' },
  { title: 'Veep', id: 'tt1759761' },
  { title: 'The Pacific', id: 'tt0374463' },
  { title: 'Eastbound & Down', id: 'tt0866442' },
  { title: 'In Treatment', id: 'tt0834902' },
  { title: 'Girls', id: 'tt1723816' },
  { title: 'The Night Of', id: 'tt2401256' },
  { title: 'Extras', id: 'tt0496409' },
  { title: 'Generation Kill', id: 'tt1217624' },
  { title: 'Big Love', id: 'tt0421030' },
  { title: 'Flight of the Conchords', id: 'tt0863037' },
  { title: 'Vice Principals', id: 'tt4063800' },
  { title: 'Ballers', id: 'tt2891574' },
  { title: 'Bored to Death', id: 'tt1305826' },
  { title: 'Looking', id: 'tt2581458' },
]

async function main() {
  console.log('➕ Adding missing HBO series...\n')
  
  const series: Series[] = JSON.parse(readFileSync(DATA_PATH, 'utf-8'))
  const existingTitles = new Set(series.map(s => s.title.toLowerCase()))
  
  const newSeries: Series[] = []
  
  for (const hboSeries of HBO_SERIES_TO_ADD) {
    const titleLower = hboSeries.title.toLowerCase()
    
    if (existingTitles.has(titleLower)) {
      console.log(`⏭️  ${hboSeries.title} already exists, skipping...`)
      continue
    }
    
    console.log(`📥 Fetching data for: ${hboSeries.title}...`)
    
    const data = await fetchIMDBData(hboSeries.id, hboSeries.title)
    
    if (data && data.rating > 0) {
      const newEntry: Series = {
        id: hboSeries.id,
        title: hboSeries.title,
        year: data.year || hboSeries.year || '',
        rating: data.rating,
        votes: data.votes,
        poster: data.poster || '',
        platform: 'hbo',
        imdbUrl: `https://www.imdb.com/title/${hboSeries.id}/`
      }
      
      newSeries.push(newEntry)
      console.log(`   ✅ Added: ${hboSeries.title} (${data.rating.toFixed(1)})`)
    } else {
      console.log(`   ❌ Failed to fetch data for ${hboSeries.title}`)
    }
    
    await delay(600) // Rate limiting
  }
  
  if (newSeries.length > 0) {
    // Add new series to existing list
    series.push(...newSeries)
    
    // Sort by rating (descending)
    series.sort((a, b) => b.rating - a.rating)
    
    writeFileSync(DATA_PATH, JSON.stringify(series, null, 2))
    
    console.log(`\n✅ Added ${newSeries.length} new HBO series`)
    console.log(`💾 Saved to: ${DATA_PATH}`)
  } else {
    console.log('\n✅ No new series to add')
  }
}

main().catch(console.error)

