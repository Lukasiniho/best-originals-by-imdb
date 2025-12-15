import { readFileSync, writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import type { Series, Platform } from '../types/series'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_PATH = join(__dirname, '..', 'data', 'all.json')

// ============================================
// PLATTFORM-KORREKTUREN (manuell verifiziert)
// ============================================

// Serien, die KEINE echten Originals sind (lizenziert/extern produziert)
const NOT_ORIGINALS = [
  'Breaking Bad',           // AMC
  'Avatar: The Last Airbender', // Nickelodeon (Anime auf Netflix lizenziert)
  'Attack on Titan',        // MBS/Crunchyroll
  'Sherlock',               // BBC
  'Rick and Morty',         // Adult Swim
  'Friends',                // NBC
  'Seinfeld',               // NBC
  'Death Note',             // Nippon TV
  'Fullmetal Alchemist: Brotherhood', // MBS
  'One Piece',              // Fuji TV (Anime)
  'Cowboy Bebop',           // TV Tokyo (Anime)
  'Batman: The Animated Series', // Fox Kids
  'Bleach: Thousand-Year Blood War', // TV Tokyo
  'Frieren: Beyond Journey\'s End', // Nippon TV
  'Parks and Recreation',   // NBC
  'Dexter',                 // Showtime
  'Californication',        // Showtime
  'True Blood',             // HBO (aber eigentlich korrekt!)
  'Peaky Blinders',         // BBC
  'Narcos',                 // Netflix Original ✓
]

// Korrekte Plattform-Zuordnungen
const PLATFORM_CORRECTIONS: Record<string, Platform | 'remove'> = {
  // Showtime (nicht in unserer Liste)
  'Dexter': 'remove',
  'Californication': 'remove',
  
  // BBC (nicht in unserer Liste)  
  'Peaky Blinders': 'remove',
  'Sherlock': 'remove',
  'Still Game': 'remove',  // BBC Scotland
  'Fraggle Rock': 'remove',  // HBO/Jim Henson 1983, nicht Apple TV+
  'Leyla and Mecnun': 'remove',  // TRT (türkisches TV), nicht Netflix
  'Leyla ile Mecnun': 'remove',  // TRT (türkisches TV), nicht Netflix
  
  // NBC/andere Networks
  'Parks and Recreation': 'remove',
  'Friends': 'remove',
  'Seinfeld': 'remove',
  
  // AMC
  'Breaking Bad': 'remove',
  
  // Anime (nicht Streaming Originals)
  'Attack on Titan': 'remove',
  'Avatar: The Last Airbender': 'remove',
  'Death Note': 'remove',
  'Fullmetal Alchemist: Brotherhood': 'remove',
  'One Piece': 'remove',
  'Cowboy Bebop': 'remove',
  'Batman: The Animated Series': 'remove',
  'Bleach: Thousand-Year Blood War': 'remove',
  'Frieren: Beyond Journey\'s End': 'remove',
  'Rick and Morty': 'remove',
  
  // Korrekturen (richtige Plattform)
  'The Chosen': 'amazon',
  'Clarkson\'s Farm': 'amazon',
  'The Grand Tour': 'amazon',
  'Invincible': 'amazon',
  'The Marvelous Mrs. Maisel': 'amazon',
  'The Boys': 'amazon',
  'Reacher': 'amazon',
  'Fallout': 'amazon',
  'The Family Man': 'amazon',
  'Mirzapur': 'amazon',
  'Paatal Lok': 'amazon',
  'Breathe': 'amazon',
  'Bosch': 'amazon',
  'Bosch: Legacy': 'amazon',
  'The Expanse': 'amazon', // Amazon ab S4
  'Upload': 'amazon',
  'Sneaky Pete': 'amazon',
  'Patriot': 'amazon',
  'Goliath': 'amazon',
  'Mozart in the Jungle': 'amazon',
  'Transparent': 'amazon',
  'Red Oaks': 'amazon',
  'Hunters': 'amazon',
  'The Underground Railroad': 'amazon',
  'A League of Their Own': 'amazon',
  'Carnival Row': 'amazon',
  'The Wheel of Time': 'amazon',
  'Citadel': 'amazon',
  'The Lord of the Rings: The Rings of Power': 'amazon',
  'The Peripheral': 'amazon',
  'Night Sky': 'amazon',
  'Outer Range': 'amazon',
  'Paper Girls': 'amazon',
  'The Wilds': 'amazon',
  'Forever': 'amazon',
  'Good Omens': 'amazon',
  'Hanna': 'amazon',
  'Homecoming': 'amazon',
  'Tales from the Loop': 'amazon',
  'The Summer I Turned Pretty': 'amazon',
  'Daisy Jones & The Six': 'amazon',
  'Dead Ringers': 'amazon',
  'Swarm': 'amazon',
  'Mr. & Mrs. Smith': 'amazon',
  'I Know What You Did Last Summer': 'amazon',
  
  // True HBO/HBO Max
  'True Blood': 'hbo',
  'Sex and the City': 'hbo',
  'Oz': 'hbo',
  'The Larry Sanders Show': 'hbo',
  'Entourage': 'hbo',
  'Carnivale': 'hbo',
  'Rome': 'hbo',
  'Deadwood': 'hbo',
  'Six Feet Under': 'hbo',
  'The Newsroom': 'hbo',
  'Boardwalk Empire': 'hbo',
  'Silicon Valley': 'hbo',
  'Big Little Lies': 'hbo',
  'Westworld': 'hbo',
  'Watchmen': 'hbo',
  'Euphoria': 'hbo',
  'The Leftovers': 'hbo',
  'Barry': 'hbo',
  'Succession': 'hbo',
  'The White Lotus': 'hbo',
  'White Lotus': 'hbo',
  'House of the Dragon': 'hbo',
  'The Last of Us': 'hbo',
  'The Penguin': 'hbo',
  'Hacks': 'hbo',
  'Peacemaker': 'hbo',
  'The Righteous Gemstones': 'hbo',
  'Perry Mason': 'hbo',
  'Industry': 'hbo',
  'Station Eleven': 'hbo',
  'Lovecraft Country': 'hbo',
  'The Plot Against America': 'hbo',
  'The Flight Attendant': 'hbo',
  'The Gilded Age': 'hbo',
  'Tokyo Vice': 'hbo',
  'A Very English Scandal': 'hbo',
  'The Regime': 'hbo',
  'The Sympathizer': 'hbo',
}

async function main() {
  console.log('🔧 Fixing platform assignments...\n')
  
  let series: Series[] = JSON.parse(readFileSync(DATA_PATH, 'utf-8'))
  const originalCount = series.length
  
  let corrected = 0
  let removed = 0
  const removedTitles: string[] = []
  const correctedTitles: string[] = []
  
  // Filter and correct
  series = series.filter(s => {
    const correction = PLATFORM_CORRECTIONS[s.title]
    
    if (correction === 'remove') {
      removed++
      removedTitles.push(s.title)
      return false
    }
    
    if (correction && correction !== s.platform) {
      correctedTitles.push(`${s.title}: ${s.platform} → ${correction}`)
      s.platform = correction
      corrected++
    }
    
    return true
  })
  
  // Sort by rating
  series.sort((a, b) => b.rating - a.rating)
  
  writeFileSync(DATA_PATH, JSON.stringify(series, null, 2))
  
  console.log('❌ Entfernt (keine echten Originals):')
  removedTitles.forEach(t => console.log(`   - ${t}`))
  
  console.log('\n🔄 Plattform korrigiert:')
  correctedTitles.forEach(t => console.log(`   - ${t}`))
  
  console.log(`\n📊 Ergebnis:`)
  console.log(`   Original: ${originalCount} Serien`)
  console.log(`   Entfernt: ${removed}`)
  console.log(`   Korrigiert: ${corrected}`)
  console.log(`   Verbleibend: ${series.length} Serien`)
}

main()
