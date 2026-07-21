import * as THREE from 'three/webgpu';
import {
  woodTexture, plasterTexture, batikTexture, bananaLeafTexture, weaveTexture,
} from './textures.js';

// Builds the traditional kampung kitchen: wooden floor & walls, a shuttered
// window the morning sun rakes through, a worn worktop, a stove with a steamer,
// shelves of jars, woven baskets, hanging brass utensils and banana leaves.
// Everything is low-poly + procedural-textured to stay light on the Quest.
export class Kitchen {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);

    this.counterTopY = 0.9;
    this.anchors = {};

    this.#materials();
    this.#floorAndWalls();
    this.#window();
    this.#counter();
    this.#stove();
    this.#shelves();
    this.#props();
  }

  #materials() {
    this.mat = {
      floor: new THREE.MeshStandardMaterial({ map: woodTexture({ repeat: 6 }), roughness: 0.85, metalness: 0.0 }),
      wall: new THREE.MeshStandardMaterial({ map: plasterTexture(), roughness: 0.95 }),
      wood: new THREE.MeshStandardMaterial({ map: woodTexture({ repeat: 2 }), roughness: 0.7 }),
      woodDark: new THREE.MeshStandardMaterial({ map: woodTexture({ dark: true, repeat: 2 }), roughness: 0.75 }),
      brass: new THREE.MeshStandardMaterial({ color: 0xb9923f, roughness: 0.32, metalness: 0.9 }),
      iron: new THREE.MeshStandardMaterial({ color: 0x2b2b2e, roughness: 0.5, metalness: 0.8 }),
      ceramic: new THREE.MeshStandardMaterial({ color: 0xf3efe6, roughness: 0.35, metalness: 0.0 }),
      leaf: new THREE.MeshPhysicalMaterial({ map: bananaLeafTexture(), roughness: 0.42, metalness: 0.0, side: THREE.DoubleSide, clearcoat: 0.6, clearcoatRoughness: 0.35 }),
      weave: new THREE.MeshStandardMaterial({ map: weaveTexture(), roughness: 0.85 }),
      cloth: new THREE.MeshStandardMaterial({ map: batikTexture('#7a2d2d'), roughness: 0.9 }),
    };
  }

  #add(mesh, { cast = true, receive = true } = {}) {
    mesh.castShadow = cast; mesh.receiveShadow = receive;
    this.group.add(mesh);
    return mesh;
  }

  #floorAndWalls() {
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), this.mat.floor);
    floor.rotation.x = -Math.PI / 2;
    this.#add(floor, { cast: false });

    const wallMat = this.mat.wall;
    const back = new THREE.Mesh(new THREE.PlaneGeometry(9, 3.2), wallMat);
    back.position.set(0, 1.6, -1.5);
    this.#add(back, { cast: false });

    const left = new THREE.Mesh(new THREE.PlaneGeometry(9, 3.2), wallMat);
    left.position.set(-2.4, 1.6, 0.5); left.rotation.y = Math.PI / 2;
    this.#add(left, { cast: false });

    const right = new THREE.Mesh(new THREE.PlaneGeometry(9, 3.2), wallMat);
    right.position.set(2.4, 1.6, 0.5); right.rotation.y = -Math.PI / 2;
    this.#add(right, { cast: false });

    const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), this.mat.woodDark);
    ceiling.position.set(0, 3.2, 0.5); ceiling.rotation.x = Math.PI / 2;
    this.#add(ceiling, { cast: false, receive: false });

    // exposed roof beams
    for (let i = -2; i <= 2; i++) {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.12, 0.12), this.mat.woodDark);
      beam.position.set(0, 3.05, i * 0.9);
      this.#add(beam, { receive: false });
    }
  }

  #window() {
    // A shuttered opening on the left wall — the sun source. We cut the illusion
    // with a bright emissive pane behind wooden mullions.
    const frame = new THREE.Group();
    frame.position.set(-2.38, 1.5, -0.7);
    frame.rotation.y = Math.PI / 2;

    const pane = new THREE.Mesh(
      new THREE.PlaneGeometry(1.5, 1.3),
      new THREE.MeshStandardMaterial({ color: 0xfff2cf, emissive: 0xffe6ad, emissiveIntensity: 1.4, roughness: 1 }),
    );
    frame.add(pane);

    const barMat = this.mat.woodDark;
    const mk = (w, h, x, y) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.06), barMat);
      b.position.set(x, y, 0.03); b.castShadow = true; frame.add(b);
    };
    mk(1.62, 0.09, 0, 0.66); mk(1.62, 0.09, 0, -0.66);
    mk(0.09, 1.4, -0.78, 0); mk(0.09, 1.4, 0.78, 0);
    mk(0.06, 1.3, 0, 0); mk(1.5, 0.06, 0, 0); // cross mullions

    this.group.add(frame);
  }

  #counter() {
    const top = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.08, 0.7), this.mat.wood);
    top.position.set(0.1, this.counterTopY, -0.75);
    this.#add(top);

    // legs / apron
    const apron = new THREE.Mesh(new THREE.BoxGeometry(2.35, 0.5, 0.6), this.mat.woodDark);
    apron.position.set(0.1, this.counterTopY - 0.3, -0.78);
    this.#add(apron);
    for (const [x, z] of [[-1.0, -0.5], [1.15, -0.5], [-1.0, -1.0], [1.15, -1.0]]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.09, this.counterTopY - 0.06, 0.09), this.mat.woodDark);
      leg.position.set(x + 0.1, (this.counterTopY - 0.06) / 2, z - 0.28);
      this.#add(leg);
    }

    // a woven mat + batik runner on the surface for warmth
    const mat = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.5), this.mat.weave);
    mat.rotation.x = -Math.PI / 2;
    mat.position.set(-0.55, this.counterTopY + 0.041, -0.72);
    this.#add(mat, { cast: false });

    this.anchors.prep = new THREE.Vector3(-0.55, this.counterTopY + 0.04, -0.72);
    this.anchors.book = new THREE.Vector3(-1.35, this.counterTopY + 0.04, -0.62);
    this.anchors.plating = new THREE.Vector3(0.35, this.counterTopY + 0.04, -0.66);
  }

  #stove() {
    // A simple masonry stove block with an iron ring and a warm ember glow.
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.7, 0.7), this.mat.wall);
    base.position.set(1.15, 0.35, -0.85);
    this.#add(base);

    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.035, 10, 24), this.mat.iron);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(1.15, 0.72, -0.85);
    this.#add(ring);

    const ember = new THREE.Mesh(
      new THREE.CircleGeometry(0.17, 20),
      new THREE.MeshStandardMaterial({ color: 0xff5a1e, emissive: 0xff4d10, emissiveIntensity: 2.2, roughness: 1 }),
    );
    ember.rotation.x = -Math.PI / 2;
    ember.position.set(1.15, 0.705, -0.85);
    this.group.add(ember);
    this.anchors.ember = ember;

    this.anchors.stove = new THREE.Vector3(1.15, 0.74, -0.85);
  }

  #shelves() {
    const shelfMat = this.mat.wood;
    for (let s = 0; s < 2; s++) {
      const y = 1.7 + s * 0.55;
      const shelf = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.05, 0.28), shelfMat);
      shelf.position.set(-0.1, y, -1.34);
      this.#add(shelf);
      // jars of spices
      for (let j = 0; j < 5; j++) {
        const jar = new THREE.Mesh(
          new THREE.CylinderGeometry(0.06, 0.06, 0.16, 16),
          new THREE.MeshStandardMaterial({
            color: new THREE.Color().setHSL(0.08 + j * 0.03, 0.5, 0.5),
            roughness: 0.2, metalness: 0, transparent: true, opacity: 0.85,
          }),
        );
        jar.position.set(-0.85 + j * 0.36, y + 0.11, -1.32);
        this.#add(jar);
      }
    }
  }

  #props() {
    // Hanging brass utensils on the back wall.
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.4, 8), this.mat.brass);
    rail.rotation.z = Math.PI / 2;
    rail.position.set(0.7, 1.45, -1.44);
    this.#add(rail);
    for (let i = 0; i < 4; i++) {
      const ladle = new THREE.Group();
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.28, 8), this.mat.brass);
      handle.position.y = -0.14;
      const cup = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 10, 0, Math.PI * 2, 0, Math.PI / 2), this.mat.brass);
      cup.rotation.x = Math.PI; cup.position.y = -0.3;
      ladle.add(handle, cup);
      ladle.position.set(0.3 + i * 0.28, 1.42, -1.42);
      ladle.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
      this.group.add(ladle);
    }

    // Woven baskets on the floor.
    for (const [x, z, r] of [[-1.7, 0.4, 0.28], [-1.4, 0.9, 0.22], [1.8, 0.5, 0.3]]) {
      const basket = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.8, r * 1.1, 18, 1, true), this.mat.weave);
      basket.position.set(x, r * 0.55, z);
      this.#add(basket);
    }

    // A stack of banana leaves near the plating area.
    for (let i = 0; i < 3; i++) {
      const leaf = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.32), this.mat.leaf);
      leaf.rotation.x = -Math.PI / 2;
      leaf.rotation.z = (i - 1) * 0.12;
      leaf.position.set(0.85, this.counterTopY + 0.042 + i * 0.003, -0.66);
      this.#add(leaf, { cast: false });
    }

    // A little potted herb by the window for life.
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.06, 0.12, 12), this.mat.ceramic);
    pot.position.set(-1.9, this.counterTopY + 0.06, -0.95);
    this.#add(pot);
    for (let i = 0; i < 7; i++) {
      const blade = new THREE.Mesh(
        new THREE.ConeGeometry(0.012, 0.22, 4),
        new THREE.MeshStandardMaterial({ color: 0x4a7c3a, roughness: 0.7 }),
      );
      blade.position.set(-1.9 + (Math.random() - 0.5) * 0.08, this.counterTopY + 0.2, -0.95 + (Math.random() - 0.5) * 0.08);
      blade.rotation.z = (Math.random() - 0.5) * 0.5;
      this.#add(blade);
    }
  }

  update(t) {
    if (this.anchors.ember) {
      this.anchors.ember.material.emissiveIntensity = 2.0 + Math.sin(t * 0.008) * 0.5;
    }
  }
}
