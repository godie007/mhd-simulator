// Headless experiment harness — imports the REAL repo physics/GA unmodified.
// 1) Evolves the GA for N generations, logging convergence.
// 2) Takes the all-time-best genome and runs a long accumulation episode,
//    logging the live particle count n(t), escapes and cloud radius.
// Outputs JSON consumed by plot.py. No fabricated data.
import { GA } from './js/ga.js';
import { Simulation, geneCount, groupCount } from './js/physics.js';
import { writeFileSync } from 'node:fs';

const GENS = parseInt(process.env.GENS ?? '60', 10);
const LONG_STEPS = parseInt(process.env.LONG_STEPS ?? '20000', 10);

// Config replicating main.js readConfig() defaults (deterministic seeds).
const cfg = {
  numCoils: 12, maxParticles: 5000, numElectrons: 5000,
  injectionRate: 10,
  populationSize: 40, mutationRate: 0.15, mutationSigma: 0.18,
  episodeSteps: 500, coilPreset: 'auto', numLasers: 12,
  cannonPowerKW: 2, laserPowerW: 5, laserPower: 5 * 0.2, laserRadius: 0.12,
  R: 1.0, v0: 0.6 * Math.sqrt(2 / 2), dt: 0.02,
  eps: 0.18, kmag: 2.5, qm: 1.0,
  seed: 1, gaSeed: 12345,
};

console.error(`genes=${geneCount(cfg.numCoils, cfg.numLasers)} groups=${groupCount(cfg.numCoils)} (pairs) lasers=${cfg.numLasers}`);

const t0 = Date.now();
const ga = new GA(cfg);
const conv = [];
for (let g = 0; g < GENS; g++) {
  const s = ga.stepGeneration();
  conv.push({ gen: s.generation, avg: s.avg, best: s.best, allBest: s.allTimeBest });
  if (g % 10 === 0 || g === GENS - 1)
    console.error(`gen ${s.generation}  avg=${s.avg.toFixed(3)}  best=${s.best.toFixed(3)}  allBest=${s.allTimeBest.toFixed(3)}`);
}
console.error(`GA done in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

// Long accumulation run with the all-time-best genome.
const best = Float64Array.from(ga.best);
const sim = new Simulation({ ...cfg, seed: 7 }, best);
const series = [];
const lasersOn = sim.lasersOnCount();
for (let s = 0; s < LONG_STEPS; s++) {
  sim.step(cfg.dt);
  if (s % 50 === 0) {
    // confined = retained well inside (r < 0.9R), matches the live HUD metric
    let confined = 0, sumR = 0;
    for (let i = 0; i < sim.n; i++) {
      const r = Math.hypot(sim.pos[i*3], sim.pos[i*3+1], sim.pos[i*3+2]);
      sumR += r; if (r < 0.9 * cfg.R) confined++;
    }
    series.push({
      t: +(s * cfg.dt).toFixed(2), n: sim.n, confined,
      injected: sim.injected, lost: sim.lost,
      meanR: sim.n ? +(sumR / sim.n / cfg.R).toFixed(4) : 0,
    });
  }
}
const tail = series.slice(Math.floor(series.length * 0.7));
const meanN = tail.reduce((a, b) => a + b.n, 0) / tail.length;
const meanConf = tail.reduce((a, b) => a + b.confined, 0) / tail.length;
const maxN = Math.max(...series.map(s => s.n));
const escFrac = sim.injected ? sim.lost / sim.injected : 0;

const summary = {
  config: cfg, generations: GENS, longSteps: LONG_STEPS,
  geneCount: geneCount(cfg.numCoils, cfg.numLasers),
  groups: groupCount(cfg.numCoils), lasersTotal: cfg.numLasers, lasersOn,
  bestFitness: ga.bestFitness,
  steadyStateMeanN: +meanN.toFixed(1), steadyStateMeanConfined: +meanConf.toFixed(1),
  peakN: maxN, totalInjected: sim.injected, totalLost: sim.lost,
  escapeFraction: +escFrac.toFixed(4),
  meanConfinementTime_s: +(meanN / cfg.injectionRate).toFixed(2),
  bestGenome: Array.from(best).map(x => +x.toFixed(5)),
};
writeFileSync('/tmp/dodeca-exp/convergence.json', JSON.stringify(conv));
writeFileSync('/tmp/dodeca-exp/timeseries.json', JSON.stringify(series));
writeFileSync('/tmp/dodeca-exp/summary.json', JSON.stringify(summary, null, 2));
console.error('\n=== SUMMARY ===');
console.error(JSON.stringify(summary, null, 2));
