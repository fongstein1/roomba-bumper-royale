/** Shared by the live HUD and final standings. One percent cleaned = 10 points. */
export function totalScore(robot: { coveragePercent: number; dustPoints: number; bumpsGiven: number }): number {
  return robot.coveragePercent * 10 + robot.dustPoints + robot.bumpsGiven * 25;
}
