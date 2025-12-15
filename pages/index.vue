<script setup lang="ts">
import { Badge } from '@/components/ui/badge'
import type { Series, Platform } from '~/types/series'

const currentPlatform = ref<Platform | 'all'>('all')

const platforms: Array<{ key: Platform | 'all'; label: string }> = [
  { key: 'all', label: 'Alle' },
  { key: 'netflix', label: 'Netflix' },
  { key: 'amazon', label: 'Prime Video' },
  { key: 'apple', label: 'Apple TV+' },
  { key: 'hbo', label: 'HBO' },
]

// Load all series once
const { data, pending, error } = await useFetch('/api/series', {
  query: { platform: 'all', sort: 'rating', order: 'desc' },
})

const allSeries = computed(() => data.value?.series || [])

// Client-side filtering - instant, no reload
const filteredSeries = computed(() => {
  if (currentPlatform.value === 'all') {
    return allSeries.value
  }
  return allSeries.value.filter(s => s.platform === currentPlatform.value)
})

const platformColors: Record<Platform, string> = {
  netflix: 'netflix',
  amazon: 'amazon',
  apple: 'apple',
  hbo: 'hbo',
}

const platformLabels: Record<Platform | 'all', string> = {
  all: 'Alle',
  netflix: 'Netflix',
  amazon: 'Amazon',
  apple: 'Apple TV+',
  hbo: 'HBO',
}

const formatVotes = (votes: number): string => {
  if (votes >= 1000000) {
    return `${(votes / 1000000).toFixed(1)}M`
  }
  if (votes >= 1000) {
    return `${(votes / 1000).toFixed(0)}K`
  }
  return votes.toString()
}

const isOngoing = (year: string): boolean => {
  // Ongoing if year ends with "–" or "-" (no end year)
  // e.g. "2017–" or "2020-" means ongoing
  // "2017–2023" means ended
  return year.endsWith('–') || year.endsWith('-')
}
</script>

<template>
  <div class="min-h-screen bg-background">
    <!-- Header -->
    <header class="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div class="container mx-auto px-4 py-6">
        <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 class="text-3xl font-bold tracking-tight">
              <span class="text-primary">★</span> Best Originals by IMDB
            </h1>
            <p class="text-muted-foreground mt-1">
              Die bestbewerteten Serien von Netflix, Prime Video, Apple TV+ & HBO
            </p>
          </div>
          <div class="text-sm text-muted-foreground">
            {{ filteredSeries.length }} Serien gefunden
          </div>
        </div>
      </div>
    </header>

    <main class="container mx-auto px-4 py-8">
      <!-- Platform Filter -->
      <div class="mb-8 flex flex-wrap gap-3">
        <button
          v-for="platform in platforms"
          :key="platform.key"
          @click="currentPlatform = platform.key"
          :class="[
            'rounded-full px-6 py-2.5 text-sm font-semibold transition-colors',
            currentPlatform === platform.key
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          ]"
        >
          {{ platform.label }}
        </button>
      </div>

      <!-- Loading State -->
      <div v-if="pending" class="flex items-center justify-center py-20">
        <div class="text-muted-foreground animate-pulse">Lädt Serien...</div>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="flex items-center justify-center py-20">
        <div class="text-destructive">Fehler beim Laden der Daten</div>
      </div>

      <!-- Series List -->
      <div v-else class="space-y-3">
          <a
            v-for="(item, index) in filteredSeries"
            :key="item.id"
            :href="item.imdbUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="group flex items-center gap-4 rounded-lg border border-border bg-card p-3 transition-all hover:border-primary/50 hover:bg-card/80"
          >
            <!-- Rank -->
            <div class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-muted text-lg font-bold text-muted-foreground">
              {{ index + 1 }}
            </div>

            <!-- Poster -->
            <div class="relative h-20 w-14 flex-shrink-0 overflow-hidden rounded-md bg-muted">
              <img
                v-if="item.poster"
                :src="item.poster"
                :alt="item.title"
                class="h-full w-full object-cover transition-transform group-hover:scale-105"
                loading="lazy"
              />
              <div v-else class="flex h-full w-full items-center justify-center text-xs text-muted-foreground">
                N/A
              </div>
            </div>

            <!-- Info -->
            <div class="flex min-w-0 flex-1 flex-col gap-1">
              <div class="flex items-center gap-2">
                <h2 class="truncate text-xl font-bold text-foreground group-hover:text-primary transition-colors">
                  {{ item.title }}
                </h2>
                <Badge :variant="platformColors[item.platform]" class="flex-shrink-0">
                  {{ platformLabels[item.platform] }}
                </Badge>
              </div>
              <div class="flex items-center gap-3 text-sm text-muted-foreground">
                <span class="flex items-center gap-0.5">
                  {{ item.year }}
                  <span 
                    v-if="isOngoing(item.year)" 
                    :style="{ backgroundColor: '#22c55e', color: '#000', padding: '1px 7px', borderRadius: '9999px', fontWeight: '700', fontSize: '10px' }"
                  >LAUFEND</span>
                </span>
                <span class="text-border">•</span>
                <span>{{ formatVotes(item.votes) }} Bewertungen</span>
              </div>
            </div>

            <!-- Rating -->
            <div class="flex flex-shrink-0 flex-col items-end">
              <div class="flex items-center gap-1">
                <span class="text-3xl font-bold text-primary">{{ item.rating.toFixed(1) }}</span>
                <span class="text-2xl text-primary">★</span>
              </div>
              <div class="text-xs text-muted-foreground">IMDB</div>
            </div>
          </a>
      </div>
    </main>

    <!-- Footer -->
    <footer class="border-t border-border py-8 text-center text-sm text-muted-foreground">
      <p>Daten von IMDB. Erstellt mit Nuxt 3 & shadcn-vue.</p>
      <p class="mt-1">Letzte Aktualisierung: {{ new Date().toLocaleDateString('de-DE') }}</p>
    </footer>
  </div>
</template>


