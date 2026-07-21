# Dapur Bonda

*Traditional Malay cooking, one memory at a time.*

A serial **cozy cooking VR sim** set in your grandmother's kampung kitchen — built
browser-first with **Three.js + WebGPU (TSL) + WebXR**. Cook on a desktop with a
mouse, or step into the same kitchen in VR on a **Quest 2 / 3** with no install.

This repository currently contains a **playable vertical slice of Episode 1 —
Pulut Kuning** (golden glutinous rice), the first dish of Season One.

No timers. No failure. No score. Progression is *family memories*: the
illustrated heirloom recipe book fills in as you cook, and it is also your save.

---

## Running it

```bash
npm install
npm run dev        # https://localhost:5173  (desktop)
```

Open `https://localhost:5173` in Chrome/Edge (WebGPU) or any modern browser (it
falls back to WebGL2 automatically). Accept the self-signed certificate warning
once.

### Testing in VR on a Quest

WebXR needs a **secure context**, which is why the dev server uses HTTPS.

**Option A — over your LAN (easiest):**
```bash
npm run dev:quest   # prints an https://192.168.x.x:5173 address
```
Open that address in the **Meta Quest Browser**, tap *Advanced → Proceed* on the
cert warning once, then press **Enter VR**.

**Option B — over USB (most reliable):**
```bash
# with the headset connected and adb installed:
adb reverse tcp:5173 tcp:5173
npm run dev
```
Then open `https://localhost:5173` inside the Quest browser.

> Grab with the trigger **or** with a hand-tracking pinch — both fire the same
> interaction. Tilt a vessel past ~50° to pour. You get soft haptic pulses while
> washing, sprinkling, and fluffing.

### Local desktop testing without certificates
```bash
DAPUR_HTTP=1 npm run dev   # http://localhost:8080  (no VR — WebXR needs https)
```

### Production build
```bash
npm run build && npm run preview
```

---

## Controls

| | Desktop | VR (Quest) |
|---|---|---|
| Reach / grab | **Left-drag** | Trigger **or** hand pinch |
| Look around | **Right-drag** | Move your head |
| Zoom | Mouse wheel | Walk |
| Pour | Grab a jug, **Shift + drag** to tilt | Tilt your hand |
| Swirl / stir / fluff | Move the hand in the bowl | Move the controller/hand |

Buttons top-right: **Sound** (toggle the ambient soundscape), **Book** (focus the
recipe book), **Enter VR**.

---

## The cooking loop (Pulut Kuning)

1. **Wash the rice** — swirl your hand in the bowl until the water runs clear.
2. **Colour with turmeric** — shake the turmeric jar over the rice; it turns gold.
3. **Pour the santan** — tilt the jug and pour coconut milk over the rice.
4. **Steam it** — cover the bowl with the steamer lid and let the steam work.
5. **Fluff & moisten** — lift the rice with the wooden paddle until it glistens.
6. **Shape & serve** — carry the finished pulut to the banana leaf.

Each completed step writes a line of Bonda's memory into the book and saves.

---

## Architecture

```
src/
  main.js                 bootstrap: wires world + systems + loop
  core/
    Engine.js             WebGPURenderer (+WebGL2 fallback), XR, camera rig, loop
    Interaction.js        unified grab/pour/stir for desktop pointer AND VR
                          controllers/hands (+ haptics)
  world/
    Kitchen.js            procedural kampung kitchen (wood, brass, baskets…)
    Lighting.js           golden-hour sun, hemisphere fill, window light shafts
    Sky.js                TSL node-material sky gradient (WebGPU + WebGL2)
    textures.js           procedural canvas textures — zero external assets
  fx/
    Steam.js              additive steam particle cloud
    Pour.js               pooled pour droplets + liquid fill surface
  game/
    recipes.js            recipe data assets (steps, conditions, memories)
    CookingSim.js         props + the step state machine + gesture detection
    RecipeBook.js         parchment 3D book — the UI and the save, made physical
    Save.js               localStorage persistence
  audio/
    Soundscape.js         fully synthesized ambience + SFX (Web Audio, no files)
  ui/
    HUD.js                DOM overlay (step card, progress, memory toasts)
```

**Design choices**
- **Everything procedural.** Textures are painted to canvases and audio is
  synthesized at runtime, so the game has no asset files to ship or fail to load.
- **WebGPU with a WebGL2 safety net.** `WebGPURenderer` uses WebGPU where present
  (as on recent Quest browsers) and falls back to WebGL2 otherwise. The sky is a
  TSL node material, so the same shader code compiles to WGSL and GLSL.
- **One interaction model.** Desktop mouse and VR controllers/hands drive the same
  grab/pour/stir code, so the whole game works in both without duplicate logic.

---

## Roadmap

- Pisang Sira (Episode 2) and the rest of Season One (Nasi Lemak, Rendang, Laksa…).
- GPU compute-particle steam/smoke via TSL, and a vertex-displaced santan surface.
- Recipe-book page-turn animation and regional recipe variations.
- Dynamic time of day (morning → maghrib → night), rain on the zinc roof, azan.
- Rapier physics for looser, tactile grabbing.

Requires: Node 18+, a WebGPU- or WebGL2-capable browser. Three.js r185.
