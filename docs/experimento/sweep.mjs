// Injection-rate sweep with a FIXED evolved controller.
// If confinement time tau is invariant and N_eq scales linearly with lambda,
// the model has no collective (space-charge) density limit: N_eq = lambda * tau.
import { Simulation } from './js/physics.js';
import { readFileSync, writeFileSync } from 'node:fs';

const summary = JSON.parse(readFileSync('/tmp/dodeca-exp/summary.json', 'utf8'));
const base = summary.config;
const best = Float64Array.from(summary.bestGenome);

const LAMBDAS = [10, 25, 50, 75, 100, 150, 200];
const STEPS = 30000;            // 600 s at dt=0.02 -> deep steady state
const rows = [];
for (const lam of LAMBDAS) {
  const sim = new Simulation({ ...base, injectionRate: lam, maxParticles: 50000, seed: 7 }, best);
  const ns = [];
  for (let s = 0; s < STEPS; s++) {
    sim.step(base.dt);
    if (s % 100 === 0) ns.push(sim.n);
  }
  const tail = ns.slice(Math.floor(ns.length * 0.7));
  const Neq = tail.reduce((a, b) => a + b, 0) / tail.length;
  const tau = Neq / lam;                       // N_eq = lambda * tau
  const escFrac = sim.injected ? sim.lost / sim.injected : 0;
  rows.push({ lambda: lam, Neq: +Neq.toFixed(1), tau_s: +tau.toFixed(2),
              injected: sim.injected, lost: sim.lost, escapeFraction: +escFrac.toFixed(4) });
  console.error(`lambda=${lam}  N_eq=${Neq.toFixed(1)}  tau=${tau.toFixed(2)}s  esc=${(escFrac*100).toFixed(1)}%`);
}
// linear fit N_eq = a*lambda (through origin) and R^2
const sx = rows.reduce((a, r) => a + r.lambda * r.lambda, 0);
const sxy = rows.reduce((a, r) => a + r.lambda * r.Neq, 0);
const slope = sxy / sx;
const ybar = rows.reduce((a, r) => a + r.Neq, 0) / rows.length;
const ssTot = rows.reduce((a, r) => a + (r.Neq - ybar) ** 2, 0);
const ssRes = rows.reduce((a, r) => a + (r.Neq - slope * r.lambda) ** 2, 0);
const r2 = 1 - ssRes / ssTot;
const out = { rows, slope_tau_s: +slope.toFixed(3), r2: +r2.toFixed(5), steps: STEPS };
writeFileSync('/tmp/dodeca-exp/sweep.json', JSON.stringify(out, null, 2));
console.error(`\nLinear fit N_eq = tau*lambda : tau=${slope.toFixed(3)}s  R^2=${r2.toFixed(5)}`);
