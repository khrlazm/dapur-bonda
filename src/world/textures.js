// Procedural canvas textures. Everything the kitchen is made of is painted
// here at runtime so the game has ZERO external asset dependencies — it will
// always load, on any machine, online or off.
import * as THREE from 'three/webgpu';

const cache = new Map();

function makeCanvas(size = 512) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return c;
}

// Fine monochrome film grain baked into every texture for a hand-painted, aged
// feel. Perturbs each pixel's luminance by ±amount.
export function grain(ctx, w, h, amount = 16) {
  if (amount <= 0) return;
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * 2 * amount;
    d[i] = Math.min(255, Math.max(0, d[i] + n));
    d[i + 1] = Math.min(255, Math.max(0, d[i + 1] + n));
    d[i + 2] = Math.min(255, Math.max(0, d[i + 2] + n));
  }
  ctx.putImageData(img, 0, 0);
}

function finalize(canvas, { repeat = 1, srgb = true, grainAmount = 16 } = {}) {
  grain(canvas.getContext('2d'), canvas.width, canvas.height, grainAmount);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.anisotropy = 8;
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

// Cheap value-noise helper.
function noise(ctx, size, { count = 20000, alpha = 0.05, hue = [30, 40], light = [20, 60] }) {
  for (let i = 0; i < count; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const h = hue[0] + Math.random() * (hue[1] - hue[0]);
    const l = light[0] + Math.random() * (light[1] - light[0]);
    ctx.fillStyle = `hsla(${h}, 40%, ${l}%, ${alpha})`;
    ctx.fillRect(x, y, 1 + Math.random() * 2, 1 + Math.random() * 2);
  }
}

export function woodTexture(opts = {}) {
  const key = 'wood' + JSON.stringify(opts);
  if (cache.has(key)) return cache.get(key);
  const size = 512;
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext('2d');
  const base = opts.dark ? '#5a3d24' : '#8a5a34';
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  // Grain lines running vertically, warped.
  for (let i = 0; i < 90; i++) {
    const x = (i / 90) * size + Math.sin(i) * 6;
    ctx.strokeStyle = `hsla(28, 45%, ${18 + Math.random() * 22}%, ${0.10 + Math.random() * 0.18})`;
    ctx.lineWidth = 1 + Math.random() * 3;
    ctx.beginPath();
    for (let y = 0; y <= size; y += 8) {
      const wob = Math.sin(y * 0.02 + i) * 5 + Math.sin(y * 0.11 + i * 2) * 2;
      if (y === 0) ctx.moveTo(x + wob, y);
      else ctx.lineTo(x + wob, y);
    }
    ctx.stroke();
  }
  // Occasional knots.
  for (let k = 0; k < 3; k++) {
    const kx = Math.random() * size, ky = Math.random() * size;
    for (let r = 12; r > 0; r--) {
      ctx.strokeStyle = `hsla(24, 50%, ${14 + r}%, 0.10)`;
      ctx.beginPath();
      ctx.ellipse(kx, ky, r * 1.6, r, Math.random(), 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  noise(ctx, size, { count: 26000, alpha: 0.04, hue: [26, 36], light: [20, 55] });
  const tex = finalize(canvas, { repeat: opts.repeat ?? 2 });
  cache.set(key, tex);
  return tex;
}

export function plasterTexture() {
  if (cache.has('plaster')) return cache.get('plaster');
  const size = 512;
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#c9b89a';
  ctx.fillRect(0, 0, size, size);
  noise(ctx, size, { count: 40000, alpha: 0.05, hue: [35, 45], light: [40, 78] });
  // Subtle vertical water staining.
  for (let i = 0; i < 24; i++) {
    const x = Math.random() * size;
    const g = ctx.createLinearGradient(x, 0, x, size);
    g.addColorStop(0, 'rgba(90,70,45,0.0)');
    g.addColorStop(1, `rgba(90,70,45,${0.03 + Math.random() * 0.05})`);
    ctx.fillStyle = g;
    ctx.fillRect(x, 0, 20 + Math.random() * 40, size);
  }
  const tex = finalize(canvas, { repeat: 3 });
  cache.set('plaster', tex);
  return tex;
}

// Batik-inspired tiling motif for cloth / accents.
export function batikTexture(color = '#7a2d2d') {
  const key = 'batik' + color;
  if (cache.has(key)) return cache.get(key);
  const size = 256;
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = 'rgba(243,228,196,0.75)';
  ctx.fillStyle = 'rgba(243,228,196,0.75)';
  const step = size / 4;
  for (let gx = 0; gx < 4; gx++) {
    for (let gy = 0; gy < 4; gy++) {
      const cx = gx * step + step / 2;
      const cy = gy * step + step / 2;
      // little flower
      for (let p = 0; p < 6; p++) {
        const a = (p / 6) * Math.PI * 2;
        ctx.beginPath();
        ctx.ellipse(cx + Math.cos(a) * 10, cy + Math.sin(a) * 10, 4, 8, a, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(cx, cy, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const tex = finalize(canvas, { repeat: 1 });
  cache.set(key, tex);
  return tex;
}

export function bananaLeafTexture() {
  if (cache.has('leaf')) return cache.get('leaf');
  const size = 512;
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, size, size);
  g.addColorStop(0, '#3f7a2e');
  g.addColorStop(1, '#2c5f22');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  // central midrib + veins
  ctx.strokeStyle = 'rgba(200,220,150,0.55)';
  ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(size / 2, 0); ctx.lineTo(size / 2, size); ctx.stroke();
  ctx.lineWidth = 1.4;
  for (let y = 0; y < size; y += 12) {
    ctx.strokeStyle = 'rgba(190,215,140,0.30)';
    ctx.beginPath(); ctx.moveTo(size / 2, y); ctx.lineTo(size, y + 40); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(size / 2, y); ctx.lineTo(0, y + 40); ctx.stroke();
  }
  noise(ctx, size, { count: 20000, alpha: 0.04, hue: [90, 120], light: [25, 45] });
  const tex = finalize(canvas, { repeat: 1 });
  cache.set('leaf', tex);
  return tex;
}

export function weaveTexture() {
  if (cache.has('weave')) return cache.get('weave');
  const size = 256;
  const canvas = makeCanvas(size);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#b9915a';
  ctx.fillRect(0, 0, size, size);
  const n = 16, s = size / n;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const over = (x + y) % 2 === 0;
      ctx.fillStyle = over ? '#caa268' : '#a87f47';
      ctx.fillRect(x * s + 1, y * s + 1, s - 2, s - 2);
      ctx.fillStyle = 'rgba(0,0,0,0.06)';
      ctx.fillRect(x * s + (over ? s - 3 : 0), y * s, 3, s);
    }
  }
  const tex = finalize(canvas, { repeat: 4 });
  cache.set('weave', tex);
  return tex;
}

// Soft radial blob for fake contact shadows under furniture/props.
export function shadowBlob() {
  if (cache.has('shadowBlob')) return cache.get('shadowBlob');
  const s = 128;
  const canvas = makeCanvas(s);
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(0,0,0,0.9)');
  g.addColorStop(0.5, 'rgba(0,0,0,0.6)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  cache.set('shadowBlob', tex);
  return tex;
}

// Parchment for the recipe book pages (returns a canvas so pages can be drawn on).
export function parchmentCanvas(w = 1024, h = 1024) {
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(w / 2, h / 2, h * 0.2, w / 2, h / 2, h * 0.75);
  g.addColorStop(0, '#f6ead0');
  g.addColorStop(1, '#e6d2a8');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // grain speckle
  for (let i = 0; i < 12000; i++) {
    ctx.fillStyle = `rgba(120,90,50,${Math.random() * 0.04})`;
    ctx.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5);
  }
  // coffee ring
  const rx = w * (0.65 + Math.random() * 0.2), ry = h * (0.15 + Math.random() * 0.1), rr = 60;
  ctx.strokeStyle = 'rgba(120,80,40,0.14)';
  ctx.lineWidth = 6;
  ctx.beginPath(); ctx.arc(rx, ry, rr, 0, Math.PI * 2); ctx.stroke();
  // aged edges
  const eg = ctx.createLinearGradient(0, 0, 0, h);
  eg.addColorStop(0, 'rgba(90,60,30,0.22)');
  eg.addColorStop(0.1, 'rgba(90,60,30,0)');
  eg.addColorStop(0.9, 'rgba(90,60,30,0)');
  eg.addColorStop(1, 'rgba(90,60,30,0.22)');
  ctx.fillStyle = eg;
  ctx.fillRect(0, 0, w, h);
  grain(ctx, w, h, 12); // paper grain (text is drawn over this later, stays crisp)
  return canvas;
}
