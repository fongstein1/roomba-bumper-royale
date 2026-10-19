/**
 * Roomba Bumper Royale - Core Types & Definitions
 */

export type GameMode = 'solo' | 'splitscreen';

export type GameState = 'title' | 'customizing' | 'countdown' | 'playing' | 'paused' | 'gameover';

export type FinishType = 'matte' | 'glossy' | 'metallic' | 'carbon';

export type DecalType = 'plain' | 'racing_stripes' | 'cyber_circuit' | 'polka_dots' | 'clean_wave';

export type TopperType = 'none' | 'cat_ears' | 'crown' | 'spoiler' | 'party_hat' | 'rubber_duck' | 'viking_horns';

export type BotDifficulty = 'easy' | 'medium' | 'hard';

export interface RobotSkinConfig {
  primaryColor: string;
  accentColor: string;
  finish: FinishType;
  decal: DecalType;
  topper: TopperType;
  underglowColor: string;
}

export interface RobotProfile {
  id: string;
  name: string;
  isHuman: boolean;
  playerIndex?: 1 | 2; // 1 for P1, 2 for P2
  skin: RobotSkinConfig;
}

export interface RobotLiveState {
  id: string;
  x: number;
  z: number;
  vx: number;
  vz: number;
  heading: number; // in radians
  speed: number;
  angularVelocity: number;
  boost: number; // 0 to 100
  isBoosting: boolean;
  isStunned: boolean;
  stunTimer: number;
  dustPoints: number;
  cleanedTiles: number;
  coveragePercent: number;
  bumpsGiven: number;
  bumpsReceived: number;
  spinoutTimer: number;
  spinoutCooldown: number;
}

export interface DustPickup {
  id: string;
  x: number;
  z: number;
  type: 'mega_crumb' | 'battery_boost' | 'dropped_dust';
  value: number;
  radius: number;
  collected: boolean;
  respawnTime?: number;
}

export interface HazardZone {
  id: string;
  x: number;
  z: number;
  radius: number;
  type: 'wet_spill' | 'cable_tangle';
  cleaned?: boolean;
}

export interface FurnitureCollider {
  id: string;
  x: number;
  z: number;
  width: number;
  depth: number;
  rotation?: number;
  name: string;
}

export interface MatchStats {
  duration: number; // in seconds
  winnerId: string;
  winnerName: string;
  leaderboard: {
    id: string;
    name: string;
    isHuman: boolean;
    coveragePercent: number;
    dustPoints: number;
    bumpsGiven: number;
    rank: number;
  }[];
  totalDirtCleanedPercent: number;
}
