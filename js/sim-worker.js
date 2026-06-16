// sim-worker.js — Web Worker (módulo) que corre el algoritmo genético
// generación tras generación sin bloquear la interfaz. Envía estadísticas y
// el mejor genoma al hilo principal para mostrarlo en vivo.

import { GA } from './ga.js';

let ga = null;
let running = false;

function loop() {
  if (!running || !ga) return;
  const stats = ga.stepGeneration();
  postMessage({ type: 'gen', stats });
  // ceder el hilo para permitir pausar y no saturar la cola de mensajes
  setTimeout(loop, 0);
}

self.onmessage = (e) => {
  const msg = e.data;
  if (msg.type === 'init') {
    ga = new GA(msg.config);
    running = false;
    postMessage({ type: 'ready', geneLength: ga.best.length });
  } else if (msg.type === 'start') {
    if (!ga) return;
    if (!running) { running = true; loop(); }
  } else if (msg.type === 'pause') {
    running = false;
  } else if (msg.type === 'reset') {
    ga = new GA(msg.config);
    running = false;
    postMessage({ type: 'ready', geneLength: ga.best.length });
  }
};
