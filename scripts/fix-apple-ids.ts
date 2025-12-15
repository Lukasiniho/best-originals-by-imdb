#!/usr/bin/env npx tsx
/**
 * 🔧 Fix Apple TV+ Series IMDB IDs
 * 
 * Findet und korrigiert falsche IMDB-IDs für Apple TV+ Serien.
 * Verwendet die bessere Suchmethode: Nur Titel auf IMDB suchen.
 */

import * as cheerio from 'cheerio'
import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import type { Series } from '../types/series'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_PATH = join(__dirname, '..', 'data', 'all.json')

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// Serien mit bekannten falschen IDs
const SERIES_TO_FIX = [
  'City on Fire',
  'Liaison',
  'Suspicion',
  'High Desert',
  'The Essex Serpent',
  'The Changeling',
  'Surface',
  'Truth Be Told',
  'Extrapolations',
  'Loot',
  'Shining Girls',
  'Schmigadoon!',
  'Dear Edward',
  'Hello Tomorrow!',
  'The Big Door Prize',
  'Platonic',
  'Central Park',
  'Swagger',
  'Hijack',
  'Five Days at Memorial',
  'Home Before Dark',
  'Little America',
  'Black Bird',
]

async function searchIMDBByTitle(title: string): Promise<string | null> {
  // Suche nur nach Titel auf IMDB
  const url = `https://www.imdb.com/find?q=${encodeURIComponent(title)}&s=tt&ttype=tv`
  
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
    
    // Versuche verschiedene Selektoren für die Suchergebnisse
    let href = ''
    
    // Methode 1: ipc-metadata-list-summary-item__t
    const firstResult1 = $('.ipc-metadata-list-summary-item__t').first()
    href = firstResult1.attr('href') || ''
    
    // Methode 2: ipc-metadata-list-summary-item__link
    if (!href) {
      const firstResult2 = $('.ipc-metadata-list-summary-item__link').first()
      href = firstResult2.attr('href') || ''
    }
    
    // Methode 3: find-result-item
    if (!href) {
      const firstResult3 = $('.find-result-item a').first()
      href = firstResult3.attr('href') || ''
    }
    
    // Methode 4: Suche nach allen Links mit /title/tt
    if (!href) {
      const allLinks = $('a[href*="/title/tt"]')
      if (allLinks.length > 0) {
        href = allLinks.first().attr('href') || ''
      }
    }
    
    if (href) {
      const match = href.match(/\/title\/(tt\d+)\//)
      if (match) {
        return match[1]
      }
    }
    
    return null
  } catch (error) {
    console.error(`Error searching for ${title}:`, error)
    return null
  }
}

async function validateIMDBId(imdbId: string, expectedTitle: string): Promise<boolean> {
  const url = `https://www.imdb.com/title/${imdbId}/`
  
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml',
      },
    })
    
    if (!response.ok) return false
    
    const html = await response.text()
    const $ = cheerio.load(html)
    
    const pageTitle = $('h1[data-testid="hero-title-block__title"]').text().trim() || 
                      $('h1').first().text().trim()
    
    // Check if title matches (case-insensitive, partial match)
    const titleMatch = pageTitle.toLowerCase().includes(expectedTitle.toLowerCase()) ||
                      expectedTitle.toLowerCase().includes(pageTitle.toLowerCase()) ||
                      pageTitle.toLowerCase().replace(/[^a-z0-9]/g, '') === expectedTitle.toLowerCase().replace(/[^a-z0-9]/g, '')
    
    return titleMatch
  } catch (error) {
    return false
  }
}

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
    
    let poster = $('img.ipc-image[srcset]').first().attr('src') || ''
    if (!poster) {
      poster = $('meta[property="og:image"]').attr('content') || ''
    }
    if (poster && poster.includes('._V1_')) {
      poster = poster.replace(/\._V1_.*\./, '._V1_QL75_UX280_CR0,3,280,414_.')
    }
    
    return poster || null
  } catch (error) {
    return null
  }
}

async function main() {
  console.log('🔧 Fixing Apple TV+ Series IMDB IDs...\n')
  
  const series: Series[] = JSON.parse(readFileSync(DATA_PATH, 'utf-8'))
  const appleSeries = series.filter(s => s.platform === 'apple' && SERIES_TO_FIX.includes(s.title))
  
  console.log(`Found ${appleSeries.length} series to fix\n`)
  
  const corrections: Array<{ title: string; oldId: string; newId: string; poster?: string }> = []
  
  for (let i = 0; i < appleSeries.length; i++) {
    const s = appleSeries[i]
    console.log(`[${i + 1}/${appleSeries.length}] Fixing: ${s.title} (current: ${s.id})...`)
    
    // Suche nur nach Titel
    const newId = await searchIMDBByTitle(s.title)
    
    if (newId && newId !== s.id) {
      const isValid = await validateIMDBId(newId, s.title)
      
      if (isValid) {
        console.log(`   ✅ Found correct ID: ${newId}`)
        
        const poster = await fetchPoster(newId)
        
        corrections.push({
          title: s.title,
          oldId: s.id,
          newId,
          poster: poster || undefined
        })
        
        s.id = newId
        s.imdbUrl = `https://www.imdb.com/title/${newId}/`
        if (poster) {
          s.poster = poster
        }
      } else {
        console.log(`   ⚠️  Found ID ${newId} but validation failed`)
      }
    } else {
      console.log(`   ❌ Could not find correct ID`)
    }
    
    await delay(600) // Rate limiting
  }
  
  if (corrections.length > 0) {
    // Sort by rating
    series.sort((a, b) => b.rating - a.rating)
    writeFileSync(DATA_PATH, JSON.stringify(series, null, 2))
    
    console.log('\n📝 Corrections made:')
    corrections.forEach(c => {
      console.log(`   ${c.title}: ${c.oldId} → ${c.newId}`)
      if (c.poster) {
        console.log(`      Poster updated`)
      }
    })
    
    console.log(`\n💾 Saved to: ${DATA_PATH}`)
  } else {
    console.log('\n✅ No corrections made')
  }
}

main().catch(console.error)

