#!/usr/bin/env npx tsx
/**
 * 📊 IMDB Ratings Updater
 * 
 * Aktualisiert alle Ratings und Votes von IMDB.
 * Empfohlen: Wöchentlich ausführen mit `npm run update`
 * 
 * Usage: npx tsx scripts/update-ratings.ts
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
  title?: string
  year?: string
  poster?: string
}

async function fetchIMDBData(imdbId: string): Promise<IMDBData | null> {
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
    
    // Method 1: Extract from JSON-LD (most reliable)
    let rating = 0
    let votes = 0
    
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const json = JSON.parse($(el).html() || '{}')
        if (json.aggregateRating) {
          rating = parseFloat(json.aggregateRating.ratingValue) || 0
          votes = parseInt(json.aggregateRating.ratingCount) || 0
        }
      } catch {}
    })
    
    // Method 2: Fallback to HTML parsing
    if (rating === 0) {
      const ratingText = $('[data-testid="hero-rating-bar__aggregate-rating__score"] span').first().text()
      rating = parseFloat(ratingText) || 0
    }
    
    // Get poster (update if missing)
    let poster = $('img.ipc-image[srcset]').first().attr('src') || ''
    if (!poster) {
      poster = $('meta[property="og:image"]').attr('content') || ''
    }
    if (poster && poster.includes('._V1_')) {
      poster = poster.replace(/\._V1_.*\./, '._V1_QL75_UX280_CR0,3,280,414_.')
    }
    
    return { rating, votes, poster }
  } catch (error) {
    return null
  }
}

async function main() {
  const startTime = Date.now()
  
  console.log('╔════════════════════════════════════════════╗')
  console.log('║  📊 IMDB Ratings Updater                   ║')
  console.log('╠════════════════════════════════════════════╣')
  console.log(`║  Started: ${new Date().toLocaleString('de-DE')}`)
  console.log('╚════════════════════════════════════════════╝\n')
  
  const series: Series[] = JSON.parse(readFileSync(DATA_PATH, 'utf-8'))
  
  let updated = 0
  let unchanged = 0
  let failed = 0
  const changes: string[] = []
  
  for (let i = 0; i < series.length; i++) {
    const s = series[i]
    const progress = `[${String(i + 1).padStart(3)}/${series.length}]`
    
    process.stdout.write(`${progress} ${s.title.substring(0, 35).padEnd(35)}... `)
    
    const data = await fetchIMDBData(s.id)
    
    if (data && data.rating > 0) {
      const oldRating = s.rating
      const oldVotes = s.votes
      
      // Check if rating changed significantly (> 0.05)
      const ratingChanged = Math.abs(s.rating - data.rating) >= 0.05
      const votesChanged = Math.abs(s.votes - data.votes) / Math.max(s.votes, 1) > 0.05
      
      if (ratingChanged || votesChanged) {
        s.rating = data.rating
        s.votes = data.votes
        
        // Update poster if missing
        if (!s.poster && data.poster) {
          s.poster = data.poster
        }
        
        updated++
        
        const ratingDiff = data.rating - oldRating
        const ratingSign = ratingDiff >= 0 ? '+' : ''
        console.log(`📈 ${oldRating.toFixed(1)} → ${data.rating.toFixed(1)} (${ratingSign}${ratingDiff.toFixed(2)})`)
        
        changes.push(`${s.title}: ${oldRating.toFixed(1)} → ${data.rating.toFixed(1)}`)
      } else {
        unchanged++
        console.log(`✅ ${data.rating.toFixed(1)}`)
      }
    } else {
      failed++
      console.log('❌ Failed')
    }
    
    // Rate limiting: 400ms between requests
    await delay(400)
  }
  
  // Sort by rating (descending)
  series.sort((a, b) => b.rating - a.rating)
  
  // Save updated data
  writeFileSync(DATA_PATH, JSON.stringify(series, null, 2))
  
  const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(1)
  
  console.log('\n╔════════════════════════════════════════════╗')
  console.log('║  📊 Update Complete                        ║')
  console.log('╠════════════════════════════════════════════╣')
  console.log(`║  ✅ Updated:   ${String(updated).padStart(4)} series               ║`)
  console.log(`║  ➖ Unchanged: ${String(unchanged).padStart(4)} series               ║`)
  console.log(`║  ❌ Failed:    ${String(failed).padStart(4)} series               ║`)
  console.log(`║  ⏱️  Duration:  ${duration.padStart(4)} minutes              ║`)
  console.log('╚════════════════════════════════════════════╝')
  
  if (changes.length > 0) {
    console.log('\n📝 Changes:')
    changes.slice(0, 20).forEach(c => console.log(`   • ${c}`))
    if (changes.length > 20) {
      console.log(`   ... and ${changes.length - 20} more`)
    }
  }
  
  console.log(`\n💾 Saved to: ${DATA_PATH}`)
}

main().catch(console.error)

