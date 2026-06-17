# Experimento reproducible (Cap. 6′ de la tesis)

Artefactos de la corrida que sostiene el Capítulo 6′ de `TESIS_DOCTORAL.md`. Todo se
generó ejecutando la física del repositorio (`js/physics.js`, `js/ga.js`) **sin
modificarla**, con semillas deterministas (`gaSeed=12345`, `seed=7`).

## Scripts del harness

| Archivo | Rol |
|---|---|
| `runner.mjs` | Evoluciona el AG 150 generaciones y corre la acumulación larga con el mejor genoma. |
| `sweep.mjs` | Barrido de la tasa de inyección λ con el genoma fijo (hallazgo central §6′.7). |
| `geomexport.mjs` | Exporta geometría real e instantánea radial de la nube. |
| `plot.py` | Genera las 6 figuras en `../figuras/` desde los `.json`. |

## Datos (salida verificable)

`convergence.json`, `timeseries.json`, `summary.json`, `sweep.json`, `geom.json`.

## Cómo reproducir

Los `.mjs` esperan el directorio de trabajo aislado descrito en el **Apéndice D** de
la tesis (copia de `js/` + `package.json` con `{"type":"module"}` en `/tmp/dodeca-exp`),
porque importan `./js/...` y requieren modo ES module:

```bash
mkdir -p /tmp/dodeca-exp/js
cp js/physics.js js/ga.js /tmp/dodeca-exp/js/
printf '{"type":"module"}' > /tmp/dodeca-exp/package.json
cp docs/experimento/*.mjs /tmp/dodeca-exp/
cd /tmp/dodeca-exp
GENS=150 LONG_STEPS=30000 node runner.mjs
node sweep.mjs && node geomexport.mjs
cp *.json /ruta/al/repo/docs/experimento/
```

`plot.py`, en cambio, usa rutas relativas y se ejecuta **en su sitio**:

```bash
python3 -m venv /tmp/venv && /tmp/venv/bin/pip install matplotlib numpy
/tmp/venv/bin/python docs/experimento/plot.py   # escribe en docs/figuras/
```

## Hallazgo central (modelo base, sin carga espacial)

`N_eq = τ·λ`, con τ ≈ 15 s **invariante** y `R² = 0.99996` en todo el rango
λ∈[10,200]: la población escala lineal y **sin saturar**. El modelo es de partícula
independiente, por lo que el conteo absoluto está *limitado por inyección*, no por
densidad. Ver `../figuras/fig_escalado_lambda.png` y §6′.7–6′.8 de la tesis.

## Extensión con carga espacial (§6′.9)

`physics_sc.mjs` añade la repulsión coulombiana `e⁻–e⁻` (autocampo) al empuje de
Boris. Con el **mismo** controlador, el escalado lineal sin techo se convierte en
**sublineal y acotado**: a λ=300, N_eq=868 frente a 4509 lineal (**×5.2** de
supresión) y el tiempo de confinamiento efectivo **colapsa de 15.5 s a 2.9 s**. Es la
fenomenología del **límite de Brillouin**: la densidad acelera la auto-expulsión. Ver
`../figuras/fig_carga_espacial.png`. Caveats: K calibrado (no SI), modelo PP con
suavizado (no PIC), controlador no re-optimizado bajo autocampo.
