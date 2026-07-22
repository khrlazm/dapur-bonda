import { Engine } from './core/Engine.js';
import { Interaction } from './core/Interaction.js';
import { Locomotion } from './core/Locomotion.js';
import { Kitchen } from './world/Kitchen.js';
import { Lighting } from './world/Lighting.js';
import { createSky } from './world/Sky.js';
import { Environment } from './world/Environment.js';
import { bakeVertexAO } from './world/bakeAO.js';
import { RecipeBook } from './game/RecipeBook.js';
import { CookingSim } from './game/CookingSim.js';
import { HubStories } from './game/HubStories.js';
import { HUD } from './ui/HUD.js';
import { WorldPanel } from './ui/WorldPanel.js';
import * as THREE from 'three/webgpu';
import { Soundscape } from './audio/Soundscape.js';
import { Save } from './game/Save.js';
import { season1 } from './game/recipes.js';

const veil = document.getElementById('veil');
const status = document.getElementById('veil-status');
const setStatus = (s) => { status.textContent = s; };

async function boot() {
  const engine = new Engine();
  setStatus('Lighting the morning…');
  await engine.init();
  setStatus(`Rendering with ${engine.backend}…`);

  // World
  const sky = createSky(engine.scene);
  const lighting = new Lighting(engine.scene);
  const kitchen = new Kitchen(engine.scene);
  // Bake ambient occlusion into the static kitchen's vertex colours (grounds the
  // room; lighting-independent, so it survives the random weather).
  setStatus('Baking the light into the walls…');
  bakeVertexAO(kitchen.aoMeshes);

  // Systems
  const interaction = new Interaction(engine);
  engine.interaction = interaction;
  const locomotion = new Locomotion(engine); // VR: left stick = move, right = snap turn

  const hud = new HUD();
  const audio = new Soundscape();

  // Random time-of-day + weather, re-rolled on every scene transition.
  const environment = new Environment({
    scene: engine.scene, renderer: engine.renderer, sky, lighting, kitchen, audio,
  });
  environment.setCamera(engine.camera);

  // In-world instruction card for VR (the DOM HUD can't show in an immersive
  // session). Created before the sim so the first step reaches it; shown only
  // while presenting in VR.
  const worldPanel = new WorldPanel(engine.scene, new THREE.Vector3(0.2, 1.48, -1.16));
  hud.worldPanel = worldPanel;
  engine.dispatchXR = (presenting) => {
    interaction.onSessionChange(presenting);
    worldPanel.setVisible(presenting);
  };

  const book = new RecipeBook(engine.scene, kitchen.anchors.book, season1[0]);

  const sim = new CookingSim({ engine, kitchen, book, hud, audio, season: season1, save: Save, environment });

  // Explorable hub: story objects scattered through the kitchen. Inspection is
  // hub-only so glimmers and memory toasts never interrupt cooking.
  interaction.isHub = () => sim.mode === 'hub';
  // Book index tabs (desktop click; VR poke is handled in the sim's hub update).
  interaction.tabTargets = book.tabMeshes;
  interaction.onTabPick = (id) => sim.jumpToSection(id);
  const hubStories = new HubStories({ scene: engine.scene, kitchen, interaction, hud, audio, save: Save, sim });

  // HUD buttons
  engine.mountVRButton('xr-slot');
  hud.show();

  const btnAudio = document.getElementById('btn-audio');
  let muted = false;
  const startAudioOnce = () => { audio.start(); };
  window.addEventListener('pointerdown', startAudioOnce, { once: true });
  engine.renderer.xr.addEventListener('sessionstart', startAudioOnce, { once: true });
  btnAudio.addEventListener('click', () => {
    audio.start();
    muted = !muted;
    audio.setMuted(muted);
    btnAudio.textContent = muted ? '🔇 Sound' : '🔈 Sound';
  });

  // Hub recipe-menu controls (desktop). VR uses the book's poke zones instead.
  document.getElementById('btn-prev').addEventListener('click', () => sim.browseMenu(-1));
  document.getElementById('btn-next').addEventListener('click', () => sim.browseMenu(1));
  document.getElementById('btn-cook').addEventListener('click', () => sim.selectMenu());
  document.getElementById('btn-hub').addEventListener('click', () => sim.returnToHubEarly());
  window.addEventListener('keydown', (e) => {
    if (sim.mode !== 'hub') return;
    if (e.key === '[' || e.key === 'ArrowLeft') sim.browseMenu(-1);
    else if (e.key === ']' || e.key === 'ArrowRight') sim.browseMenu(1);
    else if (e.key === 'Enter' || e.key === ' ') sim.selectMenu();
  });

  // Main loop
  engine.onUpdate((dt, t, frame) => {
    lighting.update(t);
    kitchen.update(t);
    interaction.update(dt, frame);
    locomotion.update(dt);
    sim.update(dt, t);
    hubStories.update(dt, t);
    environment.update(dt, t);
    book.update(dt);
    worldPanel.update(t);
  });
  engine.start();

  // Debug/testing hook (harmless; handy for automated smoke tests).
  window.__dapur = { engine, kitchen, sim, book, hud, audio, Save, hubStories, locomotion };

  // Reveal the world
  requestAnimationFrame(() => veil.classList.add('hidden'));
  setTimeout(() => { veil.style.display = 'none'; }, 1300);
}

boot().catch((err) => {
  console.error(err);
  setStatus('The kitchen could not open.');
  const e = document.getElementById('veil-err');
  e.textContent = (err && err.message) ? err.message : String(err);
});
