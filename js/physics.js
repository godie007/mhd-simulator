// physics.js
// Núcleo de simulación física: colocación de bobinas/cañones en la esfera,
// campo magnético de dipolos, empuje de Boris (Lorentz) y clase Simulation.
// Este módulo es PURO y compartido entre el hilo principal (render en vivo)
// y el Web Worker (evaluación del algoritmo genético), para que la física
// que evoluciona el AG sea exactamente la que ves en pantalla.

// ----------------------------------------------------------------------------
// RNG determinista (mulberry32). Mismo seed => misma secuencia, para que la
// comparación de genomas dentro de una generación sea justa.
// ----------------------------------------------------------------------------
export function makeRng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ----------------------------------------------------------------------------
// Distribución simétrica de N puntos sobre la esfera de radio R.
// Para conteos que coinciden con vértices de sólidos platónicos se usan esos
// vértices exactos (simetría perfecta). Para cualquier otro N se usa la
// espiral de Fibonacci (casi-uniforme), lo que permite personalizar libremente
// la cantidad de bobinas/cañones manteniendo buena simetría.
// ----------------------------------------------------------------------------
function platonic(n) {
  const phi = (1 + Math.sqrt(5)) / 2;
  let v = null;
  if (n === 4) {
    // tetraedro
    v = [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]];
  } else if (n === 6) {
    // octaedro
    v = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  } else if (n === 8) {
    // cubo
    v = [];
    for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) v.push([x, y, z]);
  } else if (n === 12) {
    // icosaedro
    v = [];
    for (const s1 of [-1, 1]) for (const s2 of [-1, 1]) {
      v.push([0, s1, s2 * phi]);
      v.push([s1, s2 * phi, 0]);
      v.push([s1 * phi, 0, s2]);
    }
  } else if (n === 20) {
    // dodecaedro: 8 vértices del cubo + 12 en los planos áureos
    v = [];
    for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) v.push([x, y, z]);
    const ip = 1 / phi;
    for (const a of [-ip, ip]) for (const b of [-phi, phi]) {
      v.push([0, a, b]);
      v.push([a, b, 0]);
      v.push([b, 0, a]);
    }
  }
  return v;
}

export function placeOnSphere(n, R = 1, preset = 'auto') {
  const out = [];
  let v = null;
  if (preset !== 'fibonacci') v = platonic(n);
  if (v && v.length === n) {
    for (const p of v) {
      const len = Math.hypot(p[0], p[1], p[2]);
      out.push([(p[0] / len) * R, (p[1] / len) * R, (p[2] / len) * R]);
    }
    return out;
  }
  // Espiral de Fibonacci
  const ga = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (i + 0.5) * (2 / n);
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const th = ga * i;
    out.push([Math.cos(th) * r * R, y * R, Math.sin(th) * r * R]);
  }
  return out;
}

// ----------------------------------------------------------------------------
// Emparejamiento de bobinas en PARES OPUESTOS (antípodas).
// Cada bobina se empareja con la bobina más cercana a su punto antípoda; ambas
// comparten los mismos genes, así que se activan SIEMPRE juntas y con la misma
// frecuencia. Si el número es impar, queda una bobina suelta como su propio
// grupo. Devuelve groupOf[coil] -> índice de grupo, y el número de grupos.
// ----------------------------------------------------------------------------
export function groupCount(numCoils) { return Math.ceil(numCoils / 2); }

export function computeGroups(coils) {
  const n = coils.length;
  const groupOf = new Int32Array(n).fill(-1);
  const partner = new Int32Array(n).fill(-1);
  let g = 0;
  for (let i = 0; i < n; i++) {
    if (groupOf[i] !== -1) continue;
    groupOf[i] = g;
    // antípoda de la bobina i
    const ax = -coils[i][0], ay = -coils[i][1], az = -coils[i][2];
    let best = -1, bestd = Infinity;
    for (let j = 0; j < n; j++) {
      if (groupOf[j] !== -1) continue;
      const dx = coils[j][0] - ax, dy = coils[j][1] - ay, dz = coils[j][2] - az;
      const d = dx * dx + dy * dy + dz * dz;
      if (d < bestd) { bestd = d; best = j; }
    }
    if (best !== -1) { groupOf[best] = g; partner[i] = best; partner[best] = i; }
    g++;
  }
  return { groupOf, partner, numGroups: g };
}

// ----------------------------------------------------------------------------
// Envolvente convexa 3D por enumeración (robusta para n pequeño). Un triángulo
// (i,j,k) es cara del hull si TODOS los demás puntos quedan al mismo lado de su
// plano. Para puntos sobre una esfera esto da la triangulación de la superficie:
// cada cara es un trío de bobinas vecinas y su centroide es el "hueco" entre
// ellas. O(n⁴), pero solo se calcula una vez por configuración (memoizado).
// ----------------------------------------------------------------------------
export function convexHullFaces(P) {
  const n = P.length;
  if (n < 4) return [];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const cross = (u, v) => [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  const dot = (u, v) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
  const eps = 1e-6;
  const faces = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      for (let k = j + 1; k < n; k++) {
        const nrm = cross(sub(P[j], P[i]), sub(P[k], P[i]));
        const nl = Math.hypot(nrm[0], nrm[1], nrm[2]);
        if (nl < eps) continue; // triple casi colineal
        nrm[0] /= nl; nrm[1] /= nl; nrm[2] /= nl;
        let pos = 0, neg = 0;
        for (let m = 0; m < n; m++) {
          if (m === i || m === j || m === k) continue;
          const s = dot(nrm, sub(P[m], P[i]));
          if (s > eps) pos++; else if (s < -eps) neg++;
          if (pos && neg) break;
        }
        if (pos && neg) continue;        // puntos a ambos lados => no es cara
        if (!pos && !neg) continue;      // todo coplanar => degenerado
        // orientar hacia afuera (los demás puntos quedan en el lado interior)
        faces.push(pos ? [i, k, j] : [i, j, k]);
      }
    }
  }
  return faces;
}

// ----------------------------------------------------------------------------
// Sistema POLIFÁSICO con desfase de 60° + control de láseres.
// Todas las bobinas comparten una frecuencia común; la fase de cada par avanza
// 60° (π/3), generando un campo magnético rotatorio. El genoma es:
//   [ f_común,  A_0 .. A_{ng-1} (amplitud por par),  kp, kd,  L_0 .. L_{nl-1} ]
// longitud = ng + 3 + nl. Cada gen L_k ∈ [0,1] enciende (>0.5) o apaga el láser
// k: el AG decide qué láseres encender para estabilizar/distribuir la nube.
// La fase NO se evoluciona: es determinista (g·60°).
// ----------------------------------------------------------------------------
export const PHASE_STEP = Math.PI / 3; // 60 grados
export const LASER_BASE = (numCoils) => groupCount(numCoils) + 3;
export function geneCount(numCoils, numLasers = 0) { return groupCount(numCoils) + 3 + numLasers; }

export const BOUNDS = {
  A: [0, 3],          // amplitud de corriente
  f: [0, 4],          // frecuencia (la frecuencia modula la dirección)
  phi: [0, Math.PI * 2],
  kp: [-8, 8],        // ganancia proporcional (deriva radial)
  kd: [-8, 8],        // ganancia derivativa (velocidad de deriva)
  L: [0, 1],          // estado del láser (>0.5 = encendido)
};

export function makeBounds(numCoils, numLasers = 0) {
  const ng = groupCount(numCoils);
  const lo = new Float64Array(geneCount(numCoils, numLasers));
  const hi = new Float64Array(geneCount(numCoils, numLasers));
  // gen 0: frecuencia común del sistema polifásico
  lo[0] = BOUNDS.f[0]; hi[0] = BOUNDS.f[1];
  // genes 1..ng: amplitud por par
  for (let g = 0; g < ng; g++) { lo[1 + g] = BOUNDS.A[0]; hi[1 + g] = BOUNDS.A[1]; }
  // ganancias PD
  lo[ng + 1] = BOUNDS.kp[0]; hi[ng + 1] = BOUNDS.kp[1];
  lo[ng + 2] = BOUNDS.kd[0]; hi[ng + 2] = BOUNDS.kd[1];
  // genes de láser (on/off)
  for (let k = 0; k < numLasers; k++) { lo[ng + 3 + k] = BOUNDS.L[0]; hi[ng + 3 + k] = BOUNDS.L[1]; }
  return { lo, hi };
}

export function randomGenome(numCoils, numLasers, rng) {
  const { lo, hi } = makeBounds(numCoils, numLasers);
  const g = new Float64Array(lo.length);
  for (let i = 0; i < g.length; i++) g[i] = lo[i] + rng() * (hi[i] - lo[i]);
  return g;
}

// ----------------------------------------------------------------------------
// Corriente instantánea de cada bobina. Las dos bobinas de un par comparten el
// mismo grupo de genes => se activan juntas con la misma frecuencia.
//   I(t) = A_g * sin(2π f_g t + φ_g) + (kp * rMedio + kd * dRMedio)
// El término oscilante crea un pseudopotencial de confinamiento (tipo trampa
// de Paul); el término PD es la regulación automática que empuja hacia adentro
// cuando las partículas se alejan del centro.
// ----------------------------------------------------------------------------
function fillCurrents(out, genome, groupOf, numGroups, t, meanR, meanRdot) {
  const f = genome[0];                 // frecuencia común
  const kp = genome[numGroups + 1];
  const kd = genome[numGroups + 2];
  const fb = kp * meanR + kd * meanRdot;
  const w = Math.PI * 2 * f * t;
  for (let i = 0; i < groupOf.length; i++) {
    const g = groupOf[i];
    const A = genome[1 + g];
    const phi = g * PHASE_STEP;         // desfase polifásico de 60° por par
    out[i] = A * Math.sin(w + phi) + fb;
  }
}

// ----------------------------------------------------------------------------
// Geometría dependiente solo de la configuración (no del genoma): posiciones de
// bobinas, cañones, pares, triangulación (huecos) y aristas. Se memoiza para
// calcular el hull una sola vez por configuración, no en cada evaluación del AG.
// ----------------------------------------------------------------------------
const geomCache = new Map();

export function getGeometry(numCoils, R, preset) {
  const key = `${numCoils}|${R}|${preset}`;
  const cached = geomCache.get(key);
  if (cached) return cached;

  const coils = placeOnSphere(numCoils, R, preset);
  const coilDir = coils.map((p) => {
    const len = Math.hypot(p[0], p[1], p[2]) || 1;
    return [-p[0] / len, -p[1] / len, -p[2] / len];
  });
  const cannons = coils.map((p) => [p[0], p[1], p[2]]); // un cañón por bobina
  const grp = computeGroups(coils);

  // distancia al vecino más cercano (tamaño del anillo y suavizado del campo)
  let dNN = Infinity;
  for (let i = 0; i < coils.length; i++)
    for (let j = i + 1; j < coils.length; j++) {
      const d = Math.hypot(coils[i][0] - coils[j][0], coils[i][1] - coils[j][1], coils[i][2] - coils[j][2]);
      if (d < dNN) dNN = d;
    }
  if (!isFinite(dNN)) dNN = R;

  // triangulación de la esfera de bobinas. Jitter mínimo determinista para
  // romper la simetría exacta de los sólidos platónicos (cuádruples coplanares);
  // los huecos se calculan con las posiciones originales (no se desplazan).
  const jr = makeRng(0x5eed);
  const jittered = coils.map((p) => [
    p[0] + (jr() - 0.5) * 1e-3, p[1] + (jr() - 0.5) * 1e-3, p[2] + (jr() - 0.5) * 1e-3,
  ]);
  const tris = convexHullFaces(jittered);

  const coilEdges = [];
  const seen = new Set();
  for (const [i, j, k] of tris)
    for (const [a, b] of [[i, j], [j, k], [k, i]]) {
      const ek = a < b ? a + ',' + b : b + ',' + a;
      if (!seen.has(ek)) { seen.add(ek); coilEdges.push([coils[a], coils[b]]); }
    }

  const coilGaps = tris.map(([i, j, k]) => [
    (coils[i][0] + coils[j][0] + coils[k][0]) / 3,
    (coils[i][1] + coils[j][1] + coils[k][1]) / 3,
    (coils[i][2] + coils[j][2] + coils[k][2]) / 3,
  ]);

  const geom = { coils, coilDir, cannons, grp, coilNN: dNN, coilEdges, coilGaps };
  geomCache.set(key, geom);
  return geom;
}

// ----------------------------------------------------------------------------
// Simulation: estado de partículas + integrador de Boris.
// ----------------------------------------------------------------------------
export class Simulation {
  constructor(config, genome) {
    this.cfg = config;
    this.setGenome(genome);
    const geom = getGeometry(config.numCoils, config.R, config.coilPreset);
    this.coils = geom.coils;
    this.coilDir = geom.coilDir;
    this.cannons = geom.cannons;
    this.currents = new Float64Array(config.numCoils);
    // pares opuestos (grupos de genes compartidos)
    this.groupOf = geom.grp.groupOf;
    this.partner = geom.grp.partner;
    this.numGroups = geom.grp.numGroups;
    this.coilNN = geom.coilNN;
    // el anillo del toro llega hasta la mitad del camino a la bobina vecina
    this.coilRingR = geom.coilNN * 0.5;
    // el campo se suaviza según la separación => los campos cubren su espacio
    this.eps = Math.max(config.eps, geom.coilNN * 0.28);
    // huecos entre tríos de bobinas y láseres situados en ellos
    this.coilEdges = geom.coilEdges;
    this.coilGaps = geom.coilGaps;
    const nl = Math.min(config.numLasers | 0, this.coilGaps.length);
    this.lasers = [];
    for (let k = 0; k < nl; k++) {
      const g = this.coilGaps[k];
      const dl = Math.hypot(g[0], g[1], g[2]) || 1;
      this.lasers.push({ pos: [g[0], g[1], g[2]], dir: [-g[0] / dl, -g[1] / dl, -g[2] / dl] });
    }
    this.laserBase = this.numGroups + 3;   // índice del primer gen de láser
    this.laserOn = new Uint8Array(nl);     // estado on/off (lo decide el AG)
    this.vmax = config.v0 * 2.6; // tope de rapidez al que pueden calentar
    this.reset(config.seed >>> 0);
  }

  setGenome(g) { this.genome = g; if (this.laserOn) this.updateLaserState(); }

  // Lee del genoma qué láseres están encendidos (gen > 0.5).
  updateLaserState() {
    for (let k = 0; k < this.lasers.length; k++)
      this.laserOn[k] = this.genome[this.laserBase + k] > 0.5 ? 1 : 0;
  }

  lasersOnCount() {
    let c = 0;
    for (let k = 0; k < this.laserOn.length; k++) c += this.laserOn[k];
    return c;
  }

  // Parámetros (frecuencia, amplitud, fase) por grupo/par para mostrar en UI.
  groupParams() {
    const out = [];
    const coilsOf = [];
    for (let g = 0; g < this.numGroups; g++) coilsOf.push([]);
    for (let i = 0; i < this.groupOf.length; i++) coilsOf[this.groupOf[i]].push(i);
    const f = this.genome[0]; // frecuencia común del sistema polifásico
    for (let g = 0; g < this.numGroups; g++) {
      out.push({
        A: this.genome[1 + g],
        f,
        phaseDeg: (g * 60) % 360, // desfase polifásico de 60°
        coils: coilsOf[g],
      });
    }
    return out;
  }

  // Límite de seguridad (no es un tope físico: la acumulación es "ilimitada",
  // solo evita que el navegador se quede sin memoria). Por defecto muy alto.
  get maxParticles() { return this.cfg.maxParticles ?? 100000; }

  reset(seed) {
    this.rng = makeRng(seed >>> 0);
    // La cámara ARRANCA VACÍA. El almacenamiento es DINÁMICO: crece según se
    // acumulan partículas (this.n = nº vivo, arrays compactos sin huecos).
    this.cap = 128;
    this.n = 0;
    this.pos = new Float64Array(this.cap * 3);
    this.vel = new Float64Array(this.cap * 3);
    this.injAccum = 0;                 // acumulador de inyección
    this.injected = 0;                 // total inyectado (estadística)
    this.t = 0;
    this.prevMeanR = 0;
    this.lost = 0;                     // total de escapes (acumulado)
    this.fitAccum = 0;
    this.steps = 0;
    // acumuladores para estabilidad/distribución
    this.accMR = 0;
    this.accMR2 = 0;
    this.accSpread = 0;
    this.statSteps = 0;
    this.updateLaserState();
  }

  aliveCount() { return this.n; }

  // Duplica la capacidad de los arrays cuando se llenan.
  grow() {
    const nc = Math.min(this.maxParticles, this.cap * 2);
    if (nc === this.cap) return false;
    const p = new Float64Array(nc * 3), v = new Float64Array(nc * 3);
    p.set(this.pos); v.set(this.vel);
    this.pos = p; this.vel = v; this.cap = nc;
    return true;
  }

  // Inyecta partículas nuevas según la tasa de inyección (disparo continuo de
  // los cañones). Acumulación sin tope salvo el límite de seguridad.
  inject(dt) {
    const rate = this.cfg.injectionRate ?? 8; // partículas por unidad de tiempo
    this.injAccum += rate * dt;
    while (this.injAccum >= 1) {
      if (!this.spawn()) { this.injAccum = 0; break; } // alcanzado el límite
      this.injected++;
      this.injAccum -= 1;
    }
  }

  // Genera una partícula nueva (la añade al final del array compacto) desde un
  // cañón, disparada hacia el centro. Devuelve false si se alcanzó el límite.
  spawn() {
    if (this.n >= this.cap && !this.grow()) return false;
    const cfg = this.cfg;
    const i = this.n;
    const c = this.cannons[(Math.floor(this.rng() * this.cannons.length)) % this.cannons.length];
    const r = cfg.R * 0.96;
    const inward = [-c[0], -c[1], -c[2]];
    const ilen = Math.hypot(inward[0], inward[1], inward[2]) || 1;
    inward[0] /= ilen; inward[1] /= ilen; inward[2] /= ilen;
    let tax = [0, 1, 0];
    if (Math.abs(inward[1]) > 0.9) tax = [1, 0, 0];
    const tx = [
      inward[1] * tax[2] - inward[2] * tax[1],
      inward[2] * tax[0] - inward[0] * tax[2],
      inward[0] * tax[1] - inward[1] * tax[0],
    ];
    const tlen = Math.hypot(tx[0], tx[1], tx[2]) || 1;
    tx[0] /= tlen; tx[1] /= tlen; tx[2] /= tlen;
    const spread = (this.rng() - 0.5) * 0.7;
    const ang = this.rng() * Math.PI * 2;
    const v0 = cfg.v0;
    const dir = [
      inward[0] + spread * (Math.cos(ang) * tx[0]),
      inward[1] + spread * (Math.cos(ang) * tx[1]),
      inward[2] + spread * (Math.cos(ang) * tx[2]),
    ];
    const dl = Math.hypot(dir[0], dir[1], dir[2]) || 1;
    this.pos[i * 3] = c[0] * (r / cfg.R);
    this.pos[i * 3 + 1] = c[1] * (r / cfg.R);
    this.pos[i * 3 + 2] = c[2] * (r / cfg.R);
    this.vel[i * 3] = (dir[0] / dl) * v0;
    this.vel[i * 3 + 1] = (dir[1] / dl) * v0;
    this.vel[i * 3 + 2] = (dir[2] / dl) * v0;
    this.n++;
    return true;
  }

  computeMeanR() {
    let s = 0;
    for (let i = 0; i < this.n; i++)
      s += Math.hypot(this.pos[i * 3], this.pos[i * 3 + 1], this.pos[i * 3 + 2]);
    return this.n ? s / this.n : 0;
  }

  // Campo B en un punto, suma de dipolos de todas las bobinas.
  fieldAt(px, py, pz, out) {
    const cfg = this.cfg;
    const eps2 = this.eps * this.eps;
    const k = cfg.kmag;
    let bx = 0, by = 0, bz = 0;
    const coils = this.coils, dirs = this.coilDir, I = this.currents;
    for (let i = 0; i < coils.length; i++) {
      const cp = coils[i];
      const dx = px - cp[0], dy = py - cp[1], dz = pz - cp[2];
      const d2 = dx * dx + dy * dy + dz * dz + eps2;
      const d = Math.sqrt(d2);
      const inv3 = 1 / (d2 * d);
      const ndx = dx / d, ndy = dy / d, ndz = dz / d;
      const m = dirs[i];
      const mdotd = m[0] * ndx + m[1] * ndy + m[2] * ndz;
      const cur = k * I[i] * inv3;
      bx += cur * (3 * mdotd * ndx - m[0]);
      by += cur * (3 * mdotd * ndy - m[1]);
      bz += cur * (3 * mdotd * ndz - m[2]);
    }
    out[0] = bx; out[1] = by; out[2] = bz;
  }

  // Un paso de integración: mueve las partículas, elimina las que escapan e
  // inyecta nuevas desde los cañones (acumulación de plasma).
  step(dt) {
    const cfg = this.cfg;
    const meanR = this.computeMeanR();
    const meanRdot = (meanR - this.prevMeanR) / dt;
    this.prevMeanR = meanR;
    fillCurrents(this.currents, this.genome, this.groupOf, this.numGroups, this.t, meanR, meanRdot);

    const B = [0, 0, 0];
    const qm = cfg.qm;
    let centrality = 0, sumR = 0, sumR2 = 0;

    // recorrido compacto con swap-remove: las que escapan se eliminan moviendo
    // la última a su lugar (sin huecos), y se reprocesa esa posición.
    let i = 0;
    while (i < this.n) {
      const ix = i * 3;
      const px = this.pos[ix], py = this.pos[ix + 1], pz = this.pos[ix + 2];
      this.fieldAt(px, py, pz, B);
      // Empuje de Boris (solo B => rotación pura, conserva |v|)
      let vx = this.vel[ix], vy = this.vel[ix + 1], vz = this.vel[ix + 2];
      const tx = qm * B[0] * 0.5 * dt;
      const ty = qm * B[1] * 0.5 * dt;
      const tz = qm * B[2] * 0.5 * dt;
      const t2 = tx * tx + ty * ty + tz * tz;
      const sx = 2 * tx / (1 + t2), sy = 2 * ty / (1 + t2), sz = 2 * tz / (1 + t2);
      // v' = v + v x t
      const vpx = vx + (vy * tz - vz * ty);
      const vpy = vy + (vz * tx - vx * tz);
      const vpz = vz + (vx * ty - vy * tx);
      // v+ = v + v' x s
      vx = vx + (vpy * sz - vpz * sy);
      vy = vy + (vpz * sx - vpx * sz);
      vz = vz + (vpx * sy - vpy * sx);
      // Láseres ENCENDIDOS (el AG decide cuáles): calientan a la partícula que
      // cruza su haz, redistribuyendo energía para estabilizar la nube.
      if (this.lasers.length && cfg.laserPower > 0) {
        const lr2 = cfg.laserRadius * cfg.laserRadius;
        let boost = 0;
        for (let l = 0; l < this.lasers.length; l++) {
          if (!this.laserOn[l]) continue; // láser apagado
          const o = this.lasers[l].pos, d = this.lasers[l].dir;
          const wx = px - o[0], wy = py - o[1], wz = pz - o[2];
          const proj = wx * d[0] + wy * d[1] + wz * d[2];
          if (proj <= 0) continue; // detrás del láser
          const perp2 = (wx * wx + wy * wy + wz * wz) - proj * proj;
          if (perp2 < lr2) boost += cfg.laserPower * dt;
        }
        if (boost > 0) {
          const sp = Math.hypot(vx, vy, vz) || 1e-9;
          let nsp = sp + boost;
          if (nsp > this.vmax) nsp = this.vmax; // tope de calentamiento
          const sc = nsp / sp;
          vx *= sc; vy *= sc; vz *= sc;
        }
      }
      // posición
      const nx = px + vx * dt, ny = py + vy * dt, nz = pz + vz * dt;

      const r = Math.hypot(nx, ny, nz);
      if (r >= cfg.R) {
        // escapó: se elimina PARA SIEMPRE (swap con la última, sin reciclar)
        const last = this.n - 1;
        if (i !== last) {
          this.pos[ix] = this.pos[last * 3]; this.pos[ix + 1] = this.pos[last * 3 + 1]; this.pos[ix + 2] = this.pos[last * 3 + 2];
          this.vel[ix] = this.vel[last * 3]; this.vel[ix + 1] = this.vel[last * 3 + 1]; this.vel[ix + 2] = this.vel[last * 3 + 2];
        }
        this.n--; this.lost++;
        // no incrementar i: reprocesar la partícula que se movió aquí
      } else {
        this.vel[ix] = vx; this.vel[ix + 1] = vy; this.vel[ix + 2] = vz;
        this.pos[ix] = nx; this.pos[ix + 1] = ny; this.pos[ix + 2] = nz;
        centrality += 1 - (r / cfg.R) * (r / cfg.R);
        sumR += r; sumR2 += r * r;
        i++;
      }
    }

    // inyección continua de partículas nuevas (acumulación de plasma)
    this.inject(dt);

    // acumulación de fitness por paso: fracción de las partículas INYECTADAS que
    // se logra mantener confinada (premia acumular y retener; sin tope fijo).
    const aliveCount = this.n;
    const frac = this.injected > 0 ? aliveCount / this.injected : 0;
    const cent = aliveCount ? centrality / aliveCount : 0;
    this.fitAccum += frac * (0.5 + 0.5 * cent);
    // métricas de estabilidad/distribución (solo con nube viva)
    if (aliveCount > 0) {
      const mr = sumR / aliveCount;                       // radio medio
      const spread = Math.sqrt(Math.max(0, sumR2 / aliveCount - mr * mr)); // grosor radial
      this.accMR += mr; this.accMR2 += mr * mr;
      this.accSpread += spread; this.statSteps++;
    }
    this.steps++;
    this.t += dt;
  }

  fitness() {
    // ACUMULACIÓN/RETENCIÓN: fracción media de la capacidad confinada y centrada.
    const retention = this.steps ? this.fitAccum / this.steps : 0;
    // ESTABILIDAD y DISTRIBUCIÓN de la nube acumulada
    let stability = 0, distribution = 0;
    if (this.statSteps > 0) {
      const mrAvg = this.accMR / this.statSteps;
      const varT = Math.max(0, this.accMR2 / this.statSteps - mrAvg * mrAvg);
      stability = Math.exp(-6 * Math.sqrt(varT));         // 1 = perfectamente estable
      const spreadAvg = this.accSpread / this.statSteps;
      const target = 0.25 * this.cfg.R;
      distribution = Math.exp(-Math.pow((spreadAvg - target) / (0.22 * this.cfg.R), 2));
      const aliveFrac = this.statSteps / Math.max(1, this.steps);
      stability *= aliveFrac; distribution *= aliveFrac;
    }
    // La retención ya penaliza implícitamente los escapes (reducen el conteo).
    return retention + 0.3 * stability + 0.15 * distribution;
  }
}

// Evalúa un genoma corriendo un episodio completo (cámara vacía -> acumulación).
export function evaluateGenome(genome, config) {
  const sim = new Simulation(config, genome);
  for (let s = 0; s < config.episodeSteps; s++) sim.step(config.dt);
  return sim.fitness();
}
