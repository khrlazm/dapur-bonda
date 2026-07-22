import * as THREE from 'three/webgpu';

// Golden-hour kampung lighting: a low warm key light through the window, a soft
// sky/ground hemisphere fill, and cheap "god ray" light shafts made of additive
// translucent slabs angled from the window. No expensive volumetric pass — this
// reads as warm morning light and stays fast on Quest.
export class Lighting {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);

    const hemi = new THREE.HemisphereLight(0xffe6bd, 0x5a4632, 0.55);
    scene.add(hemi);
    this.hemi = hemi;

    const ambient = new THREE.AmbientLight(0xffd9a8, 0.18);
    scene.add(ambient);
    this.ambient = ambient;

    // Key light: morning sun raking through the window on the left wall.
    const sun = new THREE.DirectionalLight(0xffd28a, 2.4);
    sun.position.set(-3.2, 2.6, -1.4);
    sun.target.position.set(0.3, 0.9, -0.8);
    sun.castShadow = false; // shadows are off for Quest performance
    scene.add(sun);
    scene.add(sun.target);
    this.sun = sun;

    // A warm bounce/point near the stove so the cooking area always glows.
    const stove = new THREE.PointLight(0xffb066, 0.9, 4, 2);
    stove.position.set(0.9, 1.15, -0.8);
    scene.add(stove);
    this.stove = stove;

    // A hanging lamp over the room — the Environment turns it up at night and
    // down in daylight so the kitchen stays readable after dark.
    const lamp = new THREE.PointLight(0xffca73, 0.0, 7, 1.6);
    lamp.position.set(0.1, 2.7, -0.2);
    scene.add(lamp);
    this.lamp = lamp;
    const shade = new THREE.Mesh(
      new THREE.ConeGeometry(0.18, 0.16, 16, 1, true),
      new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: 0.7, side: THREE.DoubleSide }),
    );
    shade.position.set(0.1, 2.78, -0.2);
    scene.add(shade);
    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.04, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0xfff0d0, emissive: 0xffd28a, emissiveIntensity: 1.5, roughness: 1 }),
    );
    bulb.position.set(0.1, 2.7, -0.2);
    scene.add(bulb);
    this.lampBulb = bulb;

    this.#buildShafts();
  }

  #buildShafts() {
    const shafts = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffe1a6,
      transparent: true,
      opacity: 0.06,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: false,
    });
    for (let i = 0; i < 5; i++) {
      const geo = new THREE.PlaneGeometry(0.28, 3.6);
      const m = new THREE.Mesh(geo, mat);
      m.position.set(-2.2 + i * 0.02, 1.7, -0.9 + (i - 2) * 0.22);
      m.rotation.z = Math.PI * 0.16;
      m.rotation.y = Math.PI * 0.5;
      shafts.add(m);
    }
    shafts.position.set(0, 0, 0);
    this.shafts = shafts;
    this.scene.add(shafts);
  }

  // Drift the shafts a touch so the light feels alive.
  update(t) {
    if (this.shafts) this.shafts.children.forEach((m, i) => {
      m.material.opacity = 0.05 + Math.sin(t * 0.0006 + i) * 0.02;
    });
    if (this.stove) this.stove.intensity = 0.85 + Math.sin(t * 0.006) * 0.12; // gentle flicker
  }
}
