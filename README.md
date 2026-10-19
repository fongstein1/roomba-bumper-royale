# Roomba Bumper Royale

A browser-based 3D vacuum battle in the original designer penthouse. Solo against three bots, or two humans and two bots on one device. No sign-in, server, API key or downloads required.

## Play

Clean floor, collect sparkling bounties, and ram rivals. Highest **coverage × 10 + dust points + big bumps × 25** wins the 90-second round. Batteries refill boost. The dog can temporarily carry a vacuum away. Wet spills award a one-time bonus and a brief spinout.

- Player 1: W/S forward/reverse, A/D steer, Space boost.
- Player 2: arrow keys and Enter (or right Shift) boost.
- Phone/tablet: tap Controls if needed, then hold Forward while steering; hold Boost for turbo. Two-player mode shares the device; use landscape or a larger screen.
- Escape or Pause pauses. Switching away automatically pauses. Resume, restart, rematch and return to the garage from the menus.
- Garage changes last for the current page session. Mute is available in the menu and during play.

WebGL 2 and hardware acceleration are required. An explanatory screen appears if the 3D renderer cannot initialize. Current Chrome, Edge, Firefox and Safari are intended targets; physical device compatibility and performance still need human play testing.

## Development

Node 22.12+ (Vercel configured for Node 24), npm:

```sh
npm ci
npm test
npm run build
npm run dev
```

`npm run build` includes TypeScript checking. `npm test` runs production-engine regression tests using lightweight scene substitutes; it does not validate GPU rendering or real touchscreen hardware.

## Deployment

Vite static output is `dist/`. `vercel.json` runs `npm ci`, the regression suite, and the checked production build. Deploy the release branch to a **preview**, review it, and approve any production promotion separately. Do not promote this preview implicitly or merge the PR automatically.

No `.env` values are required. The original Google-font links are optional; system fonts provide a fallback. Multiplayer is local only; there is no online matchmaking or saved progress.

See `RELEASE_TEST_RESULTS.md` for the exact validation status and limitations.
