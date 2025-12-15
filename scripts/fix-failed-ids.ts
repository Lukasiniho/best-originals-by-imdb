#!/usr/bin/env npx tsx
/**
 * 🔧 Fix Failed IMDB IDs
 * 
 * Findet Serien mit fehlerhaften IMDB-IDs und versucht, die korrekten zu finden.
 * Usage: npx tsx scripts/fix-failed-ids.ts
 */

import * as cheerio from 'cheerio'
import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import type { Series } from '../types/series'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_PATH = join(__dirname, '..', 'data', 'all.json')

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// Liste der Serien, die beim letzten Update fehlgeschlagen sind
const FAILED_SERIES = [
  'Heartstopper',
  'As We See It',
  'Atypical',
  'Lessons in Chemistry',
  'Black Bird',
  'Dead to Me',
  'Little America',
  'Red Oaks',
  'Never Have I Ever',
  'A Very English Scandal',
  'Five Days at Memorial',
  'Shadow and Bone',
  'Hijack',
  'The Devil\'s Hour',
  'Outer Banks',
  'Ginny & Georgia',
  'Locke & Key',
  'Platonic',
  'Central Park',
  'Swagger',
  'The Plot Against America',
  'The Summer I Turned Pretty',
  'Sweet Home',
  'Physical',
  'Dear Edward',
  'Hello Tomorrow!',
  'The Big Door Prize',
  'Forever',
  'Outer Range',
  'Paper Girls',
  'The Wilds',
  'Ratched',
  'Three Pines',
  'Schmigadoon!',
  'Loot',
  'Shining Girls',
  'A League of Their Own',
  'Too Old to Die Young',
  'Truth Be Told',
  'Dead Ringers',
  'Surface',
  'Citadel',
  'Swarm',
  'The Essex Serpent',
  'High Desert',
  'The Sympathizer',
  'Suspicion',
  'City on Fire',
  'Liaison',
  'I Know What You Did Last Summer',
]

async function testIMDBId(imdbId: string, expectedTitle: string): Promise<boolean> {
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
    
    // Check if title matches (case-insensitive, partial match)
    const pageTitle = $('h1[data-testid="hero-title-block__title"]').text().trim() || 
                      $('h1').first().text().trim()
    
    return pageTitle.toLowerCase().includes(expectedTitle.toLowerCase()) ||
           expectedTitle.toLowerCase().includes(pageTitle.toLowerCase())
  } catch (error) {
    return false
  }
}

async function searchIMDB(title: string, year?: string): Promise<string | null> {
  const searchQuery = year ? `${title} ${year}` : title
  const url = `https://www.imdb.com/find?q=${encodeURIComponent(searchQuery)}&s=tt&ttype=tv`
  
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
    
    // Find first TV series result
    const firstResult = $('.ipc-metadata-list-summary-item__t').first()
    const href = firstResult.attr('href')
    
    if (href) {
      const match = href.match(/\/title\/(tt\d+)\//)
      if (match) {
        return match[1]
      }
    }
    
    return null
  } catch (error) {
    return null
  }
}

async function main() {
  console.log('🔧 Fixing failed IMDB IDs...\n')
  
  const series: Series[] = JSON.parse(readFileSync(DATA_PATH, 'utf-8'))
  const failedSeries = series.filter(s => FAILED_SERIES.includes(s.title))
  
  console.log(`Found ${failedSeries.length} failed series to check\n`)
  
  const corrections: Array<{ title: string; oldId: string; newId: string }> = []
  
  for (let i = 0; i < failedSeries.length; i++) {
    const s = failedSeries[i]
    console.log(`[${i + 1}/${failedSeries.length}] Checking: ${s.title} (${s.id})...`)
    
    // First, test if current ID is correct
    const currentIdValid = await testIMDBId(s.id, s.title)
    
    if (!currentIdValid) {
      console.log(`   ❌ Current ID ${s.id} is invalid, searching for correct ID...`)
      
      // Extract year from year string (e.g., "2022–" -> "2022")
      const yearMatch = s.year.match(/(\d{4})/)
      const year = yearMatch ? yearMatch[1] : undefined
      
      const newId = await searchIMDB(s.title, year)
      
      if (newId && newId !== s.id) {
        const newIdValid = await testIMDBId(newId, s.title)
        if (newIdValid) {
          console.log(`   ✅ Found correct ID: ${newId}`)
          corrections.push({ title: s.title, oldId: s.id, newId })
          s.id = newId
          s.imdbUrl = `https://www.imdb.com/title/${newId}/`
        } else {
          console.log(`   ⚠️  Found ID ${newId} but validation failed`)
        }
      } else {
        console.log(`   ❌ Could not find correct ID`)
      }
    } else {
      console.log(`   ✅ Current ID ${s.id} is valid`)
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
    })
    
    console.log(`\n💾 Saved to: ${DATA_PATH}`)
  } else {
    console.log('\n✅ No corrections needed')
  }
}

main().catch(console.error)

