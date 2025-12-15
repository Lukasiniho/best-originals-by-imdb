import * as cheerio from 'cheerio'
import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import type { Series } from '../types/series'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_PATH = join(__dirname, '..', 'data', 'all.json')

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// Korrigierte IMDB-IDs für Serien mit falschen Postern
const CORRECT_IDS: Record<string, string> = {
  'WeCrashed': 'tt12005128',
  'Home Before Dark': 'tt8993814',
  'Band of Brothers': 'tt0185906',
  'The Sopranos': 'tt0141842',
  'The Wire': 'tt0306414',
  'Game of Thrones': 'tt0944947',
  'Chernobyl': 'tt7366338',
  'True Detective': 'tt2356777',
  'Succession': 'tt7660850',
  'The Last of Us': 'tt3581920',
  'House of the Dragon': 'tt11198330',
  'Westworld': 'tt0475784',
  'Euphoria': 'tt8772296',
  'Big Little Lies': 'tt3920596',
  'Watchmen': 'tt7049682',
  'Dexter': 'tt0773262',
  'Rome': 'tt0384766',
  'Oz': 'tt0118421',
  'Deadwood': 'tt0348914',
  'Six Feet Under': 'tt0248654',
  'Sex and the City': 'tt0159206',
  'The Leftovers': 'tt2699128',
  'Boardwalk Empire': 'tt0979432',
  'True Blood': 'tt0844441',
  'Entourage': 'tt0387764',
  'Barry': 'tt5348176',
  'Silicon Valley': 'tt2575988',
  'Veep': 'tt1759761',
  'Curb Your Enthusiasm': 'tt0264235',
  'Mare of Easttown': 'tt10155688',
  'The Gilded Age': 'tt4406178',
  'Perry Mason': 'tt2077823',
  'The Righteous Gemstones': 'tt7587890',
  'Hacks': 'tt11815682',
  'The Penguin': 'tt14452776',
  'Peacemaker': 'tt10370710',
  'Tokyo Vice': 'tt2887954',
  'Industry': 'tt8398600',
  'The Flight Attendant': 'tt7569576',
  'Lovecraft Country': 'tt6905686',
  'The Plot Against America': 'tt8423104',
  'Station Eleven': 'tt10574236',
  'Sharp Objects': 'tt2649356',
  'The Newsroom': 'tt1870479',
  'John Adams': 'tt0472027',
  'Carnivale': 'tt0319969',
  'Our Flag Means Death': 'tt11000902',
  'Winning Time': 'tt9544034',
  'White Lotus': 'tt13406094',
  'The Larry Sanders Show': 'tt0103466',
  'Parks and Recreation': 'tt1266020',
  'The Haunting of Hill House': 'tt6763664',
}

async function fetchPoster(imdbId: string): Promise<string> {
  const url = `https://www.imdb.com/title/${imdbId}/`
  
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  })
  
  const html = await response.text()
  const $ = cheerio.load(html)
  
  let poster = $('img.ipc-image[srcset]').first().attr('src') || ''
  if (!poster) {
    poster = $('meta[property="og:image"]').attr('content') || ''
  }
  
  if (poster && poster.includes('._V1_')) {
    poster = poster.replace(/\._V1_.*\./, '._V1_QL75_UX280_CR0,3,280,414_.')
  }
  
  return poster
}

async function main() {
  console.log('🧹 Cleaning up database...\n')
  
  let series: Series[] = JSON.parse(readFileSync(DATA_PATH, 'utf-8'))
  const originalCount = series.length
  
  // Step 1: Remove duplicates (keep first occurrence by title)
  console.log('1️⃣ Removing duplicates...')
  const seen = new Set<string>()
  const duplicates: string[] = []
  
  series = series.filter(s => {
    if (seen.has(s.title)) {
      duplicates.push(s.title)
      return false
    }
    seen.add(s.title)
    return true
  })
  
  console.log(`   Removed ${duplicates.length} duplicates: ${duplicates.join(', ')}`)
  
  // Step 2: Fix IMDB IDs and refetch posters for known incorrect ones
  console.log('\n2️⃣ Fixing IMDB IDs and refetching posters...')
  
  for (const s of series) {
    if (CORRECT_IDS[s.title] && s.id !== CORRECT_IDS[s.title]) {
      const oldId = s.id
      s.id = CORRECT_IDS[s.title]
      s.imdbUrl = `https://www.imdb.com/title/${s.id}/`
      
      process.stdout.write(`   ${s.title}: ${oldId} → ${s.id}... `)
      
      try {
        const poster = await fetchPoster(s.id)
        if (poster) {
          s.poster = poster
          console.log('✅')
        } else {
          console.log('⚠️ No poster')
        }
      } catch {
        console.log('❌ Error')
      }
      
      await delay(600)
    }
  }
  
  // Step 3: Sort by rating
  series.sort((a, b) => b.rating - a.rating)
  
  // Save
  writeFileSync(DATA_PATH, JSON.stringify(series, null, 2))
  
  console.log(`\n📊 Ergebnis:`)
  console.log(`   Original: ${originalCount} Serien`)
  console.log(`   Nach Cleanup: ${series.length} Serien`)
  console.log(`   Entfernt: ${originalCount - series.length}`)
}

main()

