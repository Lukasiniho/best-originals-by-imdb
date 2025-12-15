#!/usr/bin/env npx tsx
/**
 * 🔍 Validate Apple TV+ Series
 * 
 * Überprüft alle Apple TV+ Serien auf korrekte IMDB-IDs und Poster.
 * Fokussiert sich besonders auf Serien mit niedrigen Bewertungen.
 */

import * as cheerio from 'cheerio'
import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import type { Series } from '../types/series'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_PATH = join(__dirname, '..', 'data', 'all.json')

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

async function validateIMDBId(imdbId: string, expectedTitle: string): Promise<{ valid: boolean; actualTitle?: string; poster?: string }> {
  const url = `https://www.imdb.com/title/${imdbId}/`
  
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml',
      },
    })
    
    if (!response.ok) {
      return { valid: false }
    }
    
    const html = await response.text()
    const $ = cheerio.load(html)
    
    // Get title
    const pageTitle = $('h1[data-testid="hero-title-block__title"]').text().trim() || 
                      $('h1').first().text().trim()
    
    // Get poster
    let poster = $('img.ipc-image[srcset]').first().attr('src') || ''
    if (!poster) {
      poster = $('meta[property="og:image"]').attr('content') || ''
    }
    if (poster && poster.includes('._V1_')) {
      poster = poster.replace(/\._V1_.*\./, '._V1_QL75_UX280_CR0,3,280,414_.')
    }
    
    // Check if title matches (case-insensitive, partial match)
    const titleMatch = pageTitle.toLowerCase().includes(expectedTitle.toLowerCase()) ||
                      expectedTitle.toLowerCase().includes(pageTitle.toLowerCase()) ||
                      pageTitle.toLowerCase().replace(/[^a-z0-9]/g, '') === expectedTitle.toLowerCase().replace(/[^a-z0-9]/g, '')
    
    return {
      valid: titleMatch,
      actualTitle: pageTitle,
      poster: poster || undefined
    }
  } catch (error) {
    return { valid: false }
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
  console.log('🔍 Validating Apple TV+ Series...\n')
  
  const series: Series[] = JSON.parse(readFileSync(DATA_PATH, 'utf-8'))
  const appleSeries = series.filter(s => s.platform === 'apple')
  
  // Sort by rating (lowest first) to prioritize checking low-rated series
  appleSeries.sort((a, b) => a.rating - b.rating)
  
  console.log(`Found ${appleSeries.length} Apple TV+ series\n`)
  console.log('Checking series (lowest rated first)...\n')
  
  const issues: Array<{
    title: string
    currentId: string
    issue: string
    suggestedId?: string
    actualTitle?: string
  }> = []
  
  const corrections: Array<{
    title: string
    oldId: string
    newId: string
    newPoster?: string
  }> = []
  
  for (let i = 0; i < appleSeries.length; i++) {
    const s = appleSeries[i]
    const progress = `[${String(i + 1).padStart(2)}/${appleSeries.length}]`
    
    process.stdout.write(`${progress} ${s.title.padEnd(40)} (${s.rating.toFixed(1)})... `)
    
    const validation = await validateIMDBId(s.id, s.title)
    
    if (!validation.valid) {
      console.log(`❌ Invalid (shows: "${validation.actualTitle || 'unknown'}")`)
      issues.push({
        title: s.title,
        currentId: s.id,
        issue: `Shows "${validation.actualTitle || 'unknown'}" instead of "${s.title}"`,
        actualTitle: validation.actualTitle
      })
      
      // Try to find correct ID
      const yearMatch = s.year.match(/(\d{4})/)
      const year = yearMatch ? yearMatch[1] : undefined
      const suggestedId = await searchIMDB(s.title, year)
      
      if (suggestedId && suggestedId !== s.id) {
        const suggestedValidation = await validateIMDBId(suggestedId, s.title)
        if (suggestedValidation.valid) {
          console.log(`   ✅ Found correct ID: ${suggestedId}`)
          corrections.push({
            title: s.title,
            oldId: s.id,
            newId: suggestedId,
            newPoster: suggestedValidation.poster
          })
          s.id = suggestedId
          s.imdbUrl = `https://www.imdb.com/title/${suggestedId}/`
          if (suggestedValidation.poster) {
            s.poster = suggestedValidation.poster
          }
        } else {
          issues[issues.length - 1].suggestedId = suggestedId
          console.log(`   ⚠️  Found ID ${suggestedId} but validation failed`)
        }
      } else {
        console.log(`   ❌ Could not find correct ID`)
      }
    } else {
      // ID is valid, but check if poster needs updating
      if (validation.poster && validation.poster !== s.poster && !s.poster.includes('QRCode')) {
        console.log(`✅ Valid (poster updated)`)
        s.poster = validation.poster
        corrections.push({
          title: s.title,
          oldId: s.id,
          newId: s.id,
          newPoster: validation.poster
        })
      } else {
        console.log(`✅ Valid`)
      }
    }
    
    await delay(600) // Rate limiting
  }
  
  if (corrections.length > 0 || issues.length > 0) {
    // Sort by rating
    series.sort((a, b) => b.rating - a.rating)
    writeFileSync(DATA_PATH, JSON.stringify(series, null, 2))
    
    if (corrections.length > 0) {
      console.log('\n📝 Corrections made:')
      corrections.forEach(c => {
        if (c.oldId !== c.newId) {
          console.log(`   ${c.title}: ${c.oldId} → ${c.newId}`)
        } else if (c.newPoster) {
          console.log(`   ${c.title}: Poster updated`)
        }
      })
    }
    
    if (issues.length > 0) {
      console.log('\n⚠️  Issues found (could not auto-fix):')
      issues.forEach(i => {
        console.log(`   ${i.title}: ${i.issue}`)
        if (i.suggestedId) {
          console.log(`      Suggested ID: ${i.suggestedId}`)
        }
      })
    }
    
    console.log(`\n💾 Saved to: ${DATA_PATH}`)
  } else {
    console.log('\n✅ All Apple TV+ series are valid!')
  }
}

main().catch(console.error)

