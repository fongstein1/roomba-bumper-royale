/**
 * PodiumScreen Component
 * Celebratory match victory results with confetti, final leaderboard,
 * and rematch / garage controls.
 */
import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { MatchStats } from '../types/game';
import { Trophy, RotateCcw, Palette, ArrowRight, ShieldCheck, Sparkles } from 'lucide-react';
import { soundSynth } from '../audio/SoundSynth';
import { totalScore } from '../game/scoring';

interface PodiumScreenProps {
  stats: MatchStats;
  onRematch: () => void;
  onOpenGarage: () => void;
  onBackToTitle: () => void;
}

export const PodiumScreen: React.FC<PodiumScreenProps> = ({
  stats,
  onRematch,
  onOpenGarage,
  onBackToTitle,
}) => {
  useEffect(() => {
    // Launch celebratory confetti burst
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 },
    });
    const timer = setTimeout(() => {
      confetti({
        particleCount: 50,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
      });
      confetti({
        particleCount: 50,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
      });
    }, 400);

    return () => clearTimeout(timer);
  }, []);

  const winner = stats.leaderboard[0];

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center p-4 bg-neutral-950/80 backdrop-blur-md select-none animate-fadeIn">
      <div role="dialog" aria-modal="true" aria-label="Match results" className="modal-card menu-scroll w-full max-w-2xl bg-neutral-900 border border-neutral-700/80 rounded-3xl p-6 md:p-8 shadow-2xl flex flex-col items-center text-center">
        {/* Trophy Hero Icon */}
        <div className="w-18 h-18 rounded-2xl bg-amber-500/15 border border-amber-400/30 flex items-center justify-center text-amber-400 shadow-xl mb-4">
          <Trophy className="w-10 h-10 animate-bounce" />
        </div>

        <h2 className="text-sm font-semibold uppercase tracking-wider text-amber-400 mb-1">
          Match Concluded
        </h2>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-2">
          {winner ? `${winner.name} Triumphs!` : 'Round Complete!'}
        </h1>
        <p className="text-sm text-neutral-400 max-w-md mb-6">
          Total Floor Cleansed: <span className="font-mono font-bold text-cyan-400">{stats.totalDirtCleanedPercent}%</span> across the designer penthouse.
        </p>

        {/* Leaderboard Table */}
        <p className="text-xs text-neutral-400 mb-3">Score = coverage × 10 + dust points + heavy bumps × 25. Ties use starting order.</p>
        <div className="w-full bg-neutral-950/80 border border-neutral-800 rounded-2xl overflow-x-auto shrink-0 mb-6 touch-pan-x">
        <div className="min-w-[500px]">
          <div className="grid grid-cols-12 px-4 py-2.5 text-[11px] font-semibold text-neutral-400 border-b border-neutral-800 uppercase tracking-wider">
            <span className="col-span-2 text-left">Rank</span>
            <span className="col-span-4 text-left">Vacuum</span>
            <span className="col-span-2 text-right">Coverage</span>
            <span className="col-span-2 text-right">Dust Pts</span>
            <span className="col-span-2 text-right">Score</span>
          </div>

          <div className="divide-y divide-neutral-800/60">
            {stats.leaderboard.map((robot) => {
              const isWinner = robot.rank === 1;
              return (
                <div
                  key={robot.id}
                  data-testid="result-row"
                  data-coverage={robot.coveragePercent}
                  data-dust={robot.dustPoints}
                  data-bumps={robot.bumpsGiven}
                  data-score={totalScore(robot)}
                  className={`grid grid-cols-12 px-4 py-3 items-center text-sm font-medium ${
                    isWinner ? 'bg-amber-500/10 text-amber-200' : 'text-neutral-300'
                  }`}
                >
                  <div className="col-span-2 text-left flex items-center gap-1.5 font-bold font-mono">
                    {isWinner ? (
                      <span className="text-amber-400 flex items-center gap-1">
                        <Trophy className="w-3.5 h-3.5" /> 1st
                      </span>
                    ) : (
                      <span className="text-neutral-500">#{robot.rank}</span>
                    )}
                  </div>

                  <div className="col-span-4 text-left flex items-center gap-2 truncate">
                    <span className="font-semibold text-white truncate">{robot.name}</span>
                    {robot.isHuman && (
                      <span className="text-[10px] text-cyan-400 bg-cyan-950/80 px-1.5 py-0.5 rounded border border-cyan-800/40">
                        Player
                      </span>
                    )}
                  </div>

                  <div className="col-span-2 text-right font-mono font-bold tabular-nums">
                    {robot.coveragePercent.toFixed(1)}%
                  </div>

                  <div className="col-span-2 text-right font-mono text-amber-300 tabular-nums">
                    +{robot.dustPoints}
                  </div>

                  <div className="col-span-2 text-right font-mono text-neutral-400 tabular-nums">
                    {totalScore(robot).toFixed(0)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-3 w-full">
          <button
            autoFocus
            onClick={() => {
              soundSynth.ensureContext();
              onRematch();
            }}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-neutral-950 font-bold text-sm shadow-lg shadow-cyan-500/25 transition-all cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Rematch</span>
          </button>

          <button
            onClick={onOpenGarage}
            className="flex items-center gap-2 px-5 py-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-semibold text-sm transition-all cursor-pointer"
          >
            <Palette className="w-4 h-4 text-cyan-400" />
            <span>Customizer Garage</span>
          </button>

          <button
            onClick={onBackToTitle}
            className="flex items-center gap-2 px-5 py-3 rounded-xl bg-neutral-900 border border-neutral-700/60 hover:bg-neutral-800 text-neutral-400 hover:text-white font-medium text-sm transition-colors cursor-pointer"
          >
            <span>Main Menu</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
