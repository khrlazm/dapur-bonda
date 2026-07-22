import * as THREE from 'three/webgpu';

// Random time-of-day + weather, re-rolled on every scene transition (hub and
// each recipe). It retints the sky, sun/moon, hemisphere + ambient light, fog,
// the interior lamp and exposure, and — through the open window and doorway —
// shows a sun or moon disc and, when it's raining, falling rain (with sound).
// Changes happen at full-black during the fade, so the world simply "is" a new
// time when you arrive.

const TIMES = {
  morning: {
    sky: [0xffd9a0, 0x7fa6d0, 0x4a3a26], sunEl: 22, sunColor: 0xffd28a, sunInt: 2.4,
    hemiSky: 0xffe6bd, hemiGround: 0x5a4632, hemiInt: 0.55, ambColor: 0xffd9a8, ambInt: 0.18,
    fog: 0xd9b98a, fogD: 0.014, exposure: 1.05, lamp: 0.0, disc: 'sun', discColor: 0xfff2cf, discSize: 1.6,
  },
  afternoon: {
    sky: [0xcfe0f0, 0x6f9fd8, 0x55483a], sunEl: 58, sunColor: 0xfff2d6, sunInt: 3.0,
    hemiSky: 0xffffff, hemiGround: 0x6a5844, hemiInt: 0.7, ambColor: 0xffffff, ambInt: 0.22,
    fog: 0xcfd8d0, fogD: 0.009, exposure: 1.0, lamp: 0.0, disc: 'sun', discColor: 0xffffff, discSize: 1.2,
  },
  evening: {
    sky: [0xff9a5a, 0x6a4a7a, 0x3a2a2a], sunEl: 7, sunColor: 0xff7a3a, sunInt: 1.9,
    hemiSky: 0xffb37a, hemiGround: 0x4a3020, hemiInt: 0.4, ambColor: 0xffb488, ambInt: 0.16,
    fog: 0xc98a5a, fogD: 0.018, exposure: 1.1, lamp: 0.35, disc: 'sun', discColor: 0xff8a3a, discSize: 2.1,
  },
  night: {
    sky: [0x2a3a52, 0x0e1526, 0x0a0e16], sunEl: 42, sunColor: 0x9fb4e0, sunInt: 0.5,
    hemiSky: 0x3a4a6a, hemiGround: 0x10141c, hemiInt: 0.25, ambColor: 0x4a5a7a, ambInt: 0.12,
    fog: 0x14203a, fogD: 0.02, exposure: 1.18, lamp: 1.1, disc: 'moon', discColor: 0xdfe6f5, discSize: 1.0,
  },
};

const TIME_KEYS = ['morning', 'afternoon', 'evening', 'night'];
const WEATHER_KEYS = ['clear', 'clear', 'clear', 'cloudy', 'rain']; // clear-weighted

export class Environment {
  constructor({ scene, renderer, sky, lighting, kitchen, audio }) {
    this.scene = scene;
    this.renderer = renderer;
    this.sky = sky;
    this.lighting = lighting;
    this.kitchen = kitchen;
    this.audio = audio;

    this.state = { time: 'morning', weather: 'clear' };
    // AgX needs more exposure than the ACES-tuned presets to stay punchy.
    this.exposureScale = 1.45;
    this._tmp = new THREE.Vector3();

    this.#buildDisc();
    this.rain = new Rain(scene, kitchen);
  }

  // ---- celestial disc (sun / moon) seen through the window ----
  #buildDisc() {
    this.disc = new THREE.Mesh(
      new THREE.CircleGeometry(0.6, 32),
      new THREE.MeshBasicMaterial({ color: 0xfff2cf, fog: false, transparent: true }),
    );
    this.halo = new THREE.Mesh(
      new THREE.CircleGeometry(1.6, 32),
      new THREE.MeshBasicMaterial({ color: 0xfff2cf, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }),
    );
    this.disc.add(this.halo);
    this.disc.renderOrder = 0;
    this.scene.add(this.disc);
  }

  randomize(rng = Math.random) {
    const time = TIME_KEYS[(rng() * TIME_KEYS.length) | 0];
    const weather = WEATHER_KEYS[(rng() * WEATHER_KEYS.length) | 0];
    this.set(time, weather);
    return this.label();
  }

  label() {
    const t = this.state.time, w = this.state.weather;
    const nice = { morning: 'Morning', afternoon: 'Afternoon', evening: 'Maghrib', night: 'Night' };
    const wx = { clear: '', cloudy: ', overcast', rain: ', raining' };
    return `${nice[t]}${wx[w]}`;
  }

  set(time, weather) {
    this.state = { time, weather };
    const p = TIMES[time];
    const rain = weather === 'rain';
    const overcast = weather === 'cloudy' || rain;

    // Weather dims and greys things.
    const dim = rain ? 0.4 : overcast ? 0.6 : 1;
    const grey = rain ? 0.55 : overcast ? 0.35 : 0;
    const toGrey = (hex, g) => new THREE.Color(hex).lerp(new THREE.Color(0x8a909a), g);

    // Sky
    this.sky.set(toGrey(p.sky[0], grey * 0.8), toGrey(p.sky[1], grey), toGrey(p.sky[2], grey * 0.5));

    // Sun / moon light through the window (-x), at the preset elevation.
    const L = this.lighting;
    const el = THREE.MathUtils.degToRad(p.sunEl);
    const target = new THREE.Vector3(0, 1, -0.7);
    L.sun.position.copy(target).add(new THREE.Vector3(-Math.cos(el) * 6, Math.sin(el) * 6, 0));
    L.sun.target.position.copy(target);
    L.sun.color.set(p.sunColor);
    L.sun.intensity = p.sunInt * dim;

    L.hemi.color.set(toGrey(p.hemiSky, grey * 0.6));
    L.hemi.groundColor.set(p.hemiGround);
    L.hemi.intensity = p.hemiInt * (overcast ? 0.8 : 1);
    L.ambient.color.set(p.ambColor);
    L.ambient.intensity = p.ambInt * (rain ? 1.1 : 1);
    L.lamp.intensity = Math.max(p.lamp, overcast ? 0.5 : 0) * 1.0;
    if (L.lampBulb) L.lampBulb.material.emissiveIntensity = L.lamp.intensity > 0.05 ? 1.8 : 0.2;

    // Fog + exposure
    this.scene.fog.color.set(toGrey(p.fog, grey * 0.5));
    this.scene.fog.density = p.fogD * (rain ? 2.1 : overcast ? 1.5 : 1);
    this.renderer.toneMappingExposure = p.exposure * this.exposureScale;

    // Celestial disc: place it out beyond the window along the light ray.
    const dir = this._tmp.copy(L.sun.position).sub(target).normalize();
    this.disc.position.copy(target).addScaledVector(dir, 12);
    const dm = this.disc.material, hm = this.halo.material;
    dm.color.set(p.discColor); hm.color.set(p.discColor);
    this.disc.scale.setScalar(p.discSize * (p.disc === 'moon' ? 0.8 : 1));
    const hidden = overcast; // sun/moon tucked behind cloud
    this.disc.visible = !hidden;
    hm.opacity = p.disc === 'moon' ? 0.14 : 0.22;

    // Rain
    this.rain.setActive(rain);
    if (rain) this._rainSound ||= this.audio?.loop?.('rain');
    else { this._rainSound?.stop?.(); this._rainSound = null; }
  }

  update(dt, t) {
    this.rain.update(dt);
    // Billboard the disc to face the player, with a gentle halo breathe.
    const cam = this.renderer.xr.isPresenting ? this.renderer.xr.getCamera() : this._cam;
    if (cam) { cam.getWorldPosition(this._tmp); this.disc.lookAt(this._tmp); }
    this.halo.material.opacity = (this.state.time === 'night' ? 0.14 : 0.22) + Math.sin(t * 0.001) * 0.03;
  }

  setCamera(cam) { this._cam = cam; }
}

// Falling rain as line-segment streaks, in two curtains that sit OUTSIDE the
// window and the doorway so you only ever see rain through the openings.
class Rain {
  constructor(scene, kitchen) {
    this.curtains = [
      this.#curtain(scene, new THREE.Vector3(-3.4, 1.6, -0.7), new THREE.Vector3(0.3, 3.4, 3.2), 220),
      this.#curtain(scene, new THREE.Vector3(0, 1.6, 3.6), new THREE.Vector3(3.6, 3.4, 0.3), 220),
    ];
    this.active = false;
  }

  #curtain(scene, center, size, count) {
    const positions = new Float32Array(count * 2 * 3);
    const speeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const x = center.x + (Math.random() - 0.5) * size.x;
      const y = center.y + (Math.random() - 0.5) * size.y;
      const z = center.z + (Math.random() - 0.5) * size.z;
      const len = 0.14 + Math.random() * 0.12;
      const b = i * 6;
      positions[b] = x; positions[b + 1] = y + len; positions[b + 2] = z;
      positions[b + 3] = x; positions[b + 4] = y; positions[b + 5] = z;
      speeds[i] = 5 + Math.random() * 4;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.LineBasicMaterial({ color: 0xbcc6d2, transparent: true, opacity: 0.5, fog: true });
    const lines = new THREE.LineSegments(geo, mat);
    lines.visible = false; lines.frustumCulled = false;
    scene.add(lines);
    return { lines, positions, speeds, center, size, count };
  }

  setActive(on) {
    this.active = on;
    for (const c of this.curtains) c.lines.visible = on;
  }

  update(dt) {
    if (!this.active) return;
    for (const c of this.curtains) {
      const p = c.positions;
      const floorY = c.center.y - c.size.y / 2;
      const topY = c.center.y + c.size.y / 2;
      for (let i = 0; i < c.count; i++) {
        const b = i * 6;
        const d = c.speeds[i] * dt;
        p[b + 1] -= d; p[b + 4] -= d;
        if (p[b + 4] < floorY) {
          const nx = c.center.x + (Math.random() - 0.5) * c.size.x;
          const nz = c.center.z + (Math.random() - 0.5) * c.size.z;
          const len = p[b + 1] - p[b + 4];
          p[b] = nx; p[b + 1] = topY + len; p[b + 2] = nz;
          p[b + 3] = nx; p[b + 4] = topY; p[b + 5] = nz;
        }
      }
      c.lines.geometry.attributes.position.needsUpdate = true;
    }
  }
}
