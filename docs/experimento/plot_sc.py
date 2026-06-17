#!/usr/bin/env python
"""Figura: sin carga espacial (lineal, sin techo) vs con carga espacial
(sublineal + colapso del tiempo de confinamiento = límite tipo Brillouin)."""
import json, os
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

EXP = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(EXP, "..", "figuras")
os.makedirs(OUT, exist_ok=True)
plt.rcParams.update({"figure.dpi": 150, "savefig.dpi": 150, "font.size": 11,
    "axes.grid": True, "grid.alpha": 0.25, "axes.spines.top": False,
    "axes.spines.right": False, "font.family": "DejaVu Sans"})

base = json.load(open(f"{EXP}/sweep.json"))      # K=0
sc = json.load(open(f"{EXP}/sweep_sc.json"))     # K>0
lam0 = np.array([r["lambda"] for r in base["rows"]]); n0 = np.array([r["Neq"] for r in base["rows"]])
lam1 = np.array([r["lambda"] for r in sc["rows"]]); n1 = np.array([r["Neq"] for r in sc["rows"]])
tau1 = np.array([r["tau_s"] for r in sc["rows"]]); slope = base["slope_tau_s"]

fig, (axL, axR) = plt.subplots(1, 2, figsize=(11, 4.4))

# --- izquierda: N_eq ---
xs = np.linspace(0, lam1.max() * 1.05, 50)
axL.plot(xs, slope * xs, color="#888", ls="--", lw=1.4,
         label=f"sin carga espacial: lineal sin techo ($\\tau={slope:.1f}$s)")
axL.scatter(lam0, n0, color="#888", s=28, zorder=3)
axL.plot(lam1, n1, color="#cc3344", lw=2.0, marker="o", zorder=4,
         label="con carga espacial ($K=10^{-3}$): sublineal, acotada")
sup = (slope * 300) / n1[-1]
axL.annotate(f"×{sup:.1f} de supresión\na $\\lambda=300$", xy=(300, n1[-1]),
             xytext=(195, 1900), color="#cc3344", fontsize=9,
             arrowprops=dict(arrowstyle="->", color="#cc3344"))
axL.set_xlabel("tasa de inyección  $\\lambda$ (part/s)")
axL.set_ylabel("población de equilibrio  $N_{eq}$")
axL.set_title("El autocampo acota la población")
axL.legend(frameon=False, loc="upper left", fontsize=9)
axL.set_ylim(0, slope * 300 * 1.05)

# --- derecha: colapso de tau ---
axR.plot(lam1, tau1, color="#1f6fb0", lw=2.0, marker="s", zorder=3)
axR.axhline(slope, color="#888", ls="--", lw=1.2, label=f"$\\tau$ sin carga (cte $\\approx{slope:.0f}$s)")
axR.set_xlabel("tasa de inyección  $\\lambda$ (part/s)")
axR.set_ylabel("tiempo de confinamiento efectivo  $\\tau$ (s)")
axR.set_title("La densidad acelera la pérdida: $\\tau$ colapsa")
axR.legend(frameon=False, loc="upper right", fontsize=9)
axR.set_ylim(0, slope * 1.15)
axR.annotate(f"{tau1[0]:.0f}s → {tau1[-1]:.0f}s", xy=(300, tau1[-1]),
             xytext=(150, 9), color="#1f6fb0", fontsize=9,
             arrowprops=dict(arrowstyle="->", color="#1f6fb0"))

fig.suptitle("Carga espacial (repulsión $e^-\\!-e^-$): de escalado lineal sin techo a límite de densidad tipo Brillouin",
             fontsize=11)
fig.tight_layout(rect=[0, 0, 1, 0.96])
fig.savefig(f"{OUT}/fig_carga_espacial.png"); plt.close(fig)
print("OK fig_carga_espacial.png")
print(f"supresión a λ=300: ×{sup:.1f} ; τ: {tau1[0]:.1f}s → {tau1[-1]:.1f}s")
