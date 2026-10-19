/** Shared by the live leader and final results. Keep the original scoring weights. */
export function totalScore(stats: { coveragePercent: number; dustPoints: number; bumpsGiven: number }) {
  return Math.round((stats.coveragePercent * 10 + stats.dustPoints + stats.bumpsGiven * 25) * 10) / 10;
}
