/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { GameMode, GameState, RobotProfile, MatchStats, RobotLiveState, DustPickup } from './types/game';
import { GameEngine } from './game/GameEngine';
import { TitleScreen } from './components/TitleScreen';
import { GarageCustomizer } from './components/GarageCustomizer';
import { GameHUDOverlay } from './components/GameHUDOverlay';
import { PodiumScreen } from './components/PodiumScreen';
import { PauseModal } from './components/PauseModal';
import { soundSynth } from './audio/SoundSynth';

const DEFAULT_PROFILES: RobotProfile[] = [
  {
    id: 'p1',
    name: 'Joyride Fleet Pro',
    isHuman: true,
    playerIndex: 1,
    skin: {
      primaryColor: '#003831', // Official Joyride Deep Forest Teal (joyride.city)
      accentColor: '#00f5a0',  // Official Joyride Electric Mint
      finish: 'glossy',
      decal: 'joyride_fleet',
      topper: 'joyride_scooter',
      underglowColor: '#00f5a0',
      sponsor: 'joyride',
    },
  },
  {
    id: 'p2',
    name: 'Coral Crusher',
    isHuman: false,
    playerIndex: 2,
    skin: {
      primaryColor: '#ff5500', // Radiant Flame Coral
      accentColor: '#ffa500',
      finish: 'metallic',
      decal: 'plain',
      topper: 'crown',
      underglowColor: '#ff5500',
    },
  },
  {
    id: 'bot1',
    name: 'Sir Sweeps-a-Lot',
    isHuman: false,
    skin: {
      primaryColor: '#10b981', // Emerald Lime
      accentColor: '#34d399',
      finish: 'carbon',
      decal: 'cyber_circuit',
      topper: 'spoiler',
      underglowColor: '#059669',
    },
  },
  {
    id: 'bot2',
    name: 'Apex Vacuum',
    isHuman: false,
    skin: {
      primaryColor: '#8b5cf6', // Electric Purple
      accentColor: '#a78bfa',
      finish: 'matte',
      decal: 'polka_dots',
      topper: 'rubber_duck',
      underglowColor: '#7c3aed',
    },
  },
];

export default function App() {
  const mountRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [loadError, setLoadError] = useState(false);

  const [gameState, setGameState] = useState<GameState>('title');
  const [gameMode, setGameMode] = useState<GameMode>('solo');
  const [profiles, setProfiles] = useState<RobotProfile[]>(DEFAULT_PROFILES);
  const [activeCustomizerId, setActiveCustomizerId] = useState<string>('p1');
  const [isMuted, setIsMuted] = useState<boolean>(false);

  // Live match state for HUD
  const [timeRemaining, setTimeRemaining] = useState<number>(90);
  const [coverage, setCoverage] = useState<Record<string, number>>({});
  const [dirtRemaining, setDirtRemaining] = useState<number>(100);
  const [liveRobotStates, setLiveRobotStates] = useState<RobotLiveState[]>([]);
  const [livePickups, setLivePickups] = useState<DustPickup[]>([]);
  const [liveDogPos, setLiveDogPos] = useState<{ x: number; z: number; status: string } | null>(null);
  const [highValueToast, setHighValueToast] = useState<{ message: string; color: string; id: number } | null>(null);
  const [matchStats, setMatchStats] = useState<MatchStats | null>(null);

  // Turntable animation loop for garage & title
  const turntableAngleRef = useRef<number>(0);

  useEffect(() => {
    if (!mountRef.current) return;

    let engine: GameEngine;
    try {
      engine = new GameEngine(mountRef.current, profiles, gameMode);
    } catch (error) {
      console.error('The 3D arena could not start', error);
      setLoadError(true);
      return;
    }
    engineRef.current = engine;

    engine.onTimeUpdate = (remaining) => {
      setTimeRemaining(remaining);
    };

    engine.onScoresUpdate = (cov, dirt, stats, pickups, dogPos) => {
      setCoverage({ ...cov });
      setDirtRemaining(dirt);
      setLiveRobotStates([...stats]);
      if (pickups) setLivePickups([...pickups]);
      if (dogPos) setLiveDogPos({ ...dogPos });
    };

    engine.onHighValueCleaned = (cleanerName, label, color) => {
      setHighValueToast({
        message: `✨ ${cleanerName} CLEANED ${label}!`,
        color,
        id: Date.now(),
      });
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setHighValueToast(null), 3500);
    };

    engine.onHighValueSpawned = (label) => {
      setHighValueToast({
        message: `⭐ ${label}!`,
        color: '#eab308',
        id: Date.now(),
      });
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setHighValueToast(null), 3500);
    };

    engine.onMatchEnd = (stats) => {
      setMatchStats(stats);
      setGameState('gameover');
    };

    // Initial render
    engine.renderGarageTurntable('p1', 0);

    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  // Update engine profiles when customized
  const handleUpdateProfiles = (updated: RobotProfile[]) => {
    setProfiles(updated);
    if (engineRef.current) {
      engineRef.current.updateProfiles(updated);
      engineRef.current.renderGarageTurntable(activeCustomizerId, turntableAngleRef.current);
    }
  };

  // Switch customizer preview target
  const handleSelectCustomizerRobot = (id: string) => {
    setActiveCustomizerId(id);
    if (engineRef.current) {
      engineRef.current.renderGarageTurntable(id, turntableAngleRef.current);
    }
  };

  // Start match
  const handleStartGame = (mode: GameMode) => {
    if (!engineRef.current) return;
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setHighValueToast(null);
    setMatchStats(null);
    setGameMode(mode);
    soundSynth.ensureContext();
    soundSynth.playCountDown(true);

    const updatedProfiles = profiles.map((p) => {
      if (p.id === 'p2') {
        return { ...p, isHuman: mode === 'splitscreen' };
      }
      return p;
    });
    setProfiles(updatedProfiles);

    if (engineRef.current) {
      engineRef.current.setGameMode(mode);
      engineRef.current.updateProfiles(updatedProfiles);
      engineRef.current.startMatch(90);
    }
    setGameState('playing');
  };

  // Pause toggle
  const handlePause = () => {
    if (gameState === 'playing') {
      engineRef.current?.pauseMatch();
      setGameState('paused');
    }
  };

  const handleResume = () => {
    if (gameState === 'paused') {
      engineRef.current?.resumeMatch();
      setGameState('playing');
    }
  };

  const handleRestart = () => {
    handleStartGame(gameMode);
  };

  const handleBackToTitle = () => {
    engineRef.current?.stopMatch();
    engineRef.current?.renderGarageTurntable('p1', 0);
    setGameState('title');
  };

  const handleToggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    soundSynth.setMuted(next);
  };

  // Keyboard shortcut for pause (Escape)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (gameState === 'playing') {
          handlePause();
        } else if (gameState === 'paused') {
          handleResume();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState]);

  useEffect(() => {
    const pauseOnLeave = () => {
      if (gameState === 'playing') handlePause();
    };
    const visibilityChanged = () => {
      if (document.hidden) pauseOnLeave();
    };
    window.addEventListener('blur', pauseOnLeave);
    document.addEventListener('visibilitychange', visibilityChanged);
    return () => {
      window.removeEventListener('blur', pauseOnLeave);
      document.removeEventListener('visibilitychange', visibilityChanged);
    };
  }, [gameState]);

  // Turntable idle animation for Garage screen
  useEffect(() => {
    if (gameState !== 'customizing' && gameState !== 'title') return;

    let animId: number;
    const renderTurntable = () => {
      animId = requestAnimationFrame(renderTurntable);
      turntableAngleRef.current += 0.012;
      if (engineRef.current) {
        engineRef.current.renderGarageTurntable(activeCustomizerId, turntableAngleRef.current);
      }
    };
    animId = requestAnimationFrame(renderTurntable);

    return () => cancelAnimationFrame(animId);
  }, [gameState, activeCustomizerId]);

  return (
    <div className="game-shell relative w-screen overflow-hidden bg-neutral-950 font-sans">
      {loadError && (
        <div role="alert" className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-4 p-6 bg-neutral-950 text-white text-center">
          <h1 className="text-2xl font-bold">The 3D arena couldn’t start</h1>
          <p>Try a browser with WebGL 2 and hardware acceleration enabled, then reload.</p>
          <button className="rounded-xl bg-cyan-500 text-black px-6 py-3" onClick={() => window.location.reload()}>Reload game</button>
        </div>
      )}
      {/* Three.js Isolated Canvas Mount */}
      <div ref={mountRef} className="absolute inset-0 w-full h-full" />

      {/* Title Screen Overlay */}
      {gameState === 'title' && (
        <TitleScreen
          onStartGame={handleStartGame}
          onOpenGarage={() => {
            soundSynth.ensureContext();
            setGameState('customizing');
          }}
          isMuted={isMuted}
          onToggleMute={handleToggleMute}
        />
      )}

      {/* Garage Customizer Overlay */}
      {gameState === 'customizing' && (
        <GarageCustomizer
          profiles={profiles}
          onUpdateProfiles={handleUpdateProfiles}
          onBack={() => setGameState('title')}
          onStartMatch={() => handleStartGame(gameMode)}
          activeRobotId={activeCustomizerId}
          setActiveRobotId={handleSelectCustomizerRobot}
        />
      )}

      {/* In-Game HUD Overlay */}
      {(gameState === 'playing' || gameState === 'paused') && (
        <GameHUDOverlay
          gameMode={gameMode}
          profiles={profiles}
          states={liveRobotStates}
          timeRemaining={timeRemaining}
          coverage={coverage}
          dirtRemaining={dirtRemaining}
          isMuted={isMuted}
          onToggleMute={handleToggleMute}
          onPause={handlePause}
          onVirtualInput={(player, action, active) => {
            engineRef.current?.setVirtualInput(player, action, active);
          }}
          pickups={livePickups}
          dogPos={liveDogPos}
          highValueToast={highValueToast}
        />
      )}

      {/* Pause Modal */}
      {gameState === 'paused' && (
        <PauseModal
          onResume={handleResume}
          onRestart={handleRestart}
          onQuitToTitle={handleBackToTitle}
          isMuted={isMuted}
          onToggleMute={handleToggleMute}
        />
      )}

      {/* Podium Results Modal */}
      {gameState === 'gameover' && matchStats && (
        <PodiumScreen
          stats={matchStats}
          onRematch={() => handleStartGame(gameMode)}
          onOpenGarage={() => {
            soundSynth.ensureContext();
            setGameState('customizing');
          }}
          onBackToTitle={handleBackToTitle}
        />
      )}
    </div>
  );
}
