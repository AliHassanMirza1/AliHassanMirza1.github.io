# Muhammad Ali Hassan · Portfolio

**Chicago by day. Gotham by night.** An explorable 3D portfolio built with Three.js: drive an armoured car through a procedurally generated Chicago, where every landmark is a chapter of my work.

Live at **https://alihassanmirza1.github.io**

## Experiences

- **Guided tour.** The home screen starts every visit as a tour: autopilot drives you through all ten stops in order, and each stop opens a short dossier. Glowing chevrons on the road show the route, and the tour bar's steps and arrows jump to any stop.
- **Take the wheel.** At any point, press WASD or the arrow keys (Shift to boost, Space to drift, E to enter) or tap Exit tour to drive yourself. The road arrows keep pointing to the next stop, and "Drive me there" hands control back to autopilot. Touch and gamepad are supported too.
- **Back to home.** The Ali Hassan badge (or `H`) flies the camera back over the skyline to the home screen. The classic view has a Home button too.
- **City map / fast travel.** Press `M`, pick a stop, and autopilot takes you there (or skip ahead).
- **Day / night.** The first visit follows the device's light/dark setting; press `N` to switch between sunlit Chicago and noir Gotham, with fog, rain, neon, steam and the bat-signal.
- **Sound (off by default).** A synthesised engine plus quiet ambience: rain at night, birdsong and a distant city by day.
- **Classic view.** All the content as a plain, accessible page. It is pre-rendered into `index.html` at build time, so it also serves search engines, screen readers and devices without WebGL2.

Deep links work: `/#neuro` jumps straight to a stop, and `/#classic` opens the text version.

## Editing content

Every word on the site lives in [`src/content.js`](src/content.js): profile, stops, bullets, stats, links. The 3D panels and the classic page both render from it. `**bold**` and `*italic*` are supported.

The résumé and CV are served from [`public/docs/`](public/docs/). Replace the PDFs and keep the file names, or update the paths in `content.js`.

## Develop

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # outputs dist/
npm run preview   # serve the production build
```

Useful URL flags: `?quality=low|medium|high` forces a graphics tier, and `?debug` exposes `window.__city` for testing.

## Deploy

Pushing to `main` runs [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml). It builds with Node 22 and publishes `dist/` to the `gh-pages` branch, which is what GitHub Pages serves.

## How it's built

| Area | Files |
| --- | --- |
| Content + templates | `src/content.js`, `src/ui/templates.js` (shared by the panels and the pre-rendered classic page in `vite.config.js`) |
| City generation | `src/world/layout.js` (grid, landmarks, street graph), `city.js`, `chicago.js` (Willis, Hancock, Marina City, Cloud Gate, Buckingham Fountain, the L, Navy Pier), `landmarks.js` |
| Rendering | `src/engine.js` (renderer, bloom, vignette, FXAA, adaptive resolution), `world/kit.js` (merges thousands of boxes into a few draw calls), `world/textures.js` (every texture drawn on canvas, nothing downloaded) |
| Driving | `src/game/vehicle.js` (arcade physics), `collision.js`, `navigation.js` (Dijkstra on the street graph + pure-pursuit autopilot), `cameraRig.js`, `world/routeArrows.js` (GPS chevrons on the road) |
| UI | `src/ui/ui.js`, `minimap.js`, `src/styles/main.css` |
| Atmosphere | `world/sky.js` (sun, moon, stars, clouds), `effects.js` (rain, steam, searchlights), `traffic.js`, `core/audio.js` (synthesised engine, rain and birdsong; off by default) |

Everything is procedural: no 3D models or image assets apart from the portrait. The production bundle is about 210 KB of gzipped JavaScript.
