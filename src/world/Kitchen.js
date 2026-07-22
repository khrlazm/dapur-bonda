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
    this.#frontWall();
    this.#window();
    this.#counter();
    this.#stove();
    this.#shelves();
    this.#props();
  }

  // The fourth wall behind the player, with a doorway open to the kampung so the
  // room reads as enclosed and lived-in rather than a floating stage.
  #frontWall() {
    const z = 2.2, H = 3.2, yC = 1.6;
    const doorW = 1.1, doorH = 2.15;
    const g = new THREE.Group();

    const panel = (w, h, x, y) => {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), this.mat.wall);
      p.position.set(x, y, z); p.rotation.y = Math.PI; // face into the room
      p.receiveShadow = false; g.add(p);
    };
    panel(1.85, H, -1.475, yC);                    // left of the door
    panel(1.85, H, 1.475, yC);                     // right of the door
    panel(doorW, H - doorH, 0, doorH + (H - doorH) / 2); // lintel above the door

    // Wooden door frame + threshold.
    const fm = this.mat.woodDark;
    for (const x of [-0.57, 0.57]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.07, doorH, 0.12), fm);
      post.position.set(x, doorH / 2, z - 0.05); g.add(post);
    }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(doorW + 0.16, 0.1, 0.12), fm);
    beam.position.set(0, doorH, z - 0.05); g.add(beam);
    const sill = new THREE.Mesh(new THREE.BoxGeometry(doorW + 0.12, 0.04, 0.16), fm);
    sill.position.set(0, 0.02, z - 0.02); g.add(sill);

    // An ajar plank door, hinged on the left post, swung inward.
    const hinge = new THREE.Group();
    hinge.position.set(-0.55, 0, z - 0.02);
    const door = new THREE.Mesh(new THREE.BoxGeometry(doorW * 0.96, doorH * 0.98, 0.035), this.mat.wood);
    door.geometry.translate(doorW * 0.48, doorH * 0.49, 0); // pivot at the hinge edge
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.02, 10, 8), this.mat.brass);
    knob.position.set(doorW * 0.9, doorH * 0.49, 0.03); door.add(knob);
    hinge.add(door);
    hinge.rotation.y = -0.7; // ajar into the room
    g.add(hinge);

    // Warm daylight spilling in from the kampung outside.
    const glow = new THREE.PointLight(0xffe1a6, 0.7, 5, 2);
    glow.position.set(0, 1.3, z - 0.6);
    g.add(glow);

    this.group.add(g);
    this.anchors.door = new THREE.Vector3(0, 1.0, z);
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

    // Left wall, built as segments around a real window opening (so you can see
    // the sky/sun/moon/rain through it). Opening: z in [-1.45, 0.05] (centre
    // z=-0.7, 1.5 wide), y in [0.85, 2.15] (1.3 tall).
    const seg = (w, h, z, y) => {
      const s = new THREE.Mesh(new THREE.PlaneGeometry(w, h), wallMat);
      s.position.set(-2.4, y, z); s.rotation.y = Math.PI / 2;
      this.#add(s, { cast: false });
    };
    seg(9, 0.85, 0.5, 0.425);   // below the window
    seg(9, 1.05, 0.5, 2.675);   // above the window
    seg(2.55, 1.3, -2.725, 1.5); // left of the window (z <= -1.45)
    seg(4.95, 1.3, 2.525, 1.5);  // right of the window (z >= 0.05)

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
    // An OPEN window on the left wall — no glass, so the sky, sun, moon and rain
    // are visible through it. Wooden frame, a sill, and shutters thrown open.
    const frame = new THREE.Group();
    frame.position.set(-2.4, 1.5, -0.7);
    frame.rotation.y = Math.PI / 2;

    const barMat = this.mat.woodDark;
    const box = (w, h, d, x, y, z = 0) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), barMat);
      b.position.set(x, y, z); frame.add(b); return b;
    };
    // frame surround (in the window's local x = world z)
    box(1.6, 0.08, 0.14, 0, 0.68);   // top
    box(1.6, 0.1, 0.16, 0, -0.68);   // sill (deeper, a ledge)
    box(0.08, 1.44, 0.14, -0.78, 0); // left jamb
    box(0.08, 1.44, 0.14, 0.78, 0);  // right jamb
    box(0.05, 1.3, 0.05, 0, 0);      // one central mullion

    // Shutters, hinged at the jambs and swung open against the wall.
    const shutter = (side) => {
      const hinge = new THREE.Group();
      hinge.position.set(side * 0.78, 0, 0.02);
      const panel = new THREE.Mesh(new THREE.BoxGeometry(0.72, 1.3, 0.03), this.mat.wood);
      panel.geometry.translate(side * 0.36, 0, 0); // pivot at the jamb edge
      // slats
      for (let i = -2; i <= 2; i++) {
        const slat = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.04, 0.04), barMat);
        slat.position.set(side * 0.36, i * 0.22, 0.02); panel.add(slat);
      }
      hinge.add(panel);
      hinge.rotation.y = side * 2.4; // thrown open OUTWARD, back against the wall
      frame.add(hinge);
    };
    shutter(-1); shutter(1);

    this.group.add(frame);

    // Anchor + outward normal for the Environment (sun/moon/rain live out here).
    this.anchors.window = new THREE.Vector3(-2.4, 1.5, -0.7);
    this.anchors.windowOut = new THREE.Vector3(-1, 0, 0); // points outdoors (-x)
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

    // A little side table under the window light, with Bonda's pandan pot on it
    // (the pot used to float in mid-air past the counter's end).
    const tableTop = 0.85;
    const sideTable = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.05, 0.42), this.mat.wood);
    sideTable.position.set(-2.14, tableTop - 0.025, -0.05);
    this.#add(sideTable);
    for (const [dx, dz] of [[-0.17, -0.17], [0.17, -0.17], [-0.17, 0.17], [0.17, 0.17]]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.05, tableTop - 0.05, 0.05), this.mat.woodDark);
      leg.position.set(-2.14 + dx, (tableTop - 0.05) / 2, -0.05 + dz);
      this.#add(leg);
    }
    this.anchors.sideTable = new THREE.Vector3(-2.14, tableTop, -0.05);

    const potPos = new THREE.Vector3(-2.2, tableTop + 0.06, -0.18);
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.06, 0.12, 12), this.mat.ceramic);
    pot.position.copy(potPos);
    this.#add(pot);
    for (let i = 0; i < 7; i++) {
      const blade = new THREE.Mesh(
        new THREE.ConeGeometry(0.012, 0.22, 4),
        new THREE.MeshStandardMaterial({ color: 0x4a7c3a, roughness: 0.7 }),
      );
      blade.position.set(potPos.x + (Math.random() - 0.5) * 0.08, tableTop + 0.2, potPos.z + (Math.random() - 0.5) * 0.08);
      blade.rotation.z = (Math.random() - 0.5) * 0.5;
      this.#add(blade);
    }
    this.anchors.pandan = potPos.clone().setY(tableTop + 0.15);
  }

  update(t) {
    if (this.anchors.ember) {
      this.anchors.ember.material.emissiveIntensity = 2.0 + Math.sin(t * 0.008) * 0.5;
    }
  }
}
