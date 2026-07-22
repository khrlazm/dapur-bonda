import * as THREE from 'three/webgpu';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// The Engine owns the renderer, scene, camera, the player rig, and the render
// loop. It picks WebGPU when available and transparently falls back to WebGL2
// (three's WebGPURenderer does this for us) so it runs on Quest 2's browser as
// well as any desktop.
export class Engine {
  constructor() {
    this.updaters = new Set();
    this._lastTime = 0;
    this.backend = 'unknown';
  }

  async init() {
    // WebXR immersive sessions are far more reliable on the WebGL2 backend today
    // — in the Quest browser especially, WebGPU-in-XR is still immature and often
    // starts the session but presents a black frame. So: if this device can
    // actually enter VR, use the WebGL2 backend (our node materials / TSL sky run
    // there just the same). A pure desktop with no XR keeps the WebGPU backend.
    // ?forcegl in the URL forces WebGL2 for testing the exact VR render path.
    let xrSupported = false;
    try {
      xrSupported = !!(navigator.xr && await navigator.xr.isSessionSupported('immersive-vr'));
    } catch { xrSupported = false; }
    this.xrSupported = xrSupported;
    const forceGL = new URLSearchParams(location.search).has('forcegl');

    const renderer = new THREE.WebGPURenderer({
      antialias: true,
      powerPreference: 'high-performance',
      // Use WebGL2 when VR is reachable (or WebGPU is unavailable, or forced).
      forceWebGL: xrSupported || !navigator.gpu || forceGL,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    // AgX tone mapping — filmic, graceful highlight rolloff on the bright window
    // and embers. It renders a little darker/flatter than ACES, so exposure is
    // pushed up (here and per time-of-day in Environment) to keep it punchy.
    renderer.toneMapping = THREE.AgXToneMapping;
    renderer.toneMappingExposure = 1.45;
    // Shadows disabled: the extra depth pass is the single biggest cost on a
    // Quest, and the warm lighting reads fine without them.
    renderer.shadowMap.enabled = false;
    renderer.xr.enabled = true;
    // The WebGPU XR manager may not expose setReferenceSpaceType; it defaults to
    // 'local-floor'. Call it only when present so both backends are happy.
    renderer.xr.setReferenceSpaceType?.('local-floor');

    await renderer.init();
    this.backend = renderer.backend?.isWebGPUBackend ? 'WebGPU' : 'WebGL2';
    document.getElementById('app').appendChild(renderer.domElement);
    this.renderer = renderer;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0xd9b98a, 0.018);
    this.scene = scene;

    // Player rig: the room-space origin. In VR the headset moves the camera
    // relative to this; on desktop we drive the camera with OrbitControls.
    const rig = new THREE.Group();
    scene.add(rig);
    this.rig = rig;

    // Near plane at 1cm so controllers/hands don't clip out when brought close
    // to the face or body in VR.
    const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.01, 100);
    camera.position.set(0, 1.68, 0.62);
    rig.add(camera);
    this.camera = camera;

    // Desktop controls: RIGHT-drag looks around, wheel zooms; LEFT is reserved
    // for grabbing/interacting so it doesn't fight the hand.
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0.9, -0.72);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 0.2;
    controls.maxDistance = 2.4;
    controls.maxPolarAngle = Math.PI * 0.56;
    controls.minPolarAngle = Math.PI * 0.16;
    controls.mouseButtons = { LEFT: null, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
    controls.touches = { ONE: null, TWO: THREE.TOUCH.DOLLY_ROTATE };
    this.controls = controls;

    // A cheap environment map for believable brass/ceramic reflections without
    // PMREM (keeps the WebGL2 fallback path simple and fast).
    scene.environment = this.#makeEnvironment();
    scene.environmentIntensity = 0.6;

    // Fixed VR eye height: we pin the virtual eye to a constant world height so
    // the game plays identically whether you stand or sit (vertical head motion
    // is absorbed by the rig instead of raising/lowering you in the world).
    this.eyeHeight = 1.5;
    this._headWorld = new THREE.Vector3();

    window.addEventListener('resize', () => this.#onResize());
    renderer.xr.addEventListener('sessionstart', () => {
      this.controls.enabled = false;
      this.rig.position.set(0, 0, 0);
      this.rig.rotation.set(0, 0, 0);
      this.dispatchXR?.(true);
    });
    renderer.xr.addEventListener('sessionend', () => {
      this.controls.enabled = true;
      this.rig.position.set(0, 0, 0);
      this.rig.rotation.set(0, 0, 0);
      this.dispatchXR?.(false);
    });

    return this;
  }

  // Equirectangular warm-interior gradient used as scene.environment.
  #makeEnvironment() {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 256;
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0.0, '#f6e2b8'); // warm ceiling glow
    g.addColorStop(0.45, '#d8a86a');
    g.addColorStop(0.7, '#8a6440');
    g.addColorStop(1.0, '#3a2a1a'); // dim floor
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 512, 256);
    // a soft warm "window" hotspot
    const hs = ctx.createRadialGradient(150, 90, 5, 150, 90, 80);
    hs.addColorStop(0, 'rgba(255,240,200,0.9)');
    hs.addColorStop(1, 'rgba(255,240,200,0)');
    ctx.fillStyle = hs;
    ctx.fillRect(0, 0, 512, 256);
    const tex = new THREE.CanvasTexture(c);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  mountVRButton(slotId = 'xr-slot') {
    const button = VRButton.createButton(this.renderer, {
      optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking', 'layers'],
    });
    // Restyle so it fits our cozy HUD chips.
    Object.assign(button.style, {
      position: 'static', width: 'auto', padding: '8px 14px', margin: '0',
      background: 'rgba(243,228,196,0.94)', color: '#4a2f1a', border: '1px solid rgba(74,47,26,0.4)',
      borderRadius: '999px', font: 'inherit', fontSize: '0.82rem', letterSpacing: '0.03em',
      cursor: 'pointer', boxShadow: '0 4px 14px rgba(0,0,0,0.25)', opacity: '1',
    });
    document.getElementById(slotId).appendChild(button);
    return button;
  }

  onUpdate(fn) { this.updaters.add(fn); return () => this.updaters.delete(fn); }

  start() {
    this.renderer.setAnimationLoop((time, frame) => {
      // time is in ms (from rAF / XRFrame). Derive a clamped delta ourselves so
      // we don't depend on the deprecated THREE.Clock.
      const dt = this._lastTime ? Math.min((time - this._lastTime) / 1000, 0.05) : 0.016;
      this._lastTime = time;
      if (this.controls.enabled) this.controls.update();
      for (const fn of this.updaters) fn(dt, time, frame);
      // Height-lock: read the head's floor-relative height straight from the
      // XRFrame viewer pose and set the rig height ABSOLUTELY so the eye sits at
      // eyeHeight. (Deriving it from the rendered camera created a feedback loop
      // that drifted the rig every frame — you'd sink through the floor.)
      if (this.renderer.xr.isPresenting && frame) {
        const refSpace = this.renderer.xr.getReferenceSpace();
        const pose = refSpace && frame.getViewerPose(refSpace);
        if (pose) this.rig.position.y = this.eyeHeight - pose.transform.position.y;
      }
      this.renderer.render(this.scene, this.camera);
    });
  }

  #onResize() {
    const w = window.innerWidth, h = window.innerHeight;
    if (w === 0 || h === 0) return; // avoid a NaN aspect if the canvas is briefly 0-sized
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }
}
