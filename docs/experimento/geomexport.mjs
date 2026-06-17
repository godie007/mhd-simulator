// Export real geometry + a steady-state cloud snapshot for figures.
import { Simulation } from './js/physics.js';
import { readFileSync, writeFileSync } from 'node:fs';
const summary = JSON.parse(readFileSync('/tmp/dodeca-exp/summary.json', 'utf8'));
const base = summary.config;
const best = Float64Array.from(summary.bestGenome);

const sim = new Simulation({ ...base, seed: 7 }, best);
// run to steady state
for (let s = 0; s < 12000; s++) sim.step(base.dt);
const radii = [];
for (let i = 0; i < sim.n; i++)
  radii.push(+Math.hypot(sim.pos[i*3], sim.pos[i*3+1], sim.pos[i*3+2]).toFixed(4));

const geom = {
  R: base.R,
  coils: sim.coils.map(c => c.map(x => +x.toFixed(4))),
  groupOf: Array.from(sim.groupOf),
  partner: Array.from(sim.partner),
  numGroups: sim.numGroups,
  lasers: sim.lasers.map(l => l.pos.map(x => +x.toFixed(4))),
  laserOn: Array.from(sim.laserOn),
  edges: sim.coilEdges.map(([a, b]) => [a.map(x => +x.toFixed(4)), b.map(x => +x.toFixed(4))]),
  radii,
  amplitudes: Array.from({ length: sim.numGroups }, (_, g) => +best[1 + g].toFixed(4)),
  f: +best[0].toFixed(4),
  kp: +best[sim.numGroups + 1].toFixed(4),
  kd: +best[sim.numGroups + 2].toFixed(4),
};
writeFileSync('/tmp/dodeca-exp/geom.json', JSON.stringify(geom));
console.error(`exported: ${geom.coils.length} coils, ${geom.numGroups} pairs, ${geom.lasers.length} lasers, ${radii.length} particles, f=${geom.f}, kp=${geom.kp}, kd=${geom.kd}`);
