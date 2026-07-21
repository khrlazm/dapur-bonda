import { Engine } from './core/Engine.js';
import { Interaction } from './core/Interaction.js';
import { Kitchen } from './world/Kitchen.js';
import { Lighting } from './world/Lighting.js';
import { createSky } from './world/Sky.js';
import { RecipeBook } from './game/RecipeBook.js';
import { CookingSim } from './game/CookingSim.js';
import { HUD } from './ui/HUD.js';
import { WorldPanel } from './ui/WorldPanel.js';
import * as THREE from 'three/webgpu';
import { Soundscape } from './audio/Soundscape.js';
import { Save } from './game/Save.js';
import { pulutKuning } from './game/recipes.js';

const veil = document.getElementById('veil');
const status = document.getElementById('veil-status');
const setStatus = (s) => { status.textContent = s; };

async function boot() {
  const engine = new Engine();
  setStatus('Lighting the morning…');
  await engine.init();
  setStatus(`Rendering with ${engine.backend}…`);

  // World
  createSky(engine.scene);
  const lighting = new Lighting(engine.scene);
  const kitchen = new Kitchen(engine.scene);

  // Systems
  const interaction = new Interaction(engine);
  engine.interaction = interaction;

  const hud = new HUD();
  const audio = new Soundscape();

  // In-world instruction card for VR (the DOM HUD can't show in an immersive
  // session). Created before the sim so the first step reaches it; shown only
  // while presenting in VR.
  const worldPanel = new WorldPanel(engine.scene, new THREE.Vector3(0.2, 1.48, -1.16));
  hud.worldPanel = worldPanel;
  engine.dispatchXR = (presenting) => {
    interaction.onSessionChange(presenting);
    worldPanel.setVisible(presenting);
  };

  const book = new RecipeBook(engine.scene, kitchen.anchors.book, pulutKuning);

  const sim = new CookingSim({ engine, kitchen, book, hud, audio, recipe: pulutKuning, save: Save });

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

  document.getElementById('btn-book').addEventListener('click', () => {
    // nudge the camera target toward the book
    engine.controls.target.copy(kitchen.anchors.book);
  });

  // Main loop
  engine.onUpdate((dt, t, frame) => {
    lighting.update(t);
    kitchen.update(t);
    interaction.update(dt, frame);
    sim.update(dt, t);
    worldPanel.update(t);
  });
  engine.start();

  // Debug/testing hook (harmless; handy for automated smoke tests).
  window.__dapur = { engine, kitchen, sim, book, hud, audio, Save };

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
