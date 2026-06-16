// ga.js — Algoritmo genético que evoluciona los parámetros de las bobinas
// para confinar los electrones dentro de la esfera el mayor tiempo posible.

import { evaluateGenome, randomGenome, makeBounds, makeRng, geneCount } from './physics.js';

export class GA {
  constructor(config) {
    this.cfg = config;
    this.rng = makeRng((config.gaSeed ?? 12345) >>> 0);
    const nl = config.numLasers | 0;
    this.bounds = makeBounds(config.numCoils, nl);
    this.pop = [];
    const N = config.populationSize;
    for (let i = 0; i < N; i++) this.pop.push(randomGenome(config.numCoils, nl, this.rng));
    this.fitness = new Float64Array(N).fill(-Infinity);
    this.generation = 0;
    this.best = this.pop[0].slice();
    this.bestFitness = -Infinity;
  }

  evaluate() {
    // Mismo seed de episodio para todos los genomas de esta generación (justo),
    // pero varía entre generaciones para evitar sobreajuste a un disparo concreto.
    const episodeSeed = (this.cfg.seed + this.generation * 7919) >>> 0;
    const cfg = { ...this.cfg, seed: episodeSeed };
    let bestIdx = 0;
    for (let i = 0; i < this.pop.length; i++) {
      this.fitness[i] = evaluateGenome(this.pop[i], cfg);
      if (this.fitness[i] > this.fitness[bestIdx]) bestIdx = i;
    }
    if (this.fitness[bestIdx] > this.bestFitness) {
      this.bestFitness = this.fitness[bestIdx];
      this.best = this.pop[bestIdx].slice();
    }
    let sum = 0;
    for (let i = 0; i < this.fitness.length; i++) sum += this.fitness[i];
    return {
      generation: this.generation,
      best: this.fitness[bestIdx],
      avg: sum / this.fitness.length,
      allTimeBest: this.bestFitness,
      bestGenome: this.pop[bestIdx].slice(),
    };
  }

  tournament(k = 3) {
    let bi = Math.floor(this.rng() * this.pop.length);
    for (let i = 1; i < k; i++) {
      const c = Math.floor(this.rng() * this.pop.length);
      if (this.fitness[c] > this.fitness[bi]) bi = c;
    }
    return this.pop[bi];
  }

  crossover(a, b) {
    // BLX-alpha mezclado por gen
    const child = new Float64Array(a.length);
    const alpha = 0.3;
    for (let i = 0; i < a.length; i++) {
      const lo = Math.min(a[i], b[i]);
      const hi = Math.max(a[i], b[i]);
      const d = hi - lo;
      child[i] = lo - alpha * d + this.rng() * (d + 2 * alpha * d);
    }
    return child;
  }

  mutate(g) {
    const { lo, hi } = this.bounds;
    const rate = this.cfg.mutationRate;
    const sigma = this.cfg.mutationSigma;
    for (let i = 0; i < g.length; i++) {
      if (this.rng() < rate) {
        // ruido gaussiano (Box-Muller) escalado al rango del gen
        const u1 = Math.max(1e-9, this.rng());
        const u2 = this.rng();
        const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
        g[i] += z * sigma * (hi[i] - lo[i]);
      }
      if (g[i] < lo[i]) g[i] = lo[i];
      if (g[i] > hi[i]) g[i] = hi[i];
    }
    return g;
  }

  reproduce() {
    const N = this.pop.length;
    const next = [];
    // elitismo
    const order = [...this.fitness.keys()].sort((a, b) => this.fitness[b] - this.fitness[a]);
    const elite = Math.max(1, Math.round(N * 0.1));
    for (let i = 0; i < elite; i++) next.push(this.pop[order[i]].slice());
    while (next.length < N) {
      const a = this.tournament();
      const b = this.tournament();
      next.push(this.mutate(this.crossover(a, b)));
    }
    this.pop = next;
    this.generation++;
  }

  // Una generación completa: evaluar -> stats -> reproducir.
  stepGeneration() {
    const stats = this.evaluate();
    this.reproduce();
    return stats;
  }
}

export { geneCount };
