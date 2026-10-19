/**
 * GarageCustomizer Component
 * High-fidelity 3D Roomba customizer allowing full skin, finish, decal,
 * novelty topper, and underglow personalization for P1, P2, and Bots.
 */
import React, { useState } from 'react';
import { RobotProfile, TopperType, FinishType } from '../types/game';
import { ArrowLeft, Play, Sparkles, Crown, Shield, Smile, Eye, Zap } from 'lucide-react';
import { soundSynth } from '../audio/SoundSynth';

interface GarageCustomizerProps {
  profiles: RobotProfile[];
  onUpdateProfiles: (updated: RobotProfile[]) => void;
  onBack: () => void;
  onStartMatch: () => void;
  activeRobotId: string;
  setActiveRobotId: (id: string) => void;
}

const COLOR_PRESETS = [
  { name: 'Joyride Fleet (Sponsor)', primary: '#0052ff', accent: '#00f2fe', underglow: '#0052ff' },
  { name: 'Electric Teal', primary: '#0ea5e9', accent: '#38bdf8', underglow: '#0284c7' },
  { name: 'Blaze Coral', primary: '#f97316', accent: '#fb923c', underglow: '#ea580c' },
  { name: 'Emerald Tech', primary: '#10b981', accent: '#34d399', underglow: '#059669' },
  { name: 'Cyber Violet', primary: '#8b5cf6', accent: '#a78bfa', underglow: '#7c3aed' },
  { name: 'Golden Luxe', primary: '#f59e0b', accent: '#fde047', underglow: '#d97706' },
  { name: 'Stealth Obsidian', primary: '#18181b', accent: '#71717a', underglow: '#3f3f46' },
  { name: 'Arctic Ceramic', primary: '#f8fafc', accent: '#cbd5e1', underglow: '#94a3b8' },
];

const TOPPERS: { type: TopperType; label: string; icon: React.ReactNode }[] = [
  { type: 'none', label: 'Bare Dome', icon: <Eye className="w-4 h-4" /> },
  { type: 'joyride_scooter', label: 'Joyride e-Scooter', icon: <Zap className="w-4 h-4 text-cyan-400" /> },
  { type: 'cat_ears', label: 'Cat Ears', icon: <Sparkles className="w-4 h-4" /> },
  { type: 'crown', label: 'Royal Crown', icon: <Crown className="w-4 h-4" /> },
  { type: 'spoiler', label: 'Turbo Spoiler', icon: <Shield className="w-4 h-4" /> },
  { type: 'party_hat', label: 'Party Hat', icon: <Smile className="w-4 h-4" /> },
  { type: 'rubber_duck', label: 'Rubber Duck', icon: <Sparkles className="w-4 h-4" /> },
  { type: 'viking_horns', label: 'Viking Horns', icon: <Shield className="w-4 h-4" /> },
];

const FINISHES: { type: FinishType; label: string }[] = [
  { type: 'matte', label: 'Soft Matte' },
  { type: 'glossy', label: 'High Gloss' },
  { type: 'metallic', label: 'PBR Metallic' },
  { type: 'carbon', label: 'Carbon Weave' },
];

export const GarageCustomizer: React.FC<GarageCustomizerProps> = ({
  profiles,
  onUpdateProfiles,
  onBack,
  onStartMatch,
  activeRobotId,
  setActiveRobotId,
}) => {
  const currentProfile = profiles.find((p) => p.id === activeRobotId) || profiles[0];

  const updateCurrentSkin = (partial: Partial<RobotProfile['skin']>) => {
    soundSynth.ensureContext();
    soundSynth.playVacuumPop();
    const updated = profiles.map((p) => {
      if (p.id === currentProfile.id) {
        return {
          ...p,
          skin: {
            ...p.skin,
            ...partial,
          },
        };
      }
      return p;
    });
    onUpdateProfiles(updated);
  };

  const updateName = (name: string) => {
    const updated = profiles.map((p) => (p.id === currentProfile.id ? { ...p, name } : p));
    onUpdateProfiles(updated);
  };

  return (
    <div className="absolute inset-0 z-20 flex flex-col justify-between p-4 md:p-8 pointer-events-none select-none">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between w-full pointer-events-auto">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-neutral-900/80 border border-neutral-700/60 text-neutral-300 hover:text-white hover:bg-neutral-800 transition-colors text-sm font-medium cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Menu</span>
        </button>

        <div className="text-center">
          <h2 className="text-xl font-bold tracking-tight text-white">Customizer Garage</h2>
          <p className="text-xs text-neutral-400">Personalize chassis finish, colors, and 3D toppers</p>
        </div>

        <button
          onClick={onStartMatch}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-neutral-950 font-bold text-sm shadow-lg shadow-cyan-500/25 transition-all cursor-pointer"
        >
          <Play className="w-4 h-4 fill-current" />
          <span>Race Now</span>
        </button>
      </div>

      {/* Central 3D Viewport is unobstructed */}

      {/* Collapsible/Sleek Bottom Control Dock (Consolidated zero side-panel occlusion) */}
      <div className="pointer-events-auto mx-auto w-full max-w-4xl bg-neutral-900/90 border border-neutral-700/80 rounded-2xl p-4 md:p-6 shadow-2xl backdrop-blur-md">
        {/* Robot Device Selector Tabs */}
        <div className="flex items-center gap-2 border-b border-neutral-800 pb-3 mb-4 overflow-x-auto">
          {profiles.map((p) => {
            const isSelected = p.id === activeRobotId;
            return (
              <button
                key={p.id}
                onClick={() => {
                  soundSynth.ensureContext();
                  soundSynth.playVacuumPop();
                  setActiveRobotId(p.id);
                }}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-neutral-100 text-neutral-950 shadow-md'
                    : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800'
                }`}
              >
                <div
                  className="w-3 h-3 rounded-full border border-neutral-500/50"
                  style={{ backgroundColor: p.skin.primaryColor }}
                />
                <span>{p.name}</span>
                {p.isHuman && (
                  <span className="text-[10px] text-neutral-500 font-normal">
                    (P{p.playerIndex})
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Customization Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Col 1: Name & Preset Palettes */}
          <div>
            <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
              Vacuum Device Name
            </label>
            <input
              type="text"
              value={currentProfile.name}
              onChange={(e) => updateName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-neutral-950 border border-neutral-700 text-white text-sm focus:border-cyan-400 outline-none mb-4"
              maxLength={20}
            />

            {/* Official Joyride Fleet Quick Livery */}
            <div className="mb-4">
              <button
                onClick={() => {
                  updateCurrentSkin({
                    primaryColor: '#0052ff',
                    accentColor: '#00f2fe',
                    finish: 'glossy',
                    decal: 'joyride_fleet',
                    topper: 'joyride_scooter',
                    underglowColor: '#0052ff',
                    sponsor: 'joyride',
                  });
                }}
                className="w-full flex items-center justify-between p-2.5 rounded-xl bg-gradient-to-r from-blue-700/80 to-cyan-600/80 border border-cyan-400 text-white font-bold text-xs shadow-lg shadow-cyan-500/20 hover:brightness-110 transition-all cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-cyan-200 fill-current" />
                  <div className="text-left">
                    <div className="text-white text-xs font-black">Official Joyride Fleet Skin</div>
                    <div className="text-[10px] text-cyan-200 font-normal">SaaS Micromobility Livery</div>
                  </div>
                </div>
                <span className="text-[10px] font-mono bg-white/20 px-2 py-0.5 rounded text-white font-bold">APPLY</span>
              </button>
            </div>

            <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
              Color Schemes
            </label>
            <div className="grid grid-cols-4 gap-2">
              {COLOR_PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  onClick={() =>
                    updateCurrentSkin({
                      primaryColor: preset.primary,
                      accentColor: preset.accent,
                      underglowColor: preset.underglow,
                    })
                  }
                  title={preset.name}
                  className="flex flex-col items-center p-1.5 rounded-lg border border-neutral-800 hover:border-neutral-600 transition-colors cursor-pointer group"
                >
                  <div className="flex items-center gap-1 mb-1">
                    <span className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: preset.primary }} />
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: preset.accent }} />
                  </div>
                  <span className="text-[10px] text-neutral-400 truncate max-w-full group-hover:text-neutral-200">
                    {preset.name.split(' ')[0]}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Col 2: Surface Finish, Decals & Underglow */}
          <div>
            <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
              Chassis Decal Plate
            </label>
            <div className="grid grid-cols-2 gap-2 mb-3">
              {[
                { type: 'joyride_fleet', label: 'Joyride Fleet OS' },
                { type: 'racing_stripes', label: 'Speed Stripes #01' },
                { type: 'cyber_circuit', label: 'Cyber Circuit' },
                { type: 'clean_wave', label: 'Clean Wave' },
                { type: 'polka_dots', label: 'Pop Dots' },
                { type: 'plain', label: 'Minimalist' },
              ].map((d) => (
                <button
                  key={d.type}
                  onClick={() => updateCurrentSkin({ decal: d.type as any })}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer text-left truncate ${
                    currentProfile.skin.decal === d.type
                      ? 'border-cyan-400 bg-cyan-950/40 text-cyan-200'
                      : 'border-neutral-800 bg-neutral-950/60 text-neutral-400 hover:text-white'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>

            <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
              Chassis Material Finish
            </label>
            <div className="grid grid-cols-2 gap-2 mb-3">
              {FINISHES.map((f) => (
                <button
                  key={f.type}
                  onClick={() => updateCurrentSkin({ finish: f.type })}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer text-left ${
                    currentProfile.skin.finish === f.type
                      ? 'border-cyan-400 bg-cyan-950/40 text-cyan-200'
                      : 'border-neutral-800 bg-neutral-950/60 text-neutral-400 hover:text-white'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5">
              LED Underglow Hue
            </label>
            <div className="flex items-center gap-3 bg-neutral-950 p-2 rounded-lg border border-neutral-800">
              <input
                type="color"
                value={currentProfile.skin.underglowColor}
                onChange={(e) => updateCurrentSkin({ underglowColor: e.target.value })}
                className="w-8 h-8 rounded border-none cursor-pointer bg-transparent"
              />
              <span className="text-xs text-neutral-300 font-mono uppercase">
                {currentProfile.skin.underglowColor}
              </span>
            </div>
          </div>

          {/* Col 3: 3D Toppers & Accessories */}
          <div>
            <label className="block text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
              Mount 3D Topper
            </label>
            <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
              {TOPPERS.map((top) => (
                <button
                  key={top.type}
                  onClick={() => updateCurrentSkin({ topper: top.type })}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                    currentProfile.skin.topper === top.type
                      ? 'border-cyan-400 bg-cyan-950/40 text-cyan-200'
                      : 'border-neutral-800 bg-neutral-950/60 text-neutral-400 hover:text-white'
                  }`}
                >
                  {top.icon}
                  <span className="truncate">{top.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
