export interface Series {
  id: string
  title: string
  year: string
  rating: number
  votes: number
  poster: string
  platform: 'netflix' | 'amazon' | 'apple' | 'hbo'
  imdbUrl: string
}

export type Platform = 'netflix' | 'amazon' | 'apple' | 'hbo'

