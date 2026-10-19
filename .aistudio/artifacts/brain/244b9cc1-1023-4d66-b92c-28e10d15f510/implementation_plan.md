# Roomba Bumper Royale: 3D Floor Cleaning & Battle Racing

A fast-paced, high-fidelity 3D robot vacuum racing and territory-cleaning arena game built with Three.js. Players pilot customizable robotic vacuums across a luxury designer penthouse, sucking up dust bunnies and crumbs while ramming rivals with spring-loaded bumpers to knock them off clean zones and steal their dust hoard.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> The following core design decisions were confirmed during the planning interview:
> - **Multiplayer Structure**: Local 2-Player split-screen plus smart AI vacuum bot opponents (1P vs 3 Bots, or 2P Split-Screen vs 2 Bots).
> - **Game Mode**: **Bumper Royale** — real-time floor territory vacuuming combined with elastic bumper collisions, dust scatters on impact, and furniture hazard hazards.
> - **Visual Environment**: **Vibrant 3D Designer Home** — floor-to-ceiling windows, warm sunlit hardwood, kitchen terrazzo, woven rugs, modern furniture obstacles, and playful pet hazards.

---

## 1. Overview & Core Concept

- **What It Does**: Puts players in direct control of high-performance robotic vacuum cleaners in a race against time (90s standard match) or target coverage. Every square meter traversed cleans the floor in the player's distinct team color. Colliding with rivals triggers elastic bounce physics, knocks loose collected dust, and shunts opponents away from high-value dirt deposits.
- **Target Audience / Persona**: Casual gamers, friends sharing a keyboard/screen, and anyone who enjoys satisfying cleaning loops and party vehicular combat.
- **Key Value**: Satisfying real-time surface transformation (grimy dusty floor $\rightarrow$ sparkling mirror finish), responsive arcade physics with boost and drifting, and deep device customization (skins, finishes, LED underglow, and novelty toppers).

---

## 2. User Experience & Visual Design

### Key User Flows
1. **Title & Garage Screen**:
   - Atmospheric 3D turntable hero view of the player's Roomba idling on a sunlit parquet floor with spinning brushes and gentle lidar sweep.
   - Interactive **Device Customizer**: Switch finishes (Brushed Obsidian, Ceramic White, Racing Crimson, Carbon Cyber, Mint Retro, Golden Luxe), apply decal patterns, select LED underglow hue, and mount 3D toppers (Cat Ears, Turbo Spoiler, Crown, Party Hat, Rubber Duck).
   - Mode Selection: **Solo Clean Royale** (1 Player vs 3 AI Bots) or **Split-Screen Showdown** (2 Players on shared keyboard + 2 AI Bots).
2. **Bumper Royale Match Flow**:
   - 3-2-1-CLEAN countdown with Web Audio synth chimes.
   - 60fps real-time vacuuming: dynamic canvas-backed floor texture updates as robots sweep over dusty tiles, creating crisp clean trails.
   - Power-ups & Hazards: Turbo Dust Pellets (speed boost), Golden Crumb Baches (instant 5% bonus), Wet Floor Spills (causes Roomba spin-out), and a wandering pet hazard (sleepy cat on a pillow or roaming puppy that nudges robots).
   - Bumping Mechanics: Ramming an opponent triggers elastic momentum transfer, 40ms micro hitstop, particle burst, and dislodges a spray of dust clumps.
3. **Match Results & Podium**:
   - Celebration podium with confetti, round statistics (Floor % Cleaned, Rivals Bumped, Max Clean Streak), and rematch/garage buttons.

### Visual Identity & Theme
- **Aesthetic Direction**: High-end interior architecture meets playful arcade mechanics. Clean, sunlit, Scandinavian-modern penthouse aesthetics with warm natural materials and bright colorful robots.
- **Color Palette & Atmosphere**:
  - Dominant Canvas: Warm natural white oak hardwood (`#C49A6C`), terrazzo stone kitchen tiles (`#D8D3C8`), and deep woven indigo rug (`#2E3A59`).
  - Player 1: Electric Teal (`#0EA5E9`) / Cyan trail.
  - Player 2: Blaze Coral (`#F97316`) / Orange trail.
  - Bot Opponents: Emerald Lime (`#10B981`) and Cyber Violet (`#8B5CF6`).
  - Lighting: PBR Studio setup with warm directional sunlight (`#FFF4E6`), cool sky hemisphere fill (`#E0F2FE`), soft contact shadows, and subtle horizon fog.
- **Typography & HUD Hierarchy**:
  - Display / Title: *Plus Jakarta Sans* bold geometric sans for game lockups and banners.
  - Data Readouts: Monospace tabular numerals (`font-mono tabular-nums`) for match timer, floor percentage counters, and speed indicators.
- **Zero Viewport Occlusion**:
  - Perimeter HUD: Top status strip with match countdown and live territory percentage split bar.
  - Compact corner minimap radar showing remaining dirty zones.
  - Unobstructed center playfield with `pointer-events: none` overlay wrapper.

---

## 3. Key Product Decisions & Trade-Offs

- **Real-Time Floor Cleaning Simulation**:
  - *Chosen Approach*: Dynamic dual-buffered canvas texture (`CanvasTexture`) coupled to an off-screen resolution grid (256x256 or 512x512) mapped directly onto the floor plane's UV coordinates. As robots traverse world coordinates, their positions are rasterized into circular cleaning stamps with soft falloff.
  - *Why*: Delivers instantaneous, pixel-perfect floor cleaning feedback at 60fps with zero geometry rebuilds and ultra-fast CPU/GPU rasterization, keeping frame rates locked at 60fps.
  - *Alternatives Considered*: Modifying vertex colors on a dense mesh (too CPU heavy and causes jagged low-res borders) or individual dust sprites (too many draw calls).
- **Procedural 3D Robot Assembly (3-12 Part Procedural Mesh)**:
  - *Chosen Approach*: Composite procedural Three.js hierarchy per Roomba (`THREE.Group` with main chassis cylinder, beveled front bumper, sensor turret, spinning dual edge brushes, LED ring, wheels, and optional 3D topper accessory).
  - *Why*: Strict adherence to the zero-404 rule (no missing external GLTF models) while providing rich tactile fidelity and modular color/material customization.
- **Local Split-Screen Rendering**:
  - *Chosen Approach*: Dual Three.js camera viewports using `renderer.setScissor` and `renderer.setViewport` for 2-Player mode, or a single dynamic cinematic tracking camera for 1-Player mode.
  - *Why*: Native, latency-free local multiplayer on any modern screen without network desync.

---

## 4. Technical Architecture & Data Strategy

### Architecture & Component Diagram

```
┌────────────────────────────────────────────────────────────────────────┐
│                               App.tsx                                  │
│             (Game State Orchestrator: title / play / victory)          │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
       ┌────────────────────────────┴───────────────────────────┐
       ▼                                                        ▼
┌──────────────────────────────┐        ┌───────────────────────────────┐
│     ThreeCanvasHost.tsx      │        │       GameHUDOverlay.tsx      │
│  - WebGLRenderer (r160+)     │        │  - Match Timer (tabular-nums) │
│  - FloorTextureManager (UV)  │        │  - Territory Score Bar (%)    │
│  - Physics & Collision Loop  │        │  - Minimap Radar              │
│  - Roomba Actors (P1/P2/Bots)│        │  - Boost & Battery Meters     │
│  - Designer Penthouse Scene  │        │  - Pause / Settings Drawer    │
└──────────────┬───────────────┘        └───────────────────────────────┘
               │
       ┌───────┴────────────────────────┬───────────────────────────────┐
       ▼                                ▼                               ▼
┌─────────────────────────┐  ┌─────────────────────┐  ┌────────────────┐
│  ProceduralRoomba.ts    │  │  SoundSynth.ts      │  │  ArenaProps.ts │
│ - Chassis & Bumpers     │  │ - Web Audio API     │  │ - Sofa, Tables │
│ - Dual Spinning Brushes │  │ - Vacuum hum osc    │  │ - Pet Obstacle │
│ - LiDAR Dome & LEDs     │  │ - Bumper clack      │  │ - Dust Pellets │
│ - Toppers & Decals      │  │ - Boost whoosh      │  │ - Rugs & Tiles │
└─────────────────────────┘  └─────────────────────┘  └────────────────┘
```

### State Store & Entities
- **Game Match State**: `status: 'title' | 'customizing' | 'countdown' | 'playing' | 'paused' | 'gameover'`, `gameMode: 'solo' | 'splitscreen'`, `timer: 90`, `scores: Record<RobotId, number>`.
- **Robot Configuration**:
  - `id`: `p1`, `p2`, `bot1`, `bot2`
  - `name`: e.g. "DustBuster 9000", "Sir Sweeps-a-Lot", "Roomba Prime"
  - `skin`: `primaryColor`, `accentColor`, `finish` (matte, glossy, metallic, carbon), `decal` (stripes, cyber, clean-dots)
  - `topper`: `none | cat_ears | crown | spoiler | party_hat | rubber_duck`
  - `underglow`: hex color
- **Kinematics State**:
  - Position $(x, z)$, linear velocity, angular heading $\theta$, turn rate, boost gauge (0–100%), spinout timer, bump stun timer.
- **Controls Mapping**:
  - Player 1: `W`/`S` (Throttle/Reverse), `A`/`D` (Steer), `Space` (Turbo Boost).
  - Player 2: `Up`/`Down` (Throttle/Reverse), `Left`/`Right` (Steer), `Enter`/`Shift` (Turbo Boost).

---

## 5. Implementation Phases & Verification Steps

1. **Phase 1: Dependencies & Configuration**
   - Install `three` and `@types/three`, and `canvas-confetti`.
   - Update `metadata.json` and `index.html` with title, descriptions, and fonts.
2. **Phase 2: Core 3D Penthouse Scene & Procedural Assets**
   - Implement the designer penthouse arena with wooden floor, kitchen tile zone, wool rug, furniture colliders (couch, dining table, plant, cat bed).
   - Implement dynamic floor cleaning canvas engine with real-time percentage analysis.
   - Build procedural multi-part Roomba models with interchangeable skins, decals, and toppers.
3. **Phase 3: Arcade Physics, Collision, & Smart Bot AI**
   - Responsive driving physics with acceleration, deceleration, turning radius, and boost meter.
   - Elastic circle-to-circle bumper collisions with impulse deflection, micro hitstop, and dust drop.
   - Smart AI bots with pathfinding, target dust attraction, and rival ramming behavior.
4. **Phase 4: Split-Screen & Viewport Management**
   - Single camera follow for Solo mode; dual scissor-rect split viewport for 2P mode.
5. **Phase 5: Audio, Polish & Verification**
   - Web Audio procedural sound effects (motor hum, bumper clack, turbo boost, suction pops).
   - Full-viewport Game Shell UI (Title screen, garage customizer, low-occlusion HUD, podium).
   - Verification via `compile_applet`.
