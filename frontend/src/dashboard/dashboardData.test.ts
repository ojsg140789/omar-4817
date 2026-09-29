import { describe, expect, it } from 'vitest'
import { historicRaces, lostCount, snails, winsBySnail, wonCount } from './dashboardData.ts'

describe('datos del dashboard', () => {
  it('mantiene estadísticas congruentes para las seis carreras simuladas', () => {
    expect(snails).toHaveLength(6)
    expect(historicRaces).toHaveLength(6)
    expect(wonCount).toBe(4)
    expect(lostCount).toBe(2)
    expect(winsBySnail.reduce((total, snail) => total + snail.wins, 0)).toBe(6)
    expect(winsBySnail.find((snail) => snail.name === 'Pipo')).toMatchObject({ wins: 0 })
  })
})
