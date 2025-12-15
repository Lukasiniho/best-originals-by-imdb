#!/usr/bin/env npx tsx
/**
 * 🖼️ Update Poster for a Series
 * 
 * Updates the poster image for a specific series by fetching it from IMDB.
 */

import * as cheerio from 'cheerio'
import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import type { Series } from '../types/series'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_PATH = join(__dirname, '..', 'data', 'all.json')

async function fetchPoster(imdbId: string): Promise<string | null> {
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
    
    // Try multiple selectors for poster
    let poster = $('img.ipc-image[srcset]').first().attr('src') || ''
    if (!poster) {
      poster = $('meta[property="og:image"]').attr('content') || ''
    }
    if (!poster) {
      poster = $('.ipc-media img').first().attr('src') || ''
    }
    
    // Format poster URL
    if (poster && poster.includes('._V1_')) {
      poster = poster.replace(/\._V1_.*\./, '._V1_QL75_UX280_CR0,3,280,414_.')
    }
    
    return poster || null
  } catch (error) {
    console.error(`Error fetching poster for ${imdbId}:`, error)
    return null
  }
}

async function main() {
  const seriesTitle = process.argv[2] || 'Lessons in Chemistry'
  
  console.log(`🖼️  Updating poster for: ${seriesTitle}\n`)
  
  const series: Series[] = JSON.parse(readFileSync(DATA_PATH, 'utf-8'))
  const targetSeries = series.find(s => s.title === seriesTitle)
  
  if (!targetSeries) {
    console.error(`❌ Series "${seriesTitle}" not found`)
    process.exit(1)
  }
  
  console.log(`Current ID: ${targetSeries.id}`)
  console.log(`Current poster: ${targetSeries.poster}\n`)
  console.log('Fetching new poster from IMDB...')
  
  const newPoster = await fetchPoster(targetSeries.id)
  
  if (newPoster) {
    targetSeries.poster = newPoster
    series.sort((a, b) => b.rating - a.rating)
    writeFileSync(DATA_PATH, JSON.stringify(series, null, 2))
    console.log(`\n✅ Updated poster:`)
    console.log(`   ${newPoster}`)
    console.log(`\n💾 Saved to: ${DATA_PATH}`)
  } else {
    console.log('\n❌ Could not fetch poster')
    process.exit(1)
  }
}

main().catch(console.error)

