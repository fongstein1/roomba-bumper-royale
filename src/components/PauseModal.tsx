/**
 * PauseModal Component
 * In-game pause menu with resume, restart, sound toggle, and controls guide.
 */
import React from 'react';
import { Play, RotateCcw, Home, Volume2, VolumeX } from 'lucide-react';

interface PauseModalProps {
  onResume: () => void;
  onRestart: () => void;
  onQuitToTitle: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
}

export const PauseModal: React.FC<PauseModalProps> = ({
  onResume,
  onRestart,
  onQuitToTitle,
  isMuted,
  onToggleMute,
}) => {
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center p-4 bg-neutral-950/75 backdrop-blur-sm select-none">
      <div className="w-full max-w-md bg-neutral-900 border border-neutral-700/80 rounded-3xl p-6 shadow-2xl flex flex-col items-center text-center">
        <h2 className="text-2xl font-bold text-white mb-1">Game Paused</h2>
        <p className="text-xs text-neutral-400 mb-6">Take a breather before resuming the cleaning fray</p>

        {/* Menu Buttons */}
        <div className="flex flex-col gap-3 w-full mb-6">
          <button
            onClick={onResume}
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-neutral-950 font-bold text-sm shadow-lg shadow-cyan-500/25 transition-all cursor-pointer"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>Resume Cleaning</span>
          </button>

          <button
            onClick={onRestart}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-semibold text-sm transition-all cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Restart Round</span>
          </button>

          <button
            onClick={onToggleMute}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-neutral-950 border border-neutral-800 hover:bg-neutral-800 text-neutral-300 font-medium text-sm transition-colors cursor-pointer"
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4 text-cyan-400" />}
            <span>{isMuted ? 'Unmute Sound' : 'Mute Sound'}</span>
          </button>

          <button
            onClick={onQuitToTitle}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-neutral-950 border border-neutral-800 hover:bg-neutral-800 text-neutral-400 hover:text-white font-medium text-sm transition-colors cursor-pointer"
          >
            <Home className="w-4 h-4" />
            <span>Exit to Main Menu</span>
          </button>
        </div>

        {/* Controls Quick Reference */}
        <div className="w-full bg-neutral-950/80 border border-neutral-800/80 rounded-xl p-3 text-left">
          <div className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-2">
            Controls Quick Reference
          </div>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-neutral-400">Player 1 Steer & Boost:</span>
              <span className="font-mono text-cyan-400">W A S D + Space</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-400">Player 2 Steer & Boost:</span>
              <span className="font-mono text-amber-400">Arrow Keys + Enter</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-400">Pause / Menu:</span>
              <span className="font-mono text-neutral-300">Esc</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
