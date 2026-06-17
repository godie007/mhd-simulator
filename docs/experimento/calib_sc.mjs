import { Simulation } from './js/physics_sc.mjs';
import { readFileSync } from 'node:fs';
const summary = JSON.parse(readFileSync('/tmp/dodeca-exp/summary.json', 'utf8'));
const base = summary.config;
const best = Float64Array.from(summary.bestGenome);

function run(lam, K, steps = 5000) {
  const sim = new Simulation({ ...base, injectionRate: lam, maxParticles: 8000,
    coulombK: K, coulombSoft: 0.03, seed: 7 }, best);
  const ns = [];
  for (let s = 0; s < steps; s++) { sim.step(base.dt); if (s % 100 === 0) ns.push(sim.n); }
  const tail = ns.slice(Math.floor(ns.length * 0.6));
  return tail.reduce((a, b) => a + b, 0) / tail.length;
}

const t0 = Date.now();
console.error('K=0 (control) λ=50 ->', run(50, 0).toFixed(0), '(esperado ~751 lineal)');
console.error('--- escaneo de K a λ=100 (lineal sin carga ~1500) ---');
for (const K of [1e-5, 3e-5, 1e-4, 3e-4, 1e-3, 3e-3, 1e-2]) {
  console.error(`K=${K.toExponential(0)}  N_eq=${run(100, K).toFixed(0)}`);
}
console.error(`(${((Date.now() - t0) / 1000).toFixed(0)}s)`);
