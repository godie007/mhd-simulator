// main.js — Escena 3D (Three.js), interfaz y simulación en vivo del mejor
// genoma que va encontrando el algoritmo genético en el worker.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { Simulation, randomGenome, makeRng } from './physics.js';

// ----------------------------------------------------------------------------
// Configuración por defecto (la UI la sobreescribe).
// ----------------------------------------------------------------------------
function readConfig() {
  const v = (id) => parseFloat(document.getElementById(id).value);
  const s = (id) => document.getElementById(id).value;
  return {
    numCoils: Math.round(v('numCoils')),
    numCannons: Math.round(v('numCannons')),        // cañones (independiente de bobinas)
    numElectrons: Math.round(v('numElectrons')),   // capacidad máxima del recipiente
    maxParticles: Math.round(v('numElectrons')),
    injectionRate: v('injectionRate'),             // partículas/seg que disparan los cañones
    populationSize: Math.round(v('population')),
    mutationRate: v('mutationRate'),
    mutationSigma: 0.18,
    episodeSteps: Math.round(v('episodeSteps')),
    coilPreset: s('coilPreset'),
    numLasers: Math.round(v('numLasers')),
    // potencias reales -> unidades de simulación
    cannonPowerKW: v('cannonPower'),       // kW (referencia 2 kW)
    laserPowerW: v('laserPower'),          // W por láser (referencia 5 W)
    laserPower: v('laserPower') * 0.2,     // 5 W -> 1.0 (calentamiento débil)
    laserRadius: 0.12,
    R: 1.0,
    v0: 0.6 * Math.sqrt(v('cannonPower') / 2),  // 2 kW -> v0 = 0.6
    dt: 0.02,
    eps: 0.18,
    kmag: 2.5,
    qm: 1.0,
    seed: 1,
    gaSeed: (Math.random() * 1e9) >>> 0,
  };
}

// ----------------------------------------------------------------------------
// Escena
// ----------------------------------------------------------------------------
const canvas = document.getElementById('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
// Tone mapping filmico + bloom => brillo de plasma realista (no quema los colores).
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05060a);
const camera = new THREE.PerspectiveCamera(55, 1, 0.01, 100);
camera.position.set(2.4, 1.6, 2.4);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// Postproceso: bloom en espacio de pantalla (coste fijo, no depende de Nº de
// partículas). Hace que electrones y láseres brillen como plasma real.
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloomPass = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.65, 0.45, 0.22);
composer.addPass(bloomPass);
composer.addPass(new OutputPass());

// Textura de orbe suave (degradado radial) para que cada electrón sea un punto
// de luz redondo y difuso en vez de un cuadrado.
function makeParticleTexture() {
  const s = 64;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0.0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.55)');
  g.addColorStop(1.0, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const particleTexture = makeParticleTexture();

scene.add(new THREE.AmbientLight(0x404050, 1.5));
const dl = new THREE.DirectionalLight(0xffffff, 1.0);
dl.position.set(3, 4, 2);
scene.add(dl);

let boundary, coilMeshes = [], cannonMeshes = [], electronPoints = null, laserLines = [];
let laserGroup = new THREE.Group();
let group = new THREE.Group();
scene.add(group);

let cannonGroup = new THREE.Group();

function buildCannons(sim) {
  // limpiar solo los cañones
  cannonGroup.clear();
  cannonMeshes = [];

  // cañones = fuentes de electrones. Verde brillante (distinto del naranja de las
  // bobinas y el cian de los electrones) y sobresalen de la esfera, para que su
  // número se vea y se cuente con claridad. Solo aparecen donde hay cañón.
  const cone = new THREE.ConeGeometry(0.07, 0.2, 14);
  for (const c of sim.cannons) {
    const m = new THREE.Mesh(cone, new THREE.MeshPhongMaterial({
      color: 0x3dff95, emissive: 0x0c4a2c, emissiveIntensity: 1.3,
    }));
    m.position.set(c[0] * sim.cfg.R * 1.12, c[1] * sim.cfg.R * 1.12, c[2] * sim.cfg.R * 1.12);
    m.lookAt(0, 0, 0);
    m.rotateX(Math.PI / 2);
    cannonGroup.add(m);
    cannonMeshes.push(m);
  }
}

function buildLasers(sim) {
  // limpiar solo los láseres
  laserGroup.clear();
  laserLines = [];

  // láseres: haces desde el hueco entre 3 bobinas hacia el centro.
  // El AG enciende/apaga cada uno; el render refleja su estado en updateLive.
  for (const L of sim.lasers) {
    const geoL = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(L.pos[0], L.pos[1], L.pos[2]),
      new THREE.Vector3(0, 0, 0),
    ]);
    const line = new THREE.Line(geoL, new THREE.LineBasicMaterial({
      color: 0xff3355, transparent: true, opacity: 0.5,
      blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    laserGroup.add(line);
    // emisor en el hueco
    const emit = new THREE.Mesh(
      new THREE.SphereGeometry(0.018, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xff5577 })
    );
    emit.position.set(L.pos[0], L.pos[1], L.pos[2]);
    laserGroup.add(emit);
    laserLines.push({ line, emit });
  }
}

function buildScene(sim) {
  // limpiar
  group.clear();
  cannonGroup.clear();
  laserGroup.clear();
  coilMeshes = []; cannonMeshes = []; laserLines = [];

  // frontera esférica
  const sg = new THREE.SphereGeometry(sim.cfg.R, 32, 24);
  const boundaryWire = new THREE.Mesh(
    sg, new THREE.MeshBasicMaterial({ color: 0x2a6cff, wireframe: true, transparent: true, opacity: 0.12 })
  );
  group.add(boundaryWire);
  const shell = new THREE.Mesh(
    sg, new THREE.MeshPhongMaterial({ color: 0x1133aa, transparent: true, opacity: 0.05, side: THREE.BackSide })
  );
  group.add(shell);

  // malla triangular entre bobinas vecinas (los láseres van en cada hueco)
  if (sim.coilEdges && sim.coilEdges.length) {
    const pts = [];
    for (const [a, b] of sim.coilEdges) {
      pts.push(new THREE.Vector3(a[0], a[1], a[2]), new THREE.Vector3(b[0], b[1], b[2]));
    }
    const eg = new THREE.BufferGeometry().setFromPoints(pts);
    group.add(new THREE.LineSegments(eg, new THREE.LineBasicMaterial({
      color: 0x33507a, transparent: true, opacity: 0.3,
    })));
  }

  // bobinas (toros orientados hacia el centro), color por corriente.
  // El anillo llega hasta la mitad del camino a la bobina vecina => los campos
  // cubren su espacio. El tubo escala con el anillo.
  const ringR = sim.coilRingR || 0.07;
  const torus = new THREE.TorusGeometry(ringR, Math.max(0.006, ringR * 0.05), 10, 36);
  for (const c of sim.coils) {
    const m = new THREE.Mesh(torus, new THREE.MeshPhongMaterial({
      color: 0x888888, emissive: 0x000000, transparent: true, opacity: 0.85,
    }));
    m.position.set(c[0] * sim.cfg.R, c[1] * sim.cfg.R, c[2] * sim.cfg.R);
    m.lookAt(0, 0, 0);
    group.add(m);
    coilMeshes.push(m);
  }

  // construir cañones
  buildCannons(sim);
  group.add(cannonGroup);

  // electrones (orbes de luz; color por rapidez => mapa de calor del plasma)
  const n = sim.cfg.maxParticles ?? sim.cfg.numElectrons;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  const mat = new THREE.PointsMaterial({
    size: 0.05, sizeAttenuation: true, map: particleTexture,
    vertexColors: true, blending: THREE.AdditiveBlending,
    transparent: true, depthWrite: false,
  });
  electronPoints = new THREE.Points(geo, mat);
  group.add(electronPoints);

  // construir láseres
  buildLasers(sim);
  group.add(laserGroup);

  // marcador del centro
  const center = new THREE.Mesh(
    new THREE.SphereGeometry(0.02, 12, 12),
    new THREE.MeshBasicMaterial({ color: 0xffffff })
  );
  group.add(center);

  // contador 3D de partículas confinadas (sprite que mira a la cámara)
  buildCounter();
  group.add(counter.sprite);
}

// ----------------------------------------------------------------------------
// Contador 3D dentro de la esfera (textura en canvas sobre un sprite)
// ----------------------------------------------------------------------------
let counter = null;
function buildCounter() {
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  const mat = new THREE.SpriteMaterial({
    map: texture, transparent: true, depthTest: false, depthWrite: false,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(0.8, 0.4, 1);
  // sobre la esfera, en el eje de rotación (queda fijo y no tapa la figura)
  sprite.position.set(0, 1.5, 0);
  sprite.renderOrder = 999;
  counter = { canvas, ctx, texture, sprite };
}

function drawCounter(confined) {
  if (!counter) return;
  if (counter.last === confined) return; // sin cambios
  counter.last = confined;
  const { ctx, canvas, texture } = counter;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.textAlign = 'center';
  // número grande = partículas que quedan en confinamiento
  ctx.fillStyle = '#66e0ff';
  ctx.shadowColor = '#0a1a2a'; ctx.shadowBlur = 8;
  ctx.font = 'bold 72px -apple-system, Segoe UI, sans-serif';
  ctx.fillText(String(confined), canvas.width / 2, 70);
  // etiqueta
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#9fb0c8';
  ctx.font = '22px -apple-system, Segoe UI, sans-serif';
  ctx.fillText('en confinamiento', canvas.width / 2, 104);
  texture.needsUpdate = true;
}

// ----------------------------------------------------------------------------
// Simulación en vivo
// ----------------------------------------------------------------------------
let liveSim = null;
let cfg = readConfig();

function newLiveSim() {
  cfg = readConfig();
  cfg.seed = (Math.random() * 1e9) >>> 0;
  const g = randomGenome(cfg.numCoils, cfg.numLasers | 0, makeRng((Math.random() * 1e9) >>> 0));
  liveSim = new Simulation({ ...cfg }, g);
  buildScene(liveSim);
  bestGenome = null;
}

let bestGenome = null;

function updateLive() {
  if (!liveSim) return;
  if (bestGenome) liveSim.setGenome(bestGenome);
  // varios subpasos por frame para fluidez
  const sub = 2;
  for (let s = 0; s < sub; s++) {
    liveSim.step(liveSim.cfg.dt); // los cañones inyectan; los escapes se pierden
  }

  // Un solo recorrido: posición + color por rapidez (azul frío → blanco caliente)
  // + radio medio para el HUD. Array compacto 0..n-1, sin máscara alive.
  if (!electronPoints) return;
  const g = electronPoints.geometry;
  const posA = g.attributes.position.array;
  const colA = g.attributes.color.array;
  const np = liveSim.n;
  const Rb = liveSim.cfg.R;
  const vlo = liveSim.cfg.v0 * 0.7;
  const vspan = ((liveSim.vmax || liveSim.cfg.v0 * 2.6) - vlo) || 1;
  let sumR = 0;
  for (let i = 0; i < np; i++) {
    const ix = i * 3;
    const px = liveSim.pos[ix], py = liveSim.pos[ix + 1], pz = liveSim.pos[ix + 2];
    posA[ix] = px; posA[ix + 1] = py; posA[ix + 2] = pz;
    const sp = Math.hypot(liveSim.vel[ix], liveSim.vel[ix + 1], liveSim.vel[ix + 2]);
    let ts = (sp - vlo) / vspan; ts = ts < 0 ? 0 : ts > 1 ? 1 : ts;
    colA[ix] = 0.2 + 0.8 * ts * ts;   // R sube con la energía cinética
    colA[ix + 1] = 0.55 + 0.45 * ts;  // G
    colA[ix + 2] = 1.0 - 0.35 * ts;   // B domina en frío (azul)
    sumR += Math.hypot(px, py, pz);
  }
  g.setDrawRange(0, np);
  g.attributes.position.needsUpdate = true;
  g.attributes.color.needsUpdate = true;
  // subir a GPU solo el rango vivo (no los 20k del buffer)
  if (g.attributes.position.updateRange) g.attributes.position.updateRange.count = np * 3;
  if (g.attributes.color.updateRange) g.attributes.color.updateRange.count = np * 3;

  // colorear bobinas por corriente instantánea
  for (let i = 0; i < coilMeshes.length; i++) {
    const I = liveSim.currents[i] || 0;
    const mag = Math.min(1, Math.abs(I) / 3);
    const mat = coilMeshes[i].material;
    if (I >= 0) mat.emissive.setRGB(mag, mag * 0.25, 0); // rojo/naranja
    else mat.emissive.setRGB(0, mag * 0.4, mag);          // azul
    mat.color.setRGB(0.3 + 0.5 * mag, 0.3, 0.3 + 0.5 * (I < 0 ? mag : 0));
  }

  // métricas en vivo (radio medio ya acumulado en el bucle anterior)
  document.getElementById('liveInside').textContent = `${np}`;
  document.getElementById('liveRadius').textContent = np ? (sumR / np / Rb).toFixed(3) : '—';
  drawCounter(np); // total acumulado en confinamiento (acumulación ilimitada)
  const onCount = liveSim.lasersOnCount ? liveSim.lasersOnCount() : 0;
  document.getElementById('liveLasers').textContent = `${onCount}/${liveSim.lasers.length}`;

  // láseres encendidos (AG): brillan y pulsan; apagados: tenues
  if (laserLines.length) {
    const pulse = 0.45 + 0.4 * (0.5 + 0.5 * Math.sin(liveSim.t * 12));
    for (let k = 0; k < laserLines.length; k++) {
      const on = liveSim.laserOn && liveSim.laserOn[k];
      const { line, emit } = laserLines[k];
      line.material.opacity = on ? pulse : 0.04;
      line.material.color.setHex(on ? 0xff3355 : 0x334455);
      emit.material.color.setHex(on ? 0xff5577 : 0x334455);
      emit.scale.setScalar(on ? 1 : 0.6);
    }
  }

  // panel de frecuencias por par (throttle)
  frameCount++;
  if (frameCount % 12 === 0) renderFreqPanel();
}

let frameCount = 0;
function renderFreqPanel() {
  if (!liveSim) return;
  const params = liveSim.groupParams();
  const fCommon = params.length ? params[0].f : 0;
  const header = `<div class="freqHead">f común = <b>${fCommon.toFixed(2)} Hz</b> · desfase 60°</div>`;
  const html = params.map((p, i) => {
    const pair = p.coils.length === 2 ? `bobinas ${p.coils[0] + 1}↔${p.coils[1] + 1}` : `bobina ${p.coils[0] + 1}`;
    const w = Math.min(100, (p.A / 3) * 100); // amplitud 0..3 -> 0..100%
    // corriente instantánea de la primera bobina del par (signo/intensidad)
    const I = liveSim.currents[p.coils[0]] || 0;
    const on = Math.min(1, Math.abs(I) / 3);
    return `<div class="freqRow">
      <span class="fLbl">P${i + 1} <em>${pair}</em></span>
      <span class="fBar"><i style="width:${w}%"></i></span>
      <span class="fHz" style="opacity:${0.4 + 0.6 * on}">${p.phaseDeg}°</span>
    </div>`;
  }).join('');
  document.getElementById('freqList').innerHTML = header + html;
}

// ----------------------------------------------------------------------------
// Worker + AG
// ----------------------------------------------------------------------------
let worker = null;
let history = []; // [{gen,best,avg}]
let evolving = false;

function startWorker() {
  if (worker) worker.terminate();
  worker = new Worker(new URL('./sim-worker.js', import.meta.url), { type: 'module' });
  worker.onmessage = (e) => {
    const m = e.data;
    if (m.type === 'gen') {
      const s = m.stats;
      bestGenome = Float64Array.from(s.bestGenome);
      history.push({ gen: s.generation, best: s.best, avg: s.avg, allBest: s.allTimeBest });
      if (history.length > 600) history.shift();
      document.getElementById('genNum').textContent = s.generation;
      document.getElementById('bestFit').textContent = s.allTimeBest.toFixed(4);
      document.getElementById('avgFit').textContent = s.avg.toFixed(4);
      drawChart();
    }
  };
}

function initEvolution() {
  history = [];
  bestGenome = null;
  const c = readConfig();
  // mantener la config viva sincronizada con la del AG
  liveSim = new Simulation({ ...c }, randomGenome(c.numCoils, c.numLasers | 0, makeRng(c.seed)));
  buildScene(liveSim);
  startWorker();
  worker.postMessage({ type: 'init', config: c });
}

// ----------------------------------------------------------------------------
// Gráfica de fitness
// ----------------------------------------------------------------------------
const chart = document.getElementById('chart');
const cctx = chart.getContext('2d');
function drawChart() {
  const w = chart.width, h = chart.height;
  cctx.clearRect(0, 0, w, h);
  cctx.fillStyle = '#0a0c14'; cctx.fillRect(0, 0, w, h);
  if (history.length < 2) return;
  let lo = Infinity, hi = -Infinity;
  for (const p of history) { lo = Math.min(lo, p.avg, p.best); hi = Math.max(hi, p.best, p.allBest); }
  if (hi - lo < 1e-6) hi = lo + 1;
  const pad = 6;
  const X = (i) => pad + (i / (history.length - 1)) * (w - 2 * pad);
  const Y = (v) => h - pad - ((v - lo) / (hi - lo)) * (h - 2 * pad);
  const line = (key, color) => {
    cctx.strokeStyle = color; cctx.lineWidth = 1.5; cctx.beginPath();
    history.forEach((p, i) => { const x = X(i), y = Y(p[key]); i ? cctx.lineTo(x, y) : cctx.moveTo(x, y); });
    cctx.stroke();
  };
  line('avg', '#5577aa');
  line('best', '#66e0ff');
  line('allBest', '#7CFF6B');
}

// ----------------------------------------------------------------------------
// UI
// ----------------------------------------------------------------------------
function bindSlider(id) {
  const el = document.getElementById(id);
  const out = document.getElementById(id + 'Val');
  const upd = () => { if (out) out.textContent = el.value; };
  el.addEventListener('input', upd); upd();
}
['numCoils','numCannons','numElectrons','injectionRate','population','mutationRate','episodeSteps','cannonPower','numLasers','laserPower'].forEach(bindSlider);

// El nº máximo de cañones es proporcional al nº de bobinas (1 .. numCoils):
// el tope del slider sigue al de bobinas y se recorta el valor si lo excede.
function syncCannonMax() {
  const coils = Math.round(parseFloat(document.getElementById('numCoils').value));
  const can = document.getElementById('numCannons');
  can.max = String(coils);
  if (parseFloat(can.value) > coils) can.value = String(coils);
  const out = document.getElementById('numCannonsVal');
  if (out) out.textContent = can.value;
}
document.getElementById('numCoils').addEventListener('input', syncCannonMax);
syncCannonMax();

// Actualizar cañones en tiempo real cuando cambia el slider
function updateCannonsLive() {
  if (!liveSim || evolving) return; // no cambiar durante evolución
  const newNumCannons = Math.round(parseFloat(document.getElementById('numCannons').value));
  if (liveSim.cannons.length === newNumCannons) return; // sin cambios

  // reconstruir simulación en vivo con nuevo nº de cañones
  const newCfg = readConfig();
  const g = randomGenome(newCfg.numCoils, newCfg.numLasers | 0, makeRng((Math.random() * 1e9) >>> 0));
  liveSim = new Simulation({ ...newCfg }, g);
  buildCannons(liveSim);
  group.remove(cannonGroup);
  group.add(cannonGroup);
}
document.getElementById('numCannons').addEventListener('input', updateCannonsLive);

// Actualizar láseres en tiempo real cuando cambia el slider
function updateLasersLive() {
  if (!liveSim || evolving) return; // no cambiar durante evolución
  const newNumLasers = Math.round(parseFloat(document.getElementById('numLasers').value));
  if (liveSim.lasers.length === newNumLasers) return; // sin cambios

  // reconstruir simulación en vivo con nuevo nº de láseres
  const newCfg = readConfig();
  const g = randomGenome(newCfg.numCoils, newCfg.numLasers | 0, makeRng((Math.random() * 1e9) >>> 0));
  liveSim = new Simulation({ ...newCfg }, g);
  buildLasers(liveSim);
  group.remove(laserGroup);
  group.add(laserGroup);
}
document.getElementById('numLasers').addEventListener('input', updateLasersLive);

document.getElementById('btnStart').addEventListener('click', () => {
  if (!worker) initEvolution();
  evolving = true;
  worker.postMessage({ type: 'start' });
  document.getElementById('status').textContent = 'Evolucionando…';
});
document.getElementById('btnPause').addEventListener('click', () => {
  evolving = false;
  if (worker) worker.postMessage({ type: 'pause' });
  document.getElementById('status').textContent = 'En pausa';
});
document.getElementById('btnReset').addEventListener('click', () => {
  evolving = false;
  initEvolution();
  document.getElementById('status').textContent = 'Reiniciado — pulsa Iniciar';
  document.getElementById('genNum').textContent = '0';
  document.getElementById('bestFit').textContent = '—';
  document.getElementById('avgFit').textContent = '—';
});

// ----------------------------------------------------------------------------
// Bucle de render
// ----------------------------------------------------------------------------
function resize() {
  const r = canvas.getBoundingClientRect();
  renderer.setSize(r.width, r.height, false);
  composer.setSize(r.width, r.height);
  camera.aspect = r.width / r.height;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);

function animate() {
  requestAnimationFrame(animate);
  updateLive();
  controls.update();
  group.rotation.y += 0.0008;
  composer.render();
}

// arranque
initEvolution();
resize();
animate();
document.getElementById('status').textContent = 'Listo — pulsa Iniciar evolución';
