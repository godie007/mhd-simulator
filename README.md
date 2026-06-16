# Simulador de confinamiento de electrones con algoritmo genético

Esfera de **bobinas** que disparan campos magnéticos para **contener electrones**
lanzados por **cañones**, sin que toquen el borde. Un **algoritmo genético**
evoluciona, generación tras generación, los parámetros de cada bobina hasta
mantener las partículas moviéndose cerca del centro.

> 📐 **Documentación técnica completa** (ecuaciones físicas y requisitos para una
> implementación real): [`docs/DOCUMENTACION_TECNICA.md`](docs/DOCUMENTACION_TECNICA.md)

## Cómo ejecutar

El proyecto usa módulos ES y un Web Worker, así que necesita servirse por HTTP
(no abre bien con doble clic en `file://`). Desde esta carpeta:

```bash
python3 -m http.server 8000
```

Luego abre <http://localhost:8000> en el navegador (Chrome/Firefox/Safari).

> Requiere conexión a internet la primera vez: Three.js se carga desde CDN.

## Qué hace cada control

- **Distribución de bobinas**: `auto` usa vértices de sólidos platónicos cuando
  el número coincide (4 tetraedro, 6 octaedro, 8 cubo, 12 icosaedro, 20
  dodecaedro); `fibonacci` reparte cualquier N de forma casi-uniforme.
- **Nº de bobinas / cañones / electrones**: configurables y simétricos.
- **Potencia del cañón (kW)**: energía de inyección de los electrones. La rapidez
  inicial sale de `v₀ ∝ √P` (referencia: 2 kW → v₀ base).
- **Nº de láseres / potencia (W)**: láseres en los **huecos entre tríos de
  bobinas** que inyectan energía (calientan el plasma) a los electrones que
  cruzan su haz (referencia: 5 W cada uno; débil frente al cañón). El **AG decide
  qué láseres encender o apagar** para estabilizar y distribuir mejor la nube;
  en el HUD se ve cuántos están encendidos y en el 3D los apagados quedan tenues.
- **Población / mutación / pasos por episodio**: parámetros del AG.

### Sistema polifásico (desfase de 60°)

Las bobinas se activan **en pares opuestos** (antípodas) y todo el conjunto se
alimenta como un **sistema polifásico**: una **frecuencia común** y la fase de
cada par avanza **60°** (0°, 60°, 120°, 180°, 240°, 300°…), creando un campo
magnético rotatorio. El panel de la derecha muestra la frecuencia común y el
desfase de cada par en tiempo real.

Las **donas (toros) de las bobinas** se dibujan con un radio igual a la mitad de
la distancia a la bobina vecina, de modo que los campos cubren su espacio; el
suavizado del campo también escala con esa separación.

Pulsa **Iniciar evolución**. El panel 3D muestra en vivo el mejor controlador
encontrado hasta el momento; la gráfica muestra fitness medio, mejor de la
generación y mejor histórico. Cambia la configuración y pulsa **Reiniciar**
para aplicarla.

## Cómo funciona (física)

- Cada bobina es un **dipolo magnético** apuntando al centro, con corriente
  `I_i(t) = A_i·sin(2π f_i t + φ_i) + (kp·r̄ + kd·ṙ̄)`.
  - El término oscilante crea un **pseudopotencial de confinamiento** (idea de
    la trampa de iones RF): la **frecuencia modula la dirección** de los electrones.
  - El término PD (`kp`, `kd`) es la **auto-regulación**: aumenta el empuje hacia
    adentro cuando el radio medio de las partículas crece.
- Los electrones se integran con el **empuje de Boris**, el método estándar para
  partículas cargadas en campo magnético (`F = q·v×B`, conserva la rapidez).
- Los **láseres** se colocan en los puntos medios de las **30 aristas del
  dodecaedro** y, cuando un electrón cruza su haz, aumentan su rapidez (energía
  cinética) hasta un tope. Como el campo magnético solo curva pero no acelera,
  los láseres son la única fuente de energía del plasma — y hacen el
  confinamiento más difícil.
- Un electrón se considera **perdido** si alcanza el radio de la esfera.

## Pares opuestos

Cada bobina se empareja con la más cercana a su punto **antípoda**; ambas
comparten genes (misma amplitud y fase) y por tanto la misma corriente
instantánea.

## Algoritmo genético

- **Genoma** (`⌈N/2⌉ + 3 + nº_láseres` genes): frecuencia común del sistema
  polifásico + una amplitud por par + dos ganancias PD (`kp`, `kd`) + un gen
  on/off por láser (`>0.5` = encendido). La fase **no** se evoluciona: es el
  desfase polifásico fijo de 60° por par.
- **Fitness**: contención (electrones dentro y centrados) + **estabilidad** (poca
  fluctuación temporal del radio medio de la nube) + **distribución** (nube con
  grosor sano, ni colapsada ni difusa), penalizando las pérdidas. Esto empuja al
  AG a elegir qué láseres encender para una nube de plasma estable y bien repartida.
- **Operadores**: selección por torneo, cruce BLX-α, mutación gaussiana y
  elitismo (10%). Corre en un Web Worker para no congelar la interfaz.

## Estructura

```
index.html          UI + escena
css/style.css       estilos
js/physics.js       física pura (bobinas, campo, Boris, Simulation) — compartida
js/ga.js            algoritmo genético
js/sim-worker.js    Web Worker que evoluciona generaciones
js/main.js          Three.js, interfaz y simulación en vivo
```
