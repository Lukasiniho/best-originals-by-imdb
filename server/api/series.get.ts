import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import type { Series, Platform } from '../../types/series'

interface QueryParams {
  platform?: Platform | 'all'
  sort?: 'rating' | 'votes' | 'year'
  order?: 'asc' | 'desc'
  limit?: string
}

export default defineEventHandler((event) => {
  const query = getQuery(event) as QueryParams
  const platform = query.platform || 'all'
  const sort = query.sort || 'rating'
  const order = query.order || 'desc'
  const limit = parseInt(query.limit || '0') || 0
  
  const dataPath = join(process.cwd(), 'data', 'all.json')
  
  try {
    if (!existsSync(dataPath)) {
      return {
        success: false,
        error: 'No data file found. Run npm run scrape first.',
        series: [],
      }
    }
    
    // Load all series from single file
    let series: Series[] = JSON.parse(readFileSync(dataPath, 'utf-8'))
    
    // Filter by platform if specified
    if (platform !== 'all') {
      series = series.filter(s => s.platform === platform)
    }
    
    // Sort
    series.sort((a, b) => {
      let comparison = 0
      switch (sort) {
        case 'rating':
          comparison = a.rating - b.rating
          break
        case 'votes':
          comparison = a.votes - b.votes
          break
        case 'year':
          const yearA = parseInt(a.year.slice(0, 4)) || 0
          const yearB = parseInt(b.year.slice(0, 4)) || 0
          comparison = yearA - yearB
          break
      }
      return order === 'desc' ? -comparison : comparison
    })
    
    // Limit results
    if (limit > 0) {
      series = series.slice(0, limit)
    }
    
    return {
      success: true,
      count: series.length,
      platform,
      series,
    }
  } catch (error) {
    console.error('Error loading series data:', error)
    return {
      success: false,
      error: 'Failed to load series data',
      series: [],
    }
  }
})
