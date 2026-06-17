// Injection sweep WITH space charge. Same evolved controller as the no-self-field
// run. If N_eq saturates (vs the linear K=0 baseline), the model now exhibits a
// Brillouin-type collective density limit. coulombK from env (calibrated).
import { Simulation } from './js/physics_sc.mjs';
import { readFileSync, writeFileSync } from 'node:fs';

const summary = JSON.parse(readFileSync('/tmp/dodeca-exp/summary.json', 'utf8'));
const base = summary.config;
const best = Float64Array.from(summary.bestGenome);
const K = parseFloat(process.env.K ?? '1e-3');
const SOFT = parseFloat(process.env.SOFT ?? '0.03');
const STEPS = parseInt(process.env.STEPS ?? '12000', 10);
const LAMBDAS = [10, 25, 50, 75, 100, 150, 200, 300];

const rows = [];
for (const lam of LAMBDAS) {
  const sim = new Simulation({ ...base, injectionRate: lam, maxParticles: 12000,
    coulombK: K, coulombSoft: SOFT, seed: 7 }, best);
  const ns = [];
  for (let s = 0; s < STEPS; s++) { sim.step(base.dt); if (s % 100 === 0) ns.push(sim.n); }
  const tail = ns.slice(Math.floor(ns.length * 0.7));
  const Neq = tail.reduce((a, b) => a + b, 0) / tail.length;
  rows.push({ lambda: lam, Neq: +Neq.toFixed(1), tau_s: +(Neq / lam).toFixed(2),
              linear: +(15.03 * lam).toFixed(0) });
  console.error(`λ=${lam}  N_eq=${Neq.toFixed(0)}  (lineal ${(15.03*lam).toFixed(0)})  τ=${(Neq/lam).toFixed(2)}s`);
}
const out = { coulombK: K, soft: SOFT, steps: STEPS, rows };
writeFileSync('/tmp/dodeca-exp/sweep_sc.json', JSON.stringify(out, null, 2));
console.error('saturación => N_eq se aparta de la recta lineal a λ alto');
