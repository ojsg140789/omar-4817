export interface Snail {
  id: string
  name: string
}

export interface HistoricRace {
  id: string
  winnerId: string
  selectedSnailId: string
}

export const snails: Snail[] = [
  { id: 'rayo', name: 'Rayo' },
  { id: 'luna', name: 'Luna' },
  { id: 'coco', name: 'Coco' },
  { id: 'menta', name: 'Menta' },
  { id: 'pipo', name: 'Pipo' },
  { id: 'nora', name: 'Nora' },
]

export const historicRaces: HistoricRace[] = [
  { id: 'race-1', winnerId: 'rayo', selectedSnailId: 'rayo' },
  { id: 'race-2', winnerId: 'luna', selectedSnailId: 'luna' },
  { id: 'race-3', winnerId: 'coco', selectedSnailId: 'luna' },
  { id: 'race-4', winnerId: 'rayo', selectedSnailId: 'rayo' },
  { id: 'race-5', winnerId: 'nora', selectedSnailId: 'nora' },
  { id: 'race-6', winnerId: 'menta', selectedSnailId: 'coco' },
]

// Son datos deterministas de presentación; no existe lógica de apuestas ni carreras ejecutables.
const raceResults = historicRaces.map((race) => ({
  ...race,
  won: race.winnerId === race.selectedSnailId,
}))

// Todos los indicadores se derivan de las mismas seis carreras para mantenerlos congruentes.
export const wonCount = raceResults.filter((race) => race.won).length
export const lostCount = raceResults.length - wonCount

export const outcomeData = [
  { name: 'Ganadas', value: wonCount },
  { name: 'Perdidas', value: lostCount },
]

export const winsBySnail = snails.map((snail) => ({
  name: snail.name,
  wins: raceResults.filter((race) => race.winnerId === snail.id).length,
}))
