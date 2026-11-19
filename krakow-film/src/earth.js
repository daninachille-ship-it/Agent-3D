// Sequence 1a: planet Earth from space, zooming onto Poland and diving into Kraków.
import * as THREE from 'three';
import { canvasTex, glowPoints, rng, lerp, smooth, easeInOut, easeIn, clamp, hermite, glowTex } from './util.js';

const KRK = { lat: 50.0614, lon: 19.9366 };

export function llToVec(lat, lon, r = 1) {
  const phi = (lon + 180) * Math.PI / 180;
  const th = lat * Math.PI / 180;
  return new THREE.Vector3(-Math.cos(phi) * Math.cos(th) * r, Math.sin(th) * r, Math.sin(phi) * Math.cos(th) * r);
}

function drawGeo(g, feature, W, H, ox = 0) {
  const polys = feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates;
  for (const poly of polys) {
    for (const ring of poly) {
      let prev = null, shift = 0;
      ring.forEach(([lon, lat], i) => {
        if (prev !== null) { const d = lon + shift - prev; if (d > 180) shift -= 360; else if (d < -180) shift += 360; }
        const L = lon + shift; prev = L;
        const x = (L + 180) / 360 * W + ox, y = (90 - lat) / 180 * H;
        i ? g.lineTo(x, y) : g.moveTo(x, y);
      });
      g.closePath();
    }
  }
}

function valueNoise(w, h, seed, octaves = 5, base = 8) {
  const r = rng(seed);
  const out = new Float32Array(w * h);
  let amp = 1, total = 0;
  for (let o = 0; o < octaves; o++) {
    const gx = base << o, gy = Math.max(2, (base << o) >> 1);
    const grid = new Float32Array((gx + 1) * (gy + 1)).map(() => r());
    for (let x = 0; x <= gy; x++) grid[x * (gx + 1) + gx] = grid[x * (gx + 1)]; // wrap horizontally
    for (let y = 0; y < h; y++) {
      const fy = y / h * gy, iy = Math.floor(fy), ty = fy - iy, sy = ty * ty * (3 - 2 * ty);
      for (let x = 0; x < w; x++) {
        const fx = x / w * gx, ix = Math.floor(fx), tx = fx - ix, sx = tx * tx * (3 - 2 * tx);
        const a = grid[iy * (gx + 1) + ix], b = grid[iy * (gx + 1) + ix + 1];
        const c = grid[(iy + 1) * (gx + 1) + ix], d = grid[(iy + 1) * (gx + 1) + ix + 1];
        out[y * w + x] += amp * ((a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy);
      }
    }
    total += amp; amp *= 0.5;
  }
  for (let i = 0; i < out.length; i++) out[i] /= total;
  return out;
}

export function buildEarth(world, topojson) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x01030a);
  const countries = topojson.feature(world, world.objects.countries).features;
  const W = 8192, H = 4096;

  const map = canvasTex(W, H, (g) => {
    // ocean
    const oc = g.createLinearGradient(0, 0, 0, H);
    oc.addColorStop(0, '#0b2a52'); oc.addColorStop(0.5, '#0a3d78'); oc.addColorStop(1, '#0b2a52');
    g.fillStyle = oc; g.fillRect(0, 0, W, H);
    // continental shelf glow
    g.save(); g.filter = 'blur(10px)'; g.strokeStyle = 'rgba(70,170,210,0.55)'; g.lineWidth = 26;
    g.beginPath();
    for (const ox of [-W, 0, W]) for (const f of countries) drawGeo(g, f, W, H, ox);
    g.stroke();
    g.restore();
    // land on its own layer (so climate tints only touch land), then composited over the ocean
    const lc = document.createElement('canvas'); lc.width = W; lc.height = H; const lg = lc.getContext('2d');
    const r = rng(42);
    for (const f of countries) {
      const v = r();
      lg.fillStyle = `hsl(${78 + v * 34}, ${26 + v * 16}%, ${24 + v * 9}%)`;
      for (const ox of [-W, 0, W]) { lg.beginPath(); drawGeo(lg, f, W, H, ox); lg.fill(); }
    }
    lg.globalCompositeOperation = 'source-atop';
    const lat = (d) => (90 - d) / 180 * H;
    const band = (a, b, c) => { const gr = lg.createLinearGradient(0, lat(a), 0, lat(b)); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.5, c); gr.addColorStop(1, 'rgba(0,0,0,0)'); lg.fillStyle = gr; lg.fillRect(0, lat(a), W, lat(b) - lat(a)); };
    band(36, 6, 'rgba(190,160,105,0.45)');
    band(-12, -36, 'rgba(186,150,96,0.55)');
    band(90, 60, 'rgba(235,240,245,0.85)');
    lg.fillStyle = 'rgba(240,244,250,1)'; lg.fillRect(0, lat(-62), W, H);
    g.drawImage(lc, 0, 0);
    // borders
    g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = 1.6;
    g.beginPath(); for (const f of countries) drawGeo(g, f, W, H, 0); g.stroke();
  });
  // Poland highlight (emissive)
  const poland = countries.find((f) => f.id === '616');
  const emis = canvasTex(W, H, (g) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(255,60,70,0.55)'; g.beginPath(); drawGeo(g, poland, W, H); g.fill();
    g.strokeStyle = '#ffd0d0'; g.lineWidth = 5; g.beginPath(); drawGeo(g, poland, W, H); g.stroke();
    // Kraków dot
    const x = (KRK.lon + 180) / 360 * W, y = (90 - KRK.lat) / 180 * H;
    const gr = g.createRadialGradient(x, y, 0, x, y, 9); gr.addColorStop(0, '#ffe9b0'); gr.addColorStop(1, 'rgba(255,220,120,0)');
    g.fillStyle = gr; g.fillRect(x - 10, y - 10, 20, 20);
  });

  const earthMat = new THREE.MeshStandardMaterial({ map, emissiveMap: emis, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.75, metalness: 0.0 });
  const earth = new THREE.Mesh(new THREE.SphereGeometry(1, 192, 128), earthMat);
  scene.add(earth);

  // clouds
  const N = valueNoise(1024, 512, 7, 6, 6);
  const cloudTex = canvasTex(1024, 512, (g, w, h) => {
    const img = g.createImageData(w, h);
    for (let i = 0; i < w * h; i++) {
      const y = Math.floor(i / w) / h;
      const latBoost = 0.9 + 0.15 * Math.cos(y * Math.PI * 6);
      const a = clamp((N[i] * latBoost - 0.52) * 3.2);
      img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = 255; img.data[i * 4 + 3] = a * 235;
    }
    g.putImageData(img, 0, 0);
  });
  const clouds = new THREE.Mesh(new THREE.SphereGeometry(1.012, 128, 96), new THREE.MeshStandardMaterial({ map: cloudTex, transparent: true, depthWrite: false, roughness: 1 }));
  scene.add(clouds);

  // atmosphere rim
  const atmo = new THREE.Mesh(new THREE.SphereGeometry(1.08, 96, 64), new THREE.ShaderMaterial({
    uniforms: { uSun: { value: new THREE.Vector3(1, 0, 0) } },
    vertexShader: `varying vec3 vN; varying vec3 vV; varying vec3 vW; void main(){ vN = normalize(mat3(modelMatrix)*normal); vec4 w = modelMatrix*vec4(position,1.); vW=w.xyz; vV = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `uniform vec3 uSun; varying vec3 vN; varying vec3 vV; varying vec3 vW;
      void main(){ float f = 1.0 - abs(dot(vN, vV)); float rim = pow(f, 3.0); float lit = 0.35 + 0.65*clamp(dot(normalize(vW), uSun)*0.8+0.4,0.,1.);
        gl_FragColor = vec4(vec3(0.3,0.6,1.0)*rim*lit*1.1, 1.0); }`,
    side: THREE.BackSide, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
  }));
  scene.add(atmo);
  const atmoFront = new THREE.Mesh(new THREE.SphereGeometry(1.015, 96, 64), new THREE.ShaderMaterial({
    vertexShader: `varying vec3 vN; varying vec3 vV; void main(){ vN = normalize(mat3(modelMatrix)*normal); vec4 w = modelMatrix*vec4(position,1.); vV = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix*viewMatrix*w; }`,
    fragmentShader: `varying vec3 vN; varying vec3 vV; void main(){ float f = pow(1.0 - max(dot(vN, vV),0.), 4.0); gl_FragColor = vec4(vec3(0.35,0.65,1.0)*f*0.45, 1.0); }`,
    blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
  }));
  scene.add(atmoFront);

  // stars
  const r = rng(3), pos = [], col = [], siz = [];
  for (let i = 0; i < 4000; i++) {
    const v = new THREE.Vector3(r() * 2 - 1, r() * 2 - 1, r() * 2 - 1).normalize().multiplyScalar(60 + r() * 20);
    pos.push(v.x, v.y, v.z); const c = 0.6 + r() * 0.4; col.push(c, c, c * (0.9 + r() * 0.2)); siz.push(r() < 0.03 ? 3.5 : 0.6 + r() * 1.2);
  }
  const stars = glowPoints(pos, col, siz, { size: 0.12 });
  scene.add(stars);

  // Kraków beacon
  const kp = llToVec(KRK.lat, KRK.lon, 1.0);
  const beaconMat = new THREE.ShaderMaterial({
    uniforms: { uO: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: `uniform float uO; varying vec2 vUv; void main(){ float a = (1.0-vUv.y) * uO; gl_FragColor = vec4(vec3(1.0,0.82,0.45)*a*2.0, 1.0); }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
  });
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.0025, 0.004, 0.25, 16, 1, true), beaconMat);
  beacon.position.copy(kp.clone().multiplyScalar(1.125));
  beacon.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), kp.clone().normalize());
  scene.add(beacon);
  const pin = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0xffd27a, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  pin.position.copy(kp.clone().multiplyScalar(1.003)); scene.add(pin);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 64), new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  ring.position.copy(kp.clone().multiplyScalar(1.002)); ring.lookAt(kp.clone().multiplyScalar(2)); scene.add(ring);

  const sun = new THREE.DirectionalLight(0xfff4e0, 3.2);
  scene.add(sun);
  scene.add(new THREE.AmbientLight(0x223355, 0.35));
  // Lens flare-ish sun sprite
  const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0xfff1d0, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  sunSprite.scale.setScalar(14); scene.add(sunSprite);

  // Camera path in (lat, lon, dist)
  const keys = [
    { t: 0.0, v: [12, -42, 3.6] },
    { t: 1.3, v: [22, -24, 3.1] },
    { t: 3.3, v: [44, 10, 1.55] },
    { t: 4.2, v: [49.2, 18.6, 1.16] },
    { t: 5.05, v: [50.0, 19.9, 1.012] },
  ];

  function update(t, camera) {
    const [la, lo, d] = hermite(keys, t);
    const dir = llToVec(la, lo, 1).normalize();
    camera.position.copy(dir.clone().multiplyScalar(d));
    // look: from center toward Kraków as we dive, tilt forward near the end
    const k = smooth(3.4, 5.05, t);
    const north = new THREE.Vector3(0, 1, 0);
    const look = new THREE.Vector3().lerpVectors(new THREE.Vector3(0, 0, 0), kp.clone().add(north.clone().multiplyScalar(0.02 * k)), k);
    camera.up.set(0, 1, 0);
    camera.lookAt(look);
    camera.fov = lerp(32, 55, smooth(3.8, 5.05, t));
    camera.near = 0.0008; camera.far = 200;
    camera.updateProjectionMatrix();
    // sun from upper-left behind camera
    const right = new THREE.Vector3().crossVectors(dir, north).normalize();
    const sunDir = dir.clone().multiplyScalar(0.7).add(right.clone().multiplyScalar(-0.75)).add(north.clone().multiplyScalar(0.35)).normalize();
    sun.position.copy(sunDir.clone().multiplyScalar(10));
    atmo.material.uniforms.uSun.value.copy(sunDir);
    sunSprite.position.copy(dir.clone().multiplyScalar(-30).add(right.clone().multiplyScalar(-34)).add(north.clone().multiplyScalar(14)));
    earth.rotation.y = 0;
    clouds.rotation.y = t * 0.012;
    clouds.material.opacity = 1 - smooth(3.5, 4.3, t) * 0.88;
    earthMat.emissiveIntensity = smooth(2.4, 3.2, t) * (0.9 + 0.3 * Math.sin(t * 9)) * (1 - smooth(4.2, 4.9, t) * 0.7);
    beaconMat.uniforms.uO.value = smooth(3.4, 4.0, t);
    beacon.scale.y = 0.2 + 0.8 * smooth(3.4, 4.2, t);
    pin.scale.setScalar(0.012 * Math.min(1, (d - 1) / 0.5) * smooth(3.0, 3.6, t) + 0.0005);
    pin.material.opacity = smooth(3.0, 3.6, t);
    const rp = ((t - 3.6) * 0.8) % 1;
    ring.scale.setScalar((0.002 + Math.max(0, rp) * 0.03) * Math.min(1, (d - 1) / 0.4));
    ring.material.opacity = t > 3.6 ? (1 - rp) * 0.9 : 0;
    stars.material.uniforms.uScale.value = 600;
    const near = smooth(1.12, 1.35, d);
    beaconMat.uniforms.uO.value *= near; pin.material.opacity *= near; ring.material.opacity *= near;
    pin.visible = ring.visible = beacon.visible = near > 0.001;
    atmo.visible = d > 1.1; atmoFront.visible = d > 1.03;
    clouds.visible = d > 1.1; clouds.material.opacity *= smooth(1.1, 1.45, d);
  }
  return { scene, update, krakowScreen: kp };
}
