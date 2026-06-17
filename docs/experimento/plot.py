#!/usr/bin/env python
"""Genera las figuras de la tesis a partir de los datos REALES del experimento."""
import json, os
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d import Axes3D  # noqa

# Rutas relativas a la ubicación de este script (docs/experimento/).
# Lee los .json co-localizados y escribe las figuras en docs/figuras/.
EXP = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(EXP, "..", "figuras")
os.makedirs(OUT, exist_ok=True)

plt.rcParams.update({
    "figure.dpi": 150, "savefig.dpi": 150, "font.size": 11,
    "axes.grid": True, "grid.alpha": 0.25, "axes.spines.top": False,
    "axes.spines.right": False, "font.family": "DejaVu Sans",
})
ACCENT, BEST, AVG, ALLB = "#2a6cff", "#0aa", "#5577aa", "#1f9e3a"

def load(name): return json.load(open(f"{EXP}/{name}"))

# ---------------------------------------------------------------- convergencia
conv = load("convergence.json")
g = [c["gen"] for c in conv]
fig, ax = plt.subplots(figsize=(7, 4))
ax.plot(g, [c["avg"] for c in conv], color=AVG, lw=1.2, label="media población")
ax.plot(g, [c["best"] for c in conv], color=BEST, lw=1.3, label="mejor de la generación")
ax.plot(g, [c["allBest"] for c in conv], color=ALLB, lw=2.0, label="mejor histórico")
ax.set_xlabel("Generación"); ax.set_ylabel("Aptitud  $\\mathcal{F}(\\theta)$")
ax.set_title("Convergencia del algoritmo genético (150 generaciones, $\\lambda=10$)")
ax.legend(frameon=False, loc="lower right")
fig.tight_layout(); fig.savefig(f"{OUT}/fig_convergencia.png"); plt.close(fig)

# ---------------------------------------------------------------- acumulación
ts = load("timeseries.json")
t = np.array([r["t"] for r in ts]); n = np.array([r["n"] for r in ts])
mr = np.array([r["meanR"] for r in ts])
summ = load("summary.json"); Neq = summ["steadyStateMeanN"]; tau = summ["meanConfinementTime_s"]
fig, ax = plt.subplots(figsize=(7, 4))
ax.plot(t, n, color=ACCENT, lw=1.0, label="$N(t)$ confinadas")
ax.axhline(Neq, color=ALLB, ls="--", lw=1.3, label=f"$N_{{eq}}\\approx{Neq:.0f}$")
# modelo de llenado N(t)=lambda*tau*(1-e^{-t/tau})
nmodel = 10 * tau * (1 - np.exp(-t / tau))
ax.plot(t, nmodel, color="#cc4444", ls=":", lw=1.6, label=f"$\\lambda\\tau(1-e^{{-t/\\tau}})$, $\\tau={tau:.1f}$s")
ax.set_xlabel("tiempo  $t$ (s)"); ax.set_ylabel("electrones confinados  $N$")
ax.set_title("Régimen acumulativo: cámara vacía → equilibrio dinámico")
ax.legend(frameon=False, loc="lower right")
fig.tight_layout(); fig.savefig(f"{OUT}/fig_acumulacion.png"); plt.close(fig)

# ---------------------------------------------------------- escalado lambda ★
sw = load("sweep.json"); rows = sw["rows"]
lam = np.array([r["lambda"] for r in rows]); Ne = np.array([r["Neq"] for r in rows])
taus = np.array([r["tau_s"] for r in rows]); slope = sw["slope_tau_s"]; r2 = sw["r2"]
fig, ax1 = plt.subplots(figsize=(7.2, 4.4))
ax1.scatter(lam, Ne, color=ACCENT, zorder=3, s=45, label="$N_{eq}$ medido")
xs = np.linspace(0, lam.max() * 1.05, 50)
ax1.plot(xs, slope * xs, color="#cc4444", lw=1.6,
         label=f"ajuste $N_{{eq}}=\\tau\\lambda$  ($\\tau={slope:.2f}$s, $R^2={r2:.5f}$)")
ax1.axhline(700, color="#888", ls=":", lw=1.0)
ax1.text(5, 720, "objetivo 700", color="#666", fontsize=9)
ax1.set_xlabel("tasa de inyección  $\\lambda$ (part/s)")
ax1.set_ylabel("población de equilibrio  $N_{eq}$", color=ACCENT)
ax1.set_title("Sin límite de densidad: $N_{eq}$ escala lineal y sin saturar con $\\lambda$")
ax1.legend(frameon=False, loc="upper left")
ax2 = ax1.twinx(); ax2.grid(False)
ax2.scatter(lam, taus, color=ALLB, marker="s", s=30, zorder=3)
ax2.set_ylabel("tiempo de confinamiento  $\\tau$ (s)", color=ALLB)
ax2.set_ylim(0, 30)
ax2.text(120, taus.mean() + 1.5, f"$\\tau$ constante $\\approx{taus.mean():.1f}$s",
         color=ALLB, fontsize=9)
fig.tight_layout(); fig.savefig(f"{OUT}/fig_escalado_lambda.png"); plt.close(fig)

# ---------------------------------------------------------------- geometría 3D
gm = load("geom.json")
coils = np.array(gm["coils"]); groupOf = np.array(gm["groupOf"])
lasers = np.array(gm["lasers"]); edges = gm["edges"]; R = gm["R"]
fig = plt.figure(figsize=(6.6, 6.2)); ax = fig.add_subplot(111, projection="3d")
u, v = np.mgrid[0:2*np.pi:40j, 0:np.pi:20j]
ax.plot_surface(R*np.cos(u)*np.sin(v), R*np.sin(u)*np.sin(v), R*np.cos(v),
                color=ACCENT, alpha=0.05, linewidth=0)
for a, b in edges:
    ax.plot([a[0], b[0]], [a[1], b[1]], [a[2], b[2]], color="#aab", lw=0.6, alpha=0.5)
cmap = plt.cm.tab10
for i, c in enumerate(coils):
    ax.scatter(*c, color=cmap(groupOf[i] % 10), s=90, depthshade=True)
    ax.text(c[0]*1.12, c[1]*1.12, c[2]*1.12, str(i+1), fontsize=8, color="#333")
ax.scatter(lasers[:, 0], lasers[:, 1], lasers[:, 2], color="#ff3355",
           marker="^", s=40, label="láseres (huecos)")
ax.scatter([0], [0], [0], color="k", s=20)
ax.set_title("12 bobinas (icosaedro) · 6 pares antípodas (color) · 12 láseres", fontsize=10)
ax.legend(frameon=False, loc="upper left"); ax.set_box_aspect((1, 1, 1))
ax.set_xticks([]); ax.set_yticks([]); ax.set_zticks([])
fig.tight_layout(); fig.savefig(f"{OUT}/fig_geometria.png"); plt.close(fig)

# ---------------------------------------------------------------- genoma
amp = gm["amplitudes"]
fig, ax = plt.subplots(figsize=(7, 4))
xs = np.arange(len(amp))
ax.bar(xs, amp, color=ACCENT, alpha=0.85)
ax.set_xticks(xs); ax.set_xticklabels([f"P{i+1}" for i in xs])
ax.set_ylabel("amplitud de corriente  $A_g$")
ax.set_xlabel("par antípoda de bobinas")
on = sum(gm["laserOn"])
ax.set_title(f"Controlador evolucionado: $f={gm['f']:.2f}$, $k_p={gm['kp']:.2f}$, "
             f"$k_d={gm['kd']:.2f}$, láseres ON={on}/{len(gm['laserOn'])}")
fig.tight_layout(); fig.savefig(f"{OUT}/fig_genoma.png"); plt.close(fig)

# ---------------------------------------------------------------- distrib radial
radii = np.array(gm["radii"])
fig, ax = plt.subplots(figsize=(7, 4))
ax.hist(radii / R, bins=30, color=ACCENT, alpha=0.8, edgecolor="white")
ax.axvline(radii.mean()/R, color="#cc4444", lw=1.5, label=f"$\\bar r/R={radii.mean()/R:.2f}$")
ax.axvline(1.0, color="#888", ls=":", label="borde (escape)")
ax.set_xlabel("radio normalizado  $r/R$"); ax.set_ylabel("nº de electrones")
ax.set_title(f"Distribución radial de la nube en equilibrio ({len(radii)} electrones)")
ax.legend(frameon=False)
fig.tight_layout(); fig.savefig(f"{OUT}/fig_distribucion_radial.png"); plt.close(fig)

print("Figuras generadas en", OUT)
for f in sorted(os.listdir(OUT)):
    print("  -", f)
