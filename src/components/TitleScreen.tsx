/**
 * TitleScreen Component
 * Full-viewport game shell title screen with bespoke inline SVG logo,
 * clean typography, mode selection, and quick control hints.
 */
import React from 'react';
import { GameMode } from '../types/game';
import { Sparkles, Users, User, Palette, Volume2, VolumeX } from 'lucide-react';
import { soundSynth } from '../audio/SoundSynth';

interface TitleScreenProps {
  onStartGame: (mode: GameMode) => void;
  onOpenGarage: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  onStartGame,
  onOpenGarage,
  isMuted,
  onToggleMute,
}) => {
  return (
    <div className="absolute inset-0 z-20 flex flex-col justify-between p-6 md:p-12 pointer-events-none select-none">
      {/* Top Bar with brand mark & mute toggle */}
      <div className="flex items-center justify-between w-full pointer-events-auto">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-400/20 flex items-center justify-center text-cyan-400 shadow-inner">
            <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6 stroke-current stroke-2">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 3" />
              <circle cx="12" cy="12" r="2" fill="currentColor" />
            </svg>
          </div>
          <div>
            <h2 className="text-sm font-semibold tracking-wide text-neutral-300 uppercase">
              Floor Cleaning Championship
            </h2>
            <p className="text-xs text-neutral-500">Penthouse Arena Edition</p>
          </div>
        </div>

        <button
          onClick={onToggleMute}
          aria-label={isMuted ? 'Unmute Sound' : 'Mute Sound'}
          className="p-2.5 rounded-xl bg-neutral-900/80 border border-neutral-700/60 text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors pointer-events-auto"
        >
          {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5 text-cyan-400" />}
        </button>
      </div>

      {/* Hero Center Lockup with Title */}
      <div className="flex flex-col items-center justify-center max-w-2xl mx-auto text-center pointer-events-auto mt-4">
        {/* Animated Custom Roomba Icon */}
        <div className="relative mb-6">
          <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-cyan-600 to-blue-500 p-1 shadow-2xl shadow-cyan-500/25 animate-pulse">
            <div className="w-full h-full rounded-full bg-neutral-950 flex items-center justify-center relative overflow-hidden border border-cyan-400/40">
              {/* Lidar scanner beam */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-cyan-400/20 to-transparent animate-spin" />
              <Sparkles className="w-10 h-10 text-cyan-400 relative z-10" />
            </div>
          </div>
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white mb-3 font-sans">
          ROOMBA <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-sky-300 to-amber-400">BUMPER</span> ROYALE
        </h1>

        <p className="text-base sm:text-lg text-neutral-400 max-w-lg mb-8 leading-relaxed">
          Race high-performance robotic vacuums, ram rivals with spring bumpers, and sweep up the most floor across the designer penthouse!
        </p>

        {/* Primary Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full justify-center max-w-md">
          <button
            onClick={() => {
              soundSynth.ensureContext();
              onStartGame('solo');
            }}
            className="w-full sm:w-auto flex-1 flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-neutral-950 font-bold text-base shadow-lg shadow-cyan-500/25 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
          >
            <User className="w-5 h-5" />
            <span>Solo vs Bots</span>
          </button>

          <button
            onClick={() => {
              soundSynth.ensureContext();
              onStartGame('splitscreen');
            }}
            className="w-full sm:w-auto flex-1 flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-base shadow-lg shadow-amber-500/25 transition-all hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
          >
            <Users className="w-5 h-5" />
            <span>2-Player Split-Screen</span>
          </button>
        </div>

        {/* Secondary Customizer Button */}
        <button
          onClick={onOpenGarage}
          className="mt-4 flex items-center gap-2 px-5 py-2.5 rounded-xl bg-neutral-900/80 border border-neutral-700/60 text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors text-sm font-medium cursor-pointer"
        >
          <Palette className="w-4 h-4 text-cyan-400" />
          <span>Customizer Garage (Skins & Hats)</span>
        </button>
      </div>

      {/* Flat Bottom Control-Hint Line */}
      <div className="flex flex-col sm:flex-row items-center justify-between text-xs text-neutral-500 border-t border-neutral-800/80 pt-4 pointer-events-auto">
        <div className="flex items-center gap-2 mb-2 sm:mb-0">
          <span className="font-mono text-neutral-400">P1: WASD + Space Boost</span>
          <span>·</span>
          <span className="font-mono text-neutral-400">P2: Arrow Keys + Enter Boost</span>
        </div>
        <div className="flex items-center gap-3">
          <span>Esc Pause</span>
          <span>·</span>
          <span>PBR Penthouse Arena</span>
          <span>·</span>
          <span>Spring Elastic Bumpers</span>
        </div>
      </div>
    </div>
  );
};
