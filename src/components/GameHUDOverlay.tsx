/**
 * GameHUDOverlay Component
 * Low-occlusion perimeter HUD with tabular timer, territory coverage bar,
 * real-time speedometers, boost battery gauges, and ON-SCREEN VIRTUAL CONTROLS
 * for both solo and 2-player split-screen gameplay.
 */
import React, { useState } from 'react';
import { GameMode, RobotProfile, RobotLiveState } from '../types/game';
import {
  Volume2,
  VolumeX,
  Pause,
  Zap,
  Award,
  Sparkles,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Gamepad2,
} from 'lucide-react';

interface GameHUDOverlayProps {
  gameMode: GameMode;
  profiles: RobotProfile[];
  states: RobotLiveState[];
  timeRemaining: number;
  coverage: Record<string, number>;
  dirtRemaining: number;
  isMuted: boolean;
  onToggleMute: () => void;
  onPause: () => void;
  onVirtualInput: (
    player: 'p1' | 'p2',
    action: 'up' | 'down' | 'left' | 'right' | 'boost',
    active: boolean
  ) => void;
}

export const GameHUDOverlay: React.FC<GameHUDOverlayProps> = ({
  gameMode,
  profiles,
  states,
  timeRemaining,
  coverage,
  dirtRemaining,
  isMuted,
  onToggleMute,
  onPause,
  onVirtualInput,
}) => {
  const [showControls, setShowControls] = useState<boolean>(true);

  const p1Profile = profiles.find((p) => p.id === 'p1');
  const p2Profile = profiles.find((p) => p.id === 'p2');
  const p1State = states.find((s) => s.id === 'p1');
  const p2State = states.find((s) => s.id === 'p2');

  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;
  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  // Find current match leader
  const sortedByClean = [...profiles].sort((a, b) => (coverage[b.id] || 0) - (coverage[a.id] || 0));
  const currentLeader = sortedByClean[0];

  // Helper for touch/pointer button bindings
  const bindControl = (player: 'p1' | 'p2', action: 'up' | 'down' | 'left' | 'right' | 'boost') => ({
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      onVirtualInput(player, action, true);
    },
    onPointerUp: (e: React.PointerEvent) => {
      e.preventDefault();
      onVirtualInput(player, action, false);
    },
    onPointerLeave: (e: React.PointerEvent) => {
      e.preventDefault();
      onVirtualInput(player, action, false);
    },
    onPointerCancel: (e: React.PointerEvent) => {
      e.preventDefault();
      onVirtualInput(player, action, false);
    },
    onTouchStart: (e: React.TouchEvent) => {
      e.preventDefault();
      onVirtualInput(player, action, true);
    },
    onTouchEnd: (e: React.TouchEvent) => {
      e.preventDefault();
      onVirtualInput(player, action, false);
    },
  });

  return (
    <div className="absolute inset-0 z-10 pointer-events-none select-none flex flex-col justify-between p-3 sm:p-5 overflow-hidden">
      {/* Split-Screen Center Divider Line */}
      {gameMode === 'splitscreen' && (
        <>
          <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-0.5 bg-neutral-700/60 z-0 pointer-events-none" />
          <div className="absolute top-2 left-1/4 -translate-x-1/2 text-[10px] font-bold tracking-widest text-cyan-400 bg-neutral-950/85 px-2.5 py-0.5 rounded-full border border-cyan-500/40">
            PLAYER 1
          </div>
          <div className="absolute top-2 right-1/4 translate-x-1/2 text-[10px] font-bold tracking-widest text-amber-400 bg-neutral-950/85 px-2.5 py-0.5 rounded-full border border-amber-500/40">
            PLAYER 2
          </div>
        </>
      )}

      {/* TOP PERIMETER: Timer, Territory Bar, and Quick Actions */}
      <div className="w-full max-w-4xl mx-auto flex flex-col items-center gap-1.5 pointer-events-auto">
        <div className="w-full flex items-center justify-between gap-3 bg-neutral-950/80 border border-neutral-800 rounded-2xl px-4 py-2 shadow-xl backdrop-blur-md">
          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={onPause}
              aria-label="Pause Game"
              className="p-2 rounded-xl bg-neutral-900 border border-neutral-700/60 text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
            >
              <Pause className="w-4 h-4" />
            </button>
            <button
              onClick={onToggleMute}
              aria-label={isMuted ? 'Unmute Sound' : 'Mute Sound'}
              className="p-2 rounded-xl bg-neutral-900 border border-neutral-700/60 text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors cursor-pointer"
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-neutral-500" /> : <Volume2 className="w-4 h-4 text-cyan-400" />}
            </button>
            <button
              onClick={() => setShowControls((prev) => !prev)}
              title="Toggle On-Screen Virtual Controls"
              className={`p-2 rounded-xl border transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-semibold ${
                showControls
                  ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300'
                  : 'bg-neutral-900 border-neutral-700/60 text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <Gamepad2 className="w-4 h-4" />
              <span className="hidden sm:inline">Controls</span>
            </button>
          </div>

          {/* Tabular Match Timer */}
          <div className="flex items-center gap-2">
            <div
              className={`text-2xl sm:text-3xl font-extrabold font-mono tracking-tight tabular-nums ${
                timeRemaining <= 15 ? 'text-amber-400 animate-pulse' : 'text-white'
              }`}
            >
              {formattedTime}
            </div>
          </div>

          {/* Current Leader Tag */}
          {currentLeader && (
            <div className="flex items-center gap-2 text-xs">
              <Award className="w-4 h-4 text-amber-400" />
              <span className="text-neutral-400 hidden sm:inline">Leader:</span>
              <span className="font-semibold text-neutral-200 truncate max-w-[90px] sm:max-w-[120px]">
                {currentLeader.name}
              </span>
              <span className="font-mono font-bold text-cyan-400 tabular-nums">
                {(coverage[currentLeader.id] || 0).toFixed(0)}%
              </span>
            </div>
          )}
        </div>

        {/* Real-time Multi-Segment Territory Bar */}
        <div className="w-full bg-neutral-950/85 border border-neutral-800 rounded-xl p-2 shadow-lg backdrop-blur-md flex flex-col gap-1">
          <div className="flex items-center justify-between text-[11px] text-neutral-400 font-medium px-1">
            <div className="flex items-center gap-2.5 overflow-x-auto">
              {profiles.map((p) => (
                <div key={p.id} className="flex items-center gap-1 shrink-0">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.skin.primaryColor }} />
                  <span className="truncate max-w-[75px] text-neutral-300">{p.name}:</span>
                  <span className="font-mono font-bold text-white tabular-nums">
                    {(coverage[p.id] || 0).toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-1 text-neutral-400 shrink-0">
              <span className="hidden sm:inline">Dirty:</span>
              <span className="font-mono font-bold text-neutral-300 tabular-nums">{dirtRemaining}%</span>
            </div>
          </div>

          {/* Segmented Progress Bar */}
          <div className="w-full h-2.5 bg-neutral-800 rounded-full overflow-hidden flex">
            {profiles.map((p) => {
              const pct = coverage[p.id] || 0;
              return (
                <div
                  key={p.id}
                  style={{
                    width: `${pct}%`,
                    backgroundColor: p.skin.primaryColor,
                  }}
                  className="h-full transition-all duration-300"
                />
              );
            })}
            <div style={{ width: `${dirtRemaining}%` }} className="h-full bg-neutral-700/80" />
          </div>
        </div>
      </div>

      {/* BOTTOM CLUSTERS & ON-SCREEN TOUCH/CLICK CONTROLS */}
      <div className="w-full flex items-end justify-between pointer-events-none mt-auto">
        {/* ================= PLAYER 1 ZONE (SOLO OR SPLIT-SCREEN LEFT) ================= */}
        {p1Profile && p1State && (
          <div
            className={`pointer-events-auto flex flex-col gap-2 ${
              gameMode === 'splitscreen' ? 'w-[48%]' : 'w-full max-w-sm'
            }`}
          >
            {/* P1 Compact Status Card */}
            <div className="bg-neutral-950/85 border border-cyan-500/35 rounded-2xl p-2.5 sm:p-3 shadow-xl backdrop-blur-md">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5 truncate">
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shrink-0" />
                  <span className="font-bold text-xs sm:text-sm text-white truncate">{p1Profile.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-white tabular-nums">
                    {(coverage['p1'] || 0).toFixed(1)}%
                  </span>
                  <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/70 px-1.5 py-0.5 rounded border border-cyan-800/40">
                    P1
                  </span>
                </div>
              </div>

              {/* Boost Gauge */}
              <div className="flex items-center gap-2 mb-1">
                <span className="flex items-center gap-1 text-[10px] text-cyan-300 font-semibold uppercase">
                  <Zap className="w-3 h-3 text-cyan-400" /> Boost
                </span>
                <div className="flex-1 h-2 bg-neutral-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-500 to-sky-300 rounded-full transition-all duration-75"
                    style={{ width: `${p1State.boost}%` }}
                  />
                </div>
                <span className="text-[10px] font-mono text-cyan-300 tabular-nums">
                  {Math.round(p1State.boost)}%
                </span>
              </div>
            </div>

            {/* P1 On-Screen Virtual Controls */}
            {showControls && (
              <div className="flex items-center justify-between gap-3 bg-neutral-950/90 border border-cyan-500/30 rounded-2xl p-2.5 shadow-2xl backdrop-blur-md touch-none">
                {/* 4-Way D-Pad (Left Thumb) */}
                <div className="grid grid-cols-3 gap-1.5 w-28 h-28 sm:w-32 sm:h-32 place-items-center">
                  <div />
                  {/* UP / THROTTLE */}
                  <button
                    {...bindControl('p1', 'up')}
                    aria-label="Player 1 Forward"
                    className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-neutral-900 border border-neutral-700/80 active:bg-cyan-500 active:text-neutral-950 text-neutral-200 flex items-center justify-center font-bold shadow-md cursor-pointer transition-all active:scale-95"
                  >
                    <ChevronUp className="w-5 h-5" />
                  </button>
                  <div />

                  {/* LEFT / STEER LEFT */}
                  <button
                    {...bindControl('p1', 'left')}
                    aria-label="Player 1 Steer Left"
                    className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-neutral-900 border border-neutral-700/80 active:bg-cyan-500 active:text-neutral-950 text-neutral-200 flex items-center justify-center font-bold shadow-md cursor-pointer transition-all active:scale-95"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>

                  {/* DOWN / REVERSE */}
                  <button
                    {...bindControl('p1', 'down')}
                    aria-label="Player 1 Reverse"
                    className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-neutral-900 border border-neutral-700/80 active:bg-cyan-500 active:text-neutral-950 text-neutral-200 flex items-center justify-center font-bold shadow-md cursor-pointer transition-all active:scale-95"
                  >
                    <ChevronDown className="w-5 h-5" />
                  </button>

                  {/* RIGHT / STEER RIGHT */}
                  <button
                    {...bindControl('p1', 'right')}
                    aria-label="Player 1 Steer Right"
                    className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-neutral-900 border border-neutral-700/80 active:bg-cyan-500 active:text-neutral-950 text-neutral-200 flex items-center justify-center font-bold shadow-md cursor-pointer transition-all active:scale-95"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>

                {/* TURBO BOOST ACTION BUTTON (Right Thumb) */}
                <div className="flex flex-col items-center gap-1.5 flex-1">
                  <button
                    {...bindControl('p1', 'boost')}
                    aria-label="Player 1 Turbo Boost"
                    className="w-full py-4 sm:py-5 px-3 rounded-2xl bg-gradient-to-tr from-cyan-600 to-sky-400 active:from-cyan-400 active:to-white text-neutral-950 font-black text-xs sm:text-sm tracking-wider uppercase flex items-center justify-center gap-1.5 shadow-lg shadow-cyan-500/30 cursor-pointer transition-all active:scale-95 border border-cyan-300/40"
                  >
                    <Zap className="w-4 h-4 fill-current animate-bounce" />
                    <span>NITRO BOOST</span>
                  </button>
                  <span className="text-[10px] text-neutral-400 font-mono hidden sm:inline">
                    Touch & Hold · (WASD / Space)
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Solo Mode Right Side: Secondary Boost / Action Pad if not in split-screen */}
        {gameMode === 'solo' && showControls && (
          <div className="pointer-events-auto hidden md:flex flex-col items-end gap-2 max-w-[200px]">
            <div className="bg-neutral-950/85 border border-cyan-500/30 rounded-2xl p-3 shadow-xl backdrop-blur-md w-full text-right">
              <span className="text-[10px] text-neutral-400 block uppercase font-semibold">
                Bumper Speed
              </span>
              <span className="text-xl font-bold font-mono text-cyan-400 tabular-nums">
                {((p1State?.speed || 0) * 3.6).toFixed(0)} <span className="text-xs font-sans text-neutral-400">km/h</span>
              </span>
              <div className="mt-1 text-[10px] text-neutral-400 font-mono flex items-center justify-end gap-1">
                <Sparkles className="w-3 h-3 text-amber-400" />
                <span>+{p1State?.dustPoints || 0} Dust pts</span>
              </div>
            </div>
          </div>
        )}

        {/* ================= PLAYER 2 ZONE (SPLIT-SCREEN RIGHT) ================= */}
        {gameMode === 'splitscreen' && p2Profile && p2State && (
          <div className="pointer-events-auto w-[48%] flex flex-col gap-2">
            {/* P2 Compact Status Card */}
            <div className="bg-neutral-950/85 border border-amber-500/35 rounded-2xl p-2.5 sm:p-3 shadow-xl backdrop-blur-md">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5 truncate">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
                  <span className="font-bold text-xs sm:text-sm text-white truncate">{p2Profile.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-white tabular-nums">
                    {(coverage['p2'] || 0).toFixed(1)}%
                  </span>
                  <span className="text-[10px] font-mono text-amber-400 bg-amber-950/70 px-1.5 py-0.5 rounded border border-amber-800/40">
                    P2
                  </span>
                </div>
              </div>

              {/* Boost Gauge */}
              <div className="flex items-center gap-2 mb-1">
                <span className="flex items-center gap-1 text-[10px] text-amber-300 font-semibold uppercase">
                  <Zap className="w-3 h-3 text-amber-400" /> Boost
                </span>
                <div className="flex-1 h-2 bg-neutral-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-orange-400 rounded-full transition-all duration-75"
                    style={{ width: `${p2State.boost}%` }}
                  />
                </div>
                <span className="text-[10px] font-mono text-amber-300 tabular-nums">
                  {Math.round(p2State.boost)}%
                </span>
              </div>
            </div>

            {/* P2 On-Screen Virtual Controls */}
            {showControls && (
              <div className="flex items-center justify-between gap-3 bg-neutral-950/90 border border-amber-500/30 rounded-2xl p-2.5 shadow-2xl backdrop-blur-md touch-none">
                {/* 4-Way D-Pad (Left Thumb) */}
                <div className="grid grid-cols-3 gap-1.5 w-28 h-28 sm:w-32 sm:h-32 place-items-center">
                  <div />
                  {/* UP / THROTTLE */}
                  <button
                    {...bindControl('p2', 'up')}
                    aria-label="Player 2 Forward"
                    className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-neutral-900 border border-neutral-700/80 active:bg-amber-500 active:text-neutral-950 text-neutral-200 flex items-center justify-center font-bold shadow-md cursor-pointer transition-all active:scale-95"
                  >
                    <ChevronUp className="w-5 h-5" />
                  </button>
                  <div />

                  {/* LEFT / STEER LEFT */}
                  <button
                    {...bindControl('p2', 'left')}
                    aria-label="Player 2 Steer Left"
                    className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-neutral-900 border border-neutral-700/80 active:bg-amber-500 active:text-neutral-950 text-neutral-200 flex items-center justify-center font-bold shadow-md cursor-pointer transition-all active:scale-95"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>

                  {/* DOWN / REVERSE */}
                  <button
                    {...bindControl('p2', 'down')}
                    aria-label="Player 2 Reverse"
                    className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-neutral-900 border border-neutral-700/80 active:bg-amber-500 active:text-neutral-950 text-neutral-200 flex items-center justify-center font-bold shadow-md cursor-pointer transition-all active:scale-95"
                  >
                    <ChevronDown className="w-5 h-5" />
                  </button>

                  {/* RIGHT / STEER RIGHT */}
                  <button
                    {...bindControl('p2', 'right')}
                    aria-label="Player 2 Steer Right"
                    className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-neutral-900 border border-neutral-700/80 active:bg-amber-500 active:text-neutral-950 text-neutral-200 flex items-center justify-center font-bold shadow-md cursor-pointer transition-all active:scale-95"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>

                {/* TURBO BOOST ACTION BUTTON */}
                <div className="flex flex-col items-center gap-1.5 flex-1">
                  <button
                    {...bindControl('p2', 'boost')}
                    aria-label="Player 2 Turbo Boost"
                    className="w-full py-4 sm:py-5 px-3 rounded-2xl bg-gradient-to-tr from-amber-600 to-orange-400 active:from-amber-400 active:to-white text-neutral-950 font-black text-xs sm:text-sm tracking-wider uppercase flex items-center justify-center gap-1.5 shadow-lg shadow-amber-500/30 cursor-pointer transition-all active:scale-95 border border-amber-300/40"
                  >
                    <Zap className="w-4 h-4 fill-current animate-bounce" />
                    <span>NITRO BOOST</span>
                  </button>
                  <span className="text-[10px] text-neutral-400 font-mono hidden sm:inline">
                    Touch & Hold · (Arrows / Enter)
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
