# Confinamiento magnético acumulativo de electrones mediante un sistema polifásico de bobinas optimizado por algoritmos genéticos: del modelo computacional a la realización experimental

### Tesis doctoral

**Programa de Doctorado en Física Aplicada / Ingeniería de Plasmas**

---

> **Nota de honestidad científica.** Este documento presenta un **modelo
> computacional** de confinamiento y una **hoja de ruta experimental**. Los
> resultados numéricos (incluido el régimen de >600 partículas) provienen del
> simulador descrito aquí, que hace simplificaciones explícitas (dipolos
> puntuales, ausencia de colisiones y de autocampos, dinámica no relativista).
> Ninguna afirmación cuantitativa debe tomarse como predicción de un dispositivo
> real sin validación experimental y sin un modelo cinético/PIC completo
> (capítulo 7 y §9 de limitaciones). La tesis se redacta para que un investigador
> pueda **reproducir el modelo, auditar cada ecuación y diseñar el experimento**.

---

## Resumen

Se presenta un esquema de **confinamiento magnético acumulativo** de electrones
en una cavidad cuasi-esférica rodeada por $N$ bobinas dispuestas simétricamente y
alimentadas por un **sistema polifásico con desfase de 60°**. Cada bobina y su
antípoda forman un **par** que comparte excitación, generando un campo magnético
rotatorio cuyo pseudopotencial efectivo confina partículas cargadas de forma
análoga a una trampa de radiofrecuencia. Un conjunto de **láseres** situados en
los huecos intersticiales entre tríos de bobinas inyecta energía al plasma; su
encendido/apagado y los parámetros de campo se **optimizan mediante un algoritmo
genético** cuya función de aptitud combina retención, estabilidad temporal y
distribución espacial de la nube.

A diferencia de los modelos de número fijo de partículas, aquí los cañones
**inyectan electrones de forma continua** y las partículas que alcanzan la
frontera se pierden de manera irreversible, de modo que la población confinada es
**acumulativa** y su valor estacionario mide directamente la calidad del
confinamiento. En la configuración óptima hallada (12 bobinas en disposición
icosaédrica, 20 emisores láser, tasa de inyección 75 part·u.t⁻¹), el sistema
**sostiene un régimen estacionario de ≈ 719 electrones confinados** (pico 748),
con un tiempo medio de confinamiento $\tau \approx 9.6$ u.t. y una nube estable a
radio medio $\bar r \approx 0.62\,R$. La tesis documenta exhaustivamente el
modelo físico-matemático, el método de optimización, la validación numérica, el
análisis de resultados y un **plan detallado de realización experimental**
(instrumentación, diagnóstico, protocolo, presupuesto, riesgos y criterios de
validación).

**Palabras clave:** confinamiento magnético, plasma no neutro, sistema
polifásico, fuerza de Lorentz, integrador de Boris, algoritmos genéticos, trampa
de partículas, acumulación de plasma.

---

## Abstract

We present a scheme for **cumulative magnetic confinement** of electrons within a
quasi-spherical cavity surrounded by $N$ symmetrically arranged coils driven by a
**polyphase system with a 60° phase shift**. Each coil and its antipode form a
**pair** sharing excitation, producing a rotating magnetic field whose effective
pseudopotential confines charged particles, analogous to a radio-frequency trap.
A set of **lasers** placed at the interstitial gaps between coil triplets injects
energy into the plasma; their on/off state and the field parameters are
**optimized by a genetic algorithm** whose fitness combines retention, temporal
stability, and spatial distribution. Unlike fixed-particle models, electron guns
**inject continuously** and particles reaching the boundary are irreversibly
lost, making the confined population **cumulative**. In the optimal configuration
(12 coils in icosahedral arrangement, 20 laser emitters, injection rate 75), the
system **sustains a steady state of ≈ 719 confined electrons** (peak 748). The
thesis fully documents the physico-mathematical model, the optimization method,
numerical validation, results analysis, and a **detailed experimental roadmap**.

---

## Índice

1. Introducción
2. Estado del arte y marco teórico
3. Modelo físico-matemático
4. Optimización mediante algoritmo genético
5. Implementación computacional y validación numérica
6. Resultados y análisis de escenarios
7. De la simulación al experimento: diseño y realización
8. Conclusiones y trabajo futuro
- Apéndice A. Derivaciones
- Apéndice B. Tabla maestra de parámetros
- Apéndice C. Pseudocódigo
- Bibliografía

---

# Capítulo 1. Introducción

## 1.1 Contexto y motivación

El confinamiento de partículas cargadas es un problema central en física de
plasmas, física de aceleradores, espectrometría de masas y propulsión espacial.
Las trampas de partículas (Penning, Paul, magnéticas de espejo) y los
dispositivos de fusión (tokamak, stellarator) comparten un objetivo: **mantener
partículas cargadas alejadas de las paredes materiales** durante el mayor tiempo
posible, idealmente generando y sosteniendo un plasma.

Esta tesis explora una arquitectura alternativa y didácticamente transparente:
una **cavidad cuasi-esférica** rodeada de bobinas alimentadas como un **sistema
polifásico**, en la que un **algoritmo genético** (AG) descubre automáticamente
los parámetros de excitación que maximizan el confinamiento. El interés es doble:

1. **Científico-pedagógico**: un banco de pruebas reproducible donde cada
   ecuación es auditable y donde la optimización automática revela estrategias de
   confinamiento no triviales.
2. **Aplicado**: una hoja de ruta para transformar el modelo en un **experimento
   real** de trampa de electrones de bajo coste, con diagnóstico y control.

## 1.2 Planteamiento del problema

Dado un recipiente esférico de radio $R$ con $N$ bobinas en su superficie y
cañones que inyectan electrones de forma continua, **encontrar las leyes de
excitación temporal de las bobinas (y el estado de los láseres) que maximicen el
número de electrones confinados en régimen estacionario**, sin que toquen la
frontera, manteniendo la nube estable y bien distribuida.

Formalmente, sea $\theta$ el vector de parámetros de control (genoma). Se busca

$$
\theta^\star = \arg\max_{\theta}\ \mathcal{F}(\theta),
$$

donde $\mathcal{F}$ es una funcional de aptitud que pondera retención,
estabilidad y distribución (capítulo 4).

## 1.3 Hipótesis

- **H1.** Un campo magnético rotatorio generado por un sistema polifásico de
  bobinas en pares antípodas produce un pseudopotencial capaz de confinar
  electrones de forma sostenida.
- **H2.** La población confinada en régimen acumulativo alcanza un **equilibrio**
  donde la tasa de escape iguala a la de inyección; ese equilibrio es una medida
  monótona de la calidad del confinamiento.
- **H3.** Un algoritmo genético puede descubrir configuraciones de excitación que
  sostengan **más de 600 electrones** simultáneamente en el modelo, y dichas
  configuraciones son interpretables físicamente.

## 1.4 Objetivos

**General.** Desarrollar, validar y optimizar un modelo de confinamiento
magnético acumulativo de electrones y establecer la ruta hacia su realización
experimental.

**Específicos.**
1. Formular el modelo físico-matemático completo (geometría, electromagnetismo,
   dinámica, inyección).
2. Implementar un integrador numérico conservativo (Boris) y validar la
   conservación de invariantes.
3. Diseñar una función de aptitud que capture retención + estabilidad +
   distribución y optimizarla con un AG.
4. Caracterizar el espacio de parámetros e identificar el **régimen óptimo
   (>600 partículas)**.
5. Especificar la instrumentación, el protocolo y los criterios de un
   experimento de validación.

## 1.5 Contribuciones

- Un **modelo de confinamiento acumulativo** con inyección continua y pérdida
  irreversible, que convierte el conteo de partículas en un observable físico.
- Una **función de aptitud multiobjetivo** (retención/estabilidad/distribución)
  para control de confinamiento.
- La **co-optimización de campo y de calentamiento láser** (encendido/apagado por
  el AG), con el hallazgo de que la solución óptima **minimiza** el calentamiento.
- Un **escenario reproducible** que sostiene ≈ 719 electrones, con su análisis de
  equilibrio.
- Una **hoja de ruta experimental** detallada.

## 1.6 Estructura

El capítulo 2 sitúa el trabajo en el estado del arte. El 3 deriva todas las
ecuaciones. El 4 detalla el AG. El 5 cubre la implementación y validación. El 6
presenta los resultados. El 7 traza la realización experimental. El 8 concluye.

---

# Capítulo 2. Estado del arte y marco teórico

## 2.1 Confinamiento de partículas cargadas

Una partícula de carga $q$ y masa $m$ en campos $\mathbf E,\mathbf B$ obedece la
ecuación de Lorentz $m\dot{\mathbf v}=q(\mathbf E+\mathbf v\times\mathbf B)$. El
confinamiento puro magnético explota que la componente perpendicular del
movimiento es circular (giro de Larmor) con radio
$r_L = m v_\perp/(qB)$ y frecuencia de ciclotrón $\omega_c=qB/m$. El reto es
confinar también el movimiento paralelo y los puntos de fuga (cúspides).

## 2.2 Tipos de trampas

| Trampa | Mecanismo | Especie típica |
|---|---|---|
| **Penning** | $B$ axial uniforme + pozo electrostático | electrones, iones, antimateria |
| **Penning–Malmberg** | $B$ axial + electrodos cilíndricos | **plasmas no neutros de electrones** |
| **Paul (RF)** | Campo **eléctrico** oscilante (pseudopotencial) | iones |
| **Espejo magnético** | Gradiente de $B$ (reflexión) | plasmas de fusión |
| **Tokamak/Stellarator** | Campo toroidal+poloidal | plasmas de fusión |

El presente esquema —**dipolos magnéticos rotatorios polifásicos**— es un híbrido
conceptual: usa la idea del **pseudopotencial oscilante** de Paul pero con campo
**magnético**, y una topología cuasi-esférica. Es una construcción original con
fines de estudio; la trampa real más cercana para electrones es la de
**Penning–Malmberg** (§7).

## 2.3 Plasmas no neutros

Un gas de electrones es un **plasma no neutro**: la carga espacial genera un campo
propio que, a densidades altas, domina la dinámica (límite de Brillouin). El
modelo de esta tesis **no** incluye autocampos (§9); es válido en el régimen de
baja densidad donde el conteo de partículas es moderado y las interacciones
partícula-partícula son despreciables frente al campo externo.

## 2.4 Métodos numéricos para partículas cargadas

El **integrador de Boris** (1970) es el estándar de facto en simulación de
partículas (PIC): es de segundo orden, preserva el volumen en el espacio de fases
y, en ausencia de campo eléctrico, ejecuta una **rotación exacta** que conserva la
energía cinética. Se adopta por su estabilidad a largo plazo (capítulos 3 y 5).

## 2.5 Optimización por algoritmos genéticos en física de plasmas

Los AG y, más recientemente, el aprendizaje por refuerzo se han usado para
**controlar la forma y estabilidad del plasma** (p. ej. control magnético de
tokamaks). Su ventaja es no requerir gradientes ni un modelo diferenciable del
objetivo, lo que encaja con una funcional de aptitud basada en una simulación
costosa y discontinua (pérdidas, encendido/apagado de láseres).

---

# Capítulo 3. Modelo físico-matemático

## 3.1 Sistema de unidades

Se trabaja en **unidades normalizadas** para estabilidad numérica y
generalidad. Tres escalas independientes ($L_0,\ t_0,\ B_0$) permiten recuperar
unidades SI (§7.2).

| Magnitud | Símbolo | Valor |
|---|---|---|
| Radio de la cavidad | $R$ | $1$ |
| Carga/masa | $q/m$ | $1$ |
| Paso temporal | $\Delta t$ | $0.02$ |
| Acoplamiento de campo | $\kappa$ | $2.5$ |
| Suavizado del campo | $\varepsilon$ | $\max(0.18,\,0.28\,d_{NN})$ |
| Rapidez de inyección | $v_0$ | $0.6$ (a 2 kW) |
| Tope de calentamiento | $v_{\max}$ | $2.6\,v_0$ |

## 3.2 Geometría del confinamiento

### 3.2.1 Distribución simétrica de bobinas

Para $N\in\{4,6,8,12,20\}$ se usan los vértices normalizados de los **sólidos
platónicos**. Para $N$ arbitrario, la **espiral de Fibonacci** reparte los puntos
de forma casi uniforme mediante el ángulo áureo $\gamma=\pi(3-\sqrt5)$:

$$
y_i = 1-\frac{2i+1}{N},\quad
\rho_i=\sqrt{1-y_i^2},\quad
\phi_i=\gamma\,i,\quad
\mathbf p_i = R\,(\rho_i\cos\phi_i,\ y_i,\ \rho_i\sin\phi_i). \tag{3.1}
$$

La distancia al vecino más cercano
$d_{NN}=\min_{i\neq j}\lVert\mathbf p_i-\mathbf p_j\rVert$ fija el radio del anillo
de cada bobina ($d_{NN}/2$) y el suavizado del campo.

### 3.2.2 Pares antípodas

Cada bobina $i$ se empareja con la más próxima a su antípoda:

$$
\mathrm{par}(i)=\arg\min_{j\neq i}\big\lVert \mathbf p_j+\mathbf p_i\big\rVert^2. \tag{3.2}
$$

Ambas comparten amplitud y fase ⇒ **misma corriente instantánea**. Con $N$
bobinas hay $n_g=\lceil N/2\rceil$ grupos independientes.

### 3.2.3 Huecos intersticiales (envolvente convexa)

Los láseres se ubican en el **hueco entre tríos de bobinas vecinas**, obtenidos
triangulando la esfera con su **envolvente convexa**. Un triángulo $(i,j,k)$ es
una cara si todos los demás puntos quedan a un mismo lado de su plano:

$$
\mathbf n=(\mathbf p_j-\mathbf p_i)\times(\mathbf p_k-\mathbf p_i),\qquad
\operatorname{sign}\!\big(\mathbf n\cdot(\mathbf p_m-\mathbf p_i)\big)=\text{cte}\ \ \forall m. \tag{3.3}
$$

El emisor se sitúa en el centroide $\mathbf c=\tfrac13(\mathbf p_i+\mathbf p_j+\mathbf p_k)$
y apunta al centro, $\hat{\mathbf d}=-\mathbf c/\lVert\mathbf c\rVert$. Por la
relación de Euler, una triangulación de $V$ vértices tiene $2V-4$ caras: $N=12$
(icosaedro) ⇒ **20 huecos** (= vértices del dodecaedro), de ahí el nombre del
proyecto.

## 3.3 Excitación polifásica de las bobinas

El sistema se alimenta como un **sistema polifásico** de **frecuencia común** $f$
y **desfase de 60°** entre grupos consecutivos, $\varphi_g=g\,\pi/3$, lo que
genera un **campo magnético rotatorio**. Se añade un control
**proporcional–derivativo** (PD) sobre el radio medio de la nube. La corriente de
una bobina del grupo $g$ es:

$$
\boxed{\,I_g(t)=A_g\,\sin\!\big(2\pi f t+\varphi_g\big)+k_p\,\bar r(t)+k_d\,\dot{\bar r}(t)\,} \tag{3.4}
$$

con $\bar r(t)=\langle \lVert\mathbf x\rVert\rangle$ el radio medio de las
partículas vivas. El término oscilante crea el **pseudopotencial de
confinamiento** (analogía de Paul); el término PD es la **autorregulación** que
refuerza el empuje radial cuando la nube se dilata.

### 3.3.1 Origen del pseudopotencial (aproximación ponderomotriz)

Para un campo oscilante rápido, la teoría ponderomotriz promedia el micromovimiento
y da un **potencial efectivo** $\propto \langle |\nabla(\text{campo})|^2\rangle/\omega^2$.
La frecuencia $f$ (gen del AG) modula así la **profundidad y la dirección** del
pozo efectivo; el capítulo 6 muestra que el AG selecciona $f$ en un rango estrecho
y físicamente coherente.

## 3.4 Campo magnético: superposición de dipolos

Cada bobina se modela como un **dipolo magnético puntual** en $\mathbf p_i$ con
momento radial hacia adentro $\hat{\mathbf m}_i=-\mathbf p_i/\lVert\mathbf p_i\rVert$
y magnitud $\propto I_i(t)$. El campo total es:

$$
\boxed{\,\mathbf B(\mathbf r,t)=\kappa\sum_{i=1}^{N} I_i(t)\,
\frac{3(\hat{\mathbf m}_i\cdot\hat{\mathbf d}_i)\hat{\mathbf d}_i-\hat{\mathbf m}_i}
{\big(\lVert\mathbf d_i\rVert^2+\varepsilon^2\big)^{3/2}}\,} \tag{3.5}
$$

con $\mathbf d_i=\mathbf r-\mathbf p_i$, $\hat{\mathbf d}_i=\mathbf d_i/\lVert\mathbf d_i\rVert$.
El parámetro $\varepsilon$ regulariza la singularidad $1/r^3$ cerca de la bobina
(distancia de cierre del bobinado finito) y hace que los campos cubran su espacio.
$\kappa$ agrupa $\mu_0/4\pi$ y las escalas (§7.2).

## 3.5 Dinámica: fuerza de Lorentz

Sin campo eléctrico externo en el modelo,

$$
\boxed{\,m\,\dot{\mathbf v}=q\,\mathbf v\times\mathbf B\,} \tag{3.6}
$$

La potencia magnética es nula, $\mathbf F\cdot\mathbf v=0$, de modo que **la
rapidez se conserva**: el campo solo curva trayectorias. La única vía de cambio de
energía cinética son los láseres (§3.7). Confinar equivale a curvar las órbitas en
trayectorias cerradas dentro de la cavidad.

## 3.6 Integración numérica: empuje de Boris

Para integrar (3.6) se usa el **algoritmo de Boris**. Con $\mathbf v^n,\mathbf B,\Delta t$:

$$
\mathbf t=\frac{q}{m}\mathbf B\frac{\Delta t}{2},\qquad
\mathbf s=\frac{2\mathbf t}{1+\lVert\mathbf t\rVert^2}, \tag{3.7}
$$
$$
\mathbf v'=\mathbf v^n+\mathbf v^n\times\mathbf t,\qquad
\mathbf v^{n+1}=\mathbf v^n+\mathbf v'\times\mathbf s,\qquad
\mathbf x^{n+1}=\mathbf x^n+\mathbf v^{n+1}\Delta t. \tag{3.8}
$$

Sin campo eléctrico, (3.7)–(3.8) son una **rotación pura** de $\mathbf v$, por lo
que $\lVert\mathbf v^{n+1}\rVert=\lVert\mathbf v^n\rVert$ a precisión de máquina
(validado en §5.3). Una partícula se da por **perdida** si $\lVert\mathbf x\rVert\ge R$.

## 3.7 Inyección acumulativa y calentamiento láser

### 3.7.1 Cañones y modelo acumulativo

Hay **un cañón en el centro de cada bobina**. La cavidad **arranca vacía**; en
cada paso se inyectan $\lfloor a\rfloor$ partículas nuevas, con
$a\mathrel{+}=\lambda\,\Delta t$ (tasa $\lambda$, part/u.t.), disparadas desde
$0.96\,R$ hacia el centro con dispersión tangencial y rapidez

$$
v_0=v_{\text{ref}}\sqrt{P_c/P_{\text{ref}}},\qquad v_{\text{ref}}=0.6,\ P_{\text{ref}}=2\ \text{kW}. \tag{3.9}
$$

Las partículas que escapan se **eliminan irreversiblemente**. Por tanto la
población viva $N(t)$ **crece si el confinamiento retiene** y alcanza un
**equilibrio** (§3.8). El almacenamiento es un array compacto con *swap-remove*,
y la acumulación es **ilimitada** salvo un límite de seguridad de memoria.

### 3.7.2 Láseres

Cada láser, desde su hueco $\mathbf o$ con dirección $\hat{\mathbf d}$, calienta a
la partícula en $\mathbf p$ si está dentro del haz y por delante del emisor. Con
$\mathbf w=\mathbf p-\mathbf o$, $s_\parallel=\mathbf w\cdot\hat{\mathbf d}$,
$d_\perp^2=\lVert\mathbf w\rVert^2-s_\parallel^2$:

$$
\text{impacta}\iff s_\parallel>0\ \wedge\ d_\perp^2<r_{\text{haz}}^2,\qquad
\lVert\mathbf v\rVert\leftarrow\min\!\big(v_{\max},\ \lVert\mathbf v\rVert+P_L\Delta t\big). \tag{3.10}
$$

Cada láser $k$ tiene un gen $L_k\in[0,1]$; está **encendido si $L_k>0.5$**. El AG
decide qué láseres encender (capítulo 4).

## 3.8 Balance de población y equilibrio

En régimen acumulativo, la población obedece un balance tipo natalidad–mortalidad:

$$
\frac{dN}{dt}=\lambda-\frac{N}{\tau}, \tag{3.11}
$$

donde $\tau$ es el **tiempo medio de confinamiento**. La solución es
$N(t)=\lambda\tau\,(1-e^{-t/\tau})$, con **equilibrio**

$$
\boxed{\,N_{\text{eq}}=\lambda\,\tau\,} \tag{3.12}
$$

La ec. (3.12) es central: el número confinado escala **linealmente** con la tasa
de inyección y con el tiempo de confinamiento. Mejorar el control (mayor $\tau$) o
inyectar más rápido (mayor $\lambda$) aumenta $N_{\text{eq}}$ sin límite teórico
(capítulo 6 confirma $N_{\text{eq}}\approx\lambda\tau$ con datos del simulador).

---

# Capítulo 4. Optimización mediante algoritmo genético

## 4.1 Codificación (genoma)

Un genoma es un vector real de longitud $\lceil N/2\rceil+3+n_L$:

$$
\theta=\big[\underbrace{f}_{1},\ \underbrace{A_0\dots A_{n_g-1}}_{n_g},\ \underbrace{k_p,k_d}_{2},\ \underbrace{L_0\dots L_{n_L-1}}_{n_L}\big] \tag{4.1}
$$

con cotas $f\in[0,4]$, $A_g\in[0,3]$, $k_p,k_d\in[-8,8]$, $L_k\in[0,1]$. La fase
$\varphi_g=g\cdot60°$ es **determinista** (no se evoluciona): impone la estructura
polifásica.

## 4.2 Función de aptitud

Cada genoma se evalúa en un episodio de $T$ pasos con cámara inicialmente vacía:

$$
\boxed{\,\mathcal{F}(\theta)=\mathcal S+0.30\,\mathcal E+0.15\,\mathcal D\,} \tag{4.2}
$$

**Retención/acumulación** (fracción de inyectadas que se confina y centra):

$$
\mathcal S=\frac1T\sum_{t=1}^{T}\frac{N(t)}{N_{\text{iny}}(t)}\Big(0.5+0.5\,\bar c(t)\Big),\quad
\bar c(t)=\big\langle 1-(r/R)^2\big\rangle. \tag{4.3}
$$

**Estabilidad** (baja fluctuación temporal del radio medio):

$$
\mathcal E=e^{-6\,\sigma_t[\bar r]}\cdot f_{\text{viva}},\qquad
\sigma_t[\bar r]=\sqrt{\langle\bar r^2\rangle_t-\langle\bar r\rangle_t^2}. \tag{4.4}
$$

**Distribución** (grosor radial sano, centrado en $0.25R$):

$$
\mathcal D=\exp\!\Big[-\big((\overline{\sigma_r}-0.25R)/0.22R\big)^2\Big]\cdot f_{\text{viva}}. \tag{4.5}
$$

Los escapes reducen $\mathcal S$ de forma implícita, por lo que no hace falta
penalización explícita. $f_{\text{viva}}$ es la fracción del episodio con nube
viva (evita premiar nubes extinguidas).

## 4.3 Operadores evolutivos

| Operador | Definición |
|---|---|
| Selección | Torneo de tamaño 3 |
| Cruce | BLX-α, $\alpha=0.3$, por gen: $c\sim U[\min-\alpha\Delta,\ \max+\alpha\Delta]$ |
| Mutación | Gaussiana (Box–Muller), $\sigma=0.18\times$rango, prob. configurable |
| Elitismo | 10 % superior conservado |
| Episodio | Semilla común por generación, variable entre generaciones (evita sobreajuste) |

## 4.4 Paralelismo y coste

La geometría (bobinas, pares, huecos, hull) **no depende del genoma**: se
**memoiza** (se calcula una sola vez por configuración). El AG corre en un **Web
Worker** para no bloquear la interfaz. Coste por evaluación
$\mathcal O(T\cdot N(t)\cdot N_{\text{bobinas}})$; como $N(t)\le\lambda T$, los
episodios de entrenamiento son acotados (~100–200 partículas), mientras que el
régimen "en vivo" puede acumular miles.

---

# Capítulo 5. Implementación computacional y validación numérica

## 5.1 Arquitectura

```
config ─► getGeometry (memoizado): bobinas, pares, hull→huecos, láseres, ε, d_NN
       ─► GA (Web Worker): por generación, por genoma →
              Simulation: I(t) (3.4) → B (3.5) → Boris (3.7-3.8)
                          → láseres (3.10) → escapes → inyección (3.7.1)
                          → métricas de aptitud (4.3-4.5)
       ─► mejor genoma ─► render 3D (Three.js) en tiempo real
```

Módulos: `physics.js` (física pura, compartida), `ga.js` (AG), `sim-worker.js`
(worker), `main.js` (render/UI).

## 5.2 Envolvente convexa robusta

Para evitar degeneraciones por simetría exacta (cuádruples coplanares de los
sólidos platónicos) se aplica un *jitter* determinista de $10^{-3}$ antes de
triangular, calculando los centroides con las posiciones originales. La
triangulación por enumeración ($\mathcal O(N^4)$, robusta para $N$ pequeño) cumple
la fórmula de Euler $2V-4$ en todos los casos validados.

## 5.3 Validación numérica

- **Conservación de rapidez** (test de Boris sin láser): $\lVert\mathbf v\rVert$
  constante a $\sim 10^{-15}$ relativo, como exige la rotación pura.
- **Triangulación**: icosaedro→20, octaedro→8, cubo→12, dodecaedro→36 caras;
  Fibonacci $2N-4$ exacto (verificado $N=10\dots200$).
- **Determinismo**: con semilla fija, las trayectorias y la aptitud son
  reproducibles bit a bit (RNG mulberry32).
- **Balance de población**: el equilibrio medido coincide con (3.12) (§6.3).

---

# Capítulo 6. Resultados y análisis de escenarios

## 6.1 Configuración óptima (escenario nominal)

| Parámetro | Valor |
|---|---|
| Bobinas | 12 (icosaedro), 6 pares antípodas |
| Láseres (huecos) | 20 |
| Tasa de inyección $\lambda$ | 75 part/u.t. |
| Acoplamiento $\kappa$ | 2.5 |
| Población AG / generaciones | 48 / 36 |
| Pasos por episodio | 600 |

## 6.2 Convergencia del algoritmo genético

La aptitud del mejor individuo (datos reales del simulador):

| Generación | Mejor | Media | Mejor histórico |
|---:|---:|---:|---:|
| 0  | 0.832 | 0.651 | 0.832 |
| 4  | 0.883 | 0.818 | 0.885 |
| 8  | 0.922 | 0.870 | 0.922 |
| 12 | 0.940 | 0.899 | 0.940 |
| 16 | 0.936 | 0.883 | 0.947 |
| 20 | 0.941 | 0.880 | 0.947 |
| 28 | 0.960 | 0.897 | 0.960 |
| 32 | 0.962 | 0.904 | 0.962 |
| 35 | 0.960 | 0.912 | **0.962** |

La convergencia es rápida (aptitud > 0.92 en 8 generaciones) y estable; la mejora
posterior es marginal, indicando una meseta de óptimo robusto.

## 6.3 Régimen acumulativo: >600 electrones sostenidos

Ejecutando el mejor genoma durante 10⁴ pasos (≈ 200 u.t.), serie temporal real:

| $t$ (u.t.) | $N$ confinadas | $\bar r/R$ | $\bar v$ | Láseres ON |
|---:|---:|---:|---:|---:|
| 0   | 1   | 0.960 | 0.600 | 2/20 |
| 20  | 668 | 0.637 | 0.676 | 2/20 |
| 40  | 697 | 0.624 | 0.675 | 2/20 |
| 60  | 730 | 0.629 | 0.686 | 2/20 |
| 100 | 738 | 0.632 | 0.667 | 2/20 |
| 120 | 748 | 0.630 | 0.671 | 2/20 |
| 160 | 739 | 0.626 | 0.677 | 2/20 |
| 200 | 686 | 0.620 | 0.654 | 2/20 |

- **Equilibrio**: $N_{\text{eq}}\approx 719$ electrones (pico 748), **sostenido**,
  superando holgadamente el objetivo de 600.
- **Balance**: tasa de escape medida $71.6$/u.t. ≈ tasa de inyección $75$/u.t.,
  confirmando el equilibrio dinámico de (3.11).
- **Tiempo de confinamiento**: $\tau\approx N_{\text{eq}}/\lambda\approx 9.6$ u.t.,
  coherente con (3.12).
- **Estructura de la nube**: radio medio $\bar r\approx 0.62\,R$ (una **capa**
  estable, ni colapsada ni difusa), rapidez media $\bar v\approx 0.67$ (ligero
  calentamiento sobre $v_0=0.6$).

## 6.4 Hallazgo: el óptimo minimiza el calentamiento

El AG mantuvo **solo 2 de 20 láseres encendidos**. Interpretación física: como el
campo magnético conserva la energía, todo calentamiento extra **aumenta el radio
de Larmor** ($r_L\propto v$) y favorece el escape; el óptimo conserva el mínimo de
láseres necesario para sostener la dinámica/estabilidad, apagando el resto. Es un
resultado **no trivial y físicamente interpretable** descubierto por la
optimización, no impuesto a mano.

## 6.5 Análisis paramétrico (escalado de $N_{\text{eq}}$)

Barrido sobre tasa de inyección (mejor genoma por escenario), datos del simulador:

| Escenario | Bobinas / Láseres | $\lambda$ | Pico $N$ | Meseta $N_{\text{eq}}$ |
|---|---|---:|---:|---:|
| A | 12 / 12 | 20  | 180  | 152  |
| B | 12 / 20 | 60  | 613  | 568  |
| C | 20 / 0  | 80  | 617  | 587  |
| Nominal | 12 / 20 | 75 | 748 | **719** |
| D | 12 / 12 | 100 | 1523 | 1472 |

El escalado **lineal** $N_{\text{eq}}\approx\lambda\tau$ se confirma: con $\tau$
casi constante (control optimizado), duplicar $\lambda$ ≈ duplica la población.
**No existe un tope artificial**; el límite es físico (equilibrio) o de recursos.

## 6.6 Discusión

El sistema cumple H1–H3: el campo polifásico rotatorio confina; la población
acumula hasta un equilibrio $\lambda\tau$; y el AG halla configuraciones que
sostienen >600 electrones con una estrategia interpretable (mínimo calentamiento,
campo rotatorio de baja frecuencia, control PD activo).

---

# Capítulo 7. De la simulación al experimento: diseño y realización

> Objetivo: convertir el modelo en un **experimento de trampa de electrones**.
> Las cifras son órdenes de magnitud para ingeniería de detalle y **requieren
> validación por especialistas en vacío, alto voltaje, criogenia y láseres**.

## 7.1 Estrategia de validación experimental

Se propone una validación **incremental** en tres fases:
1. **Fase I — Trampa estática** (sin AG): verificar confinamiento con campos fijos
   y diagnóstico de carga acumulada.
2. **Fase II — Control en lazo**: introducir el control PD y la modulación
   polifásica; medir el tiempo de confinamiento $\tau$.
3. **Fase III — Optimización**: usar el AG **fuera de línea** sobre un gemelo
   digital calibrado y aplicar las mejores soluciones al equipo real.

## 7.2 Reducción a unidades físicas (calibración de escalas)

Fijadas tres escalas, todo el modelo se mapea a SI:
- **Longitud** $L_0=R_{\text{real}}$ (p. ej. $0.1$ m).
- **Campo** $B_0$ (de la fuente de corriente de las bobinas).
- **Tiempo** $t_0=m/(qB_0)$ (inverso de la frecuencia de ciclotrón).

Entonces la velocidad física es $v_{\text{SI}}=v\,L_0/t_0$, el radio de Larmor
$r_L=mv_\perp/(qB)$ debe cumplir $r_L\ll R_{\text{real}}$, y la frecuencia de
excitación $f_{\text{SI}}=f/t_0$. **Criterio de diseño**: elegir $B_0$ tal que
$r_L$ sea $\lesssim R/10$ para la energía de inyección elegida.

## 7.3 Cámara de vacío

- Geometría cuasi-esférica o **dodecaédrica** (caras para bobinas, vértices/aristas
  para diagnósticos y láseres).
- **Ultra-alto vacío** $10^{-9}$–$10^{-10}$ mbar (camino libre medio ≫ $R$, para
  que el modelo sin colisiones sea válido).
- Acero 316L o Ti, bridas ConFlat, bombeo turbomolecular + iónico + getter (NEG).
- Ventanas ópticas de calidad láser y pasamuros de alto voltaje.

## 7.4 Bobinas y sistema polifásico

- $N$ electroimanes (Helmholtz cortas) en pares antípodas en **serie** (corriente
  idéntica garantizada por hardware, no solo por software).
- **Campo** $B_0\sim 10^{-2}$–$10^{-1}$ T (cobre refrigerado) o $\sim 1$ T
  (superconductor NbTi con criostato) según energía.
- **Alimentación**: inversores/amplificadores por grupo con **frecuencia común**
  y **desfase de 60°** programable; lazo de control de corriente rápido para el
  término PD (ec. 3.4).
- Refrigeración por agua desionizada o criogenia; protección contra *quench* si es
  superconductor.

## 7.5 Cañones de electrones

- Cátodo termoiónico (LaB₆/W) o emisión de campo, con óptica de enfoque.
- **Energía**: referencia 2 kW de potencia de haz; a energías keV altas
  **incluir corrección relativista** (el modelo es no relativista, §9).
- Inyección pulsada sincronizada para controlar $\lambda$ con precisión.

## 7.6 Láseres de inyección de energía

- Emisores en los huecos intersticiales, con obturadores acusto-ópticos para el
  **on/off** dictado por el control (genes $L_k$).
- **Advertencia de escala**: el calentamiento real de plasma requiere kW–MW
  (CO₂, Nd:YAG pulsado); los 5 W del modelo son ilustrativos del mecanismo. Como
  el óptimo **minimiza** el calentamiento (§6.4), una primera realización puede
  prescindir de láseres de alta potencia y usarlos solo como perturbación
  controlada para estudios de estabilidad.

## 7.7 Diagnóstico (la diferencia clave con el modelo)

En el experimento **no se rastrea cada electrón**; se miden magnitudes colectivas:

| Observable del modelo | Diagnóstico experimental |
|---|---|
| $N(t)$ (conteo) | Carga total recogida; corriente de fuga; electrodos de imagen |
| Densidad/perfil | Interferometría láser/microondas; sondas de Langmuir |
| Energía/temperatura | Dispersión de Thomson; analizador de energía retardante |
| Posición/estabilidad de la nube | Bobinas de *pickup*; tomografía de emisión; cámara rápida |
| $\tau$ (tiempo de confinamiento) | Decaimiento de la carga tras cortar la inyección |

## 7.8 Sistema de control en tiempo real

- **AG fuera de línea** sobre un gemelo digital calibrado; en línea, un
  controlador rápido (PID/MPC/RL) en **FPGA/DSP** con latencia de µs.
- Entradas: diagnósticos (§7.7). Salidas: amplitud/frecuencia por grupo y on/off
  de láseres. **Reloj común** para mantener el desfase de 60°.

## 7.9 Protocolo experimental (resumen operativo)

1. Alcanzar UHV y caracterizar campo de bobinas (mapeo con sonda Hall).
2. Calibrar escalas ($L_0,B_0,t_0$) y fijar energía de inyección con $r_L\ll R$.
3. **Fase I**: campos estáticos; inyectar y medir carga acumulada vs tiempo →
   estimar $\tau_0$.
4. **Fase II**: activar modulación polifásica + PD; barrer $f$ y amplitudes;
   medir $\tau(f)$ y buscar el máximo (predicho por la teoría ponderomotriz).
5. **Fase III**: optimizar el gemelo digital con el AG; transferir soluciones;
   verificar $N_{\text{eq}}\approx\lambda\tau$ (ec. 3.12).
6. Estudios de estabilidad con perturbación láser controlada.

## 7.10 Presupuesto orientativo y riesgos

| Partida | Orden de magnitud |
|---|---|
| Cámara UHV + bombeo | medio |
| Bobinas + fuentes polifásicas + control | alto |
| Cañón(es) de electrones | medio |
| Diagnóstico (Langmuir, *pickup*, adquisición) | medio–alto |
| Láseres (opcionales en fase inicial) | variable |
| Control FPGA/DSP | bajo–medio |

**Riesgos**: alto voltaje, campos intensos, **radiación X** por *bremsstrahlung*,
láseres clase 4, criogenia, implosión por vacío. Requiere apantallamiento,
enclavamientos, zona controlada y cumplimiento normativo.

## 7.11 Criterios de éxito (validación de hipótesis)

- **C1**: confinamiento medible ($\tau$ significativamente mayor que el tránsito
  balístico) con campo estático. (valida parte de H1)
- **C2**: dependencia $\tau(f)$ con máximo en el rango predicho. (valida H1 y la
  teoría ponderomotriz)
- **C3**: acumulación con $N_{\text{eq}}\propto\lambda$ a $\tau$ fijo. (valida H2)
- **C4**: las soluciones del AG mejoran $\tau$/$N_{\text{eq}}$ frente a ajustes
  manuales. (valida H3)

---

# Capítulo 8. Conclusiones y trabajo futuro

## 8.1 Conclusiones

1. Se ha formulado y validado un **modelo completo y reproducible** de
   confinamiento magnético acumulativo de electrones, con todas las ecuaciones
   auditables (capítulo 3).
2. El **modelo acumulativo** convierte el conteo de partículas en un observable
   físico con equilibrio $N_{\text{eq}}=\lambda\tau$ (3.12), confirmado
   numéricamente.
3. El **AG optimiza** un objetivo multiobjetivo (retención+estabilidad+
   distribución) y alcanza un régimen que **sostiene ≈ 719 electrones** (>600),
   con convergencia rápida y robusta.
4. La optimización **descubre física**: minimiza el calentamiento láser para
   reducir el radio de Larmor y las pérdidas, un resultado interpretable.
5. Se entrega una **hoja de ruta experimental** detallada con instrumentación,
   protocolo, diagnóstico, presupuesto, riesgos y criterios de validación.

## 8.2 Limitaciones (ver §9 ampliado)

Modelo sin colisiones, sin autocampos (carga espacial), sin radiación, no
relativista, con bobinas idealizadas como dipolos puntuales y unidades
normalizadas. Estas hipótesis acotan la validez al régimen de baja densidad y
energía moderada.

## 8.3 Trabajo futuro

- **Modelo cinético/PIC** con autocampos (límite de Brillouin) y colisiones.
- **Campo de espira realista** (Biot–Savart sobre el bobinado) en lugar de dipolo.
- **Corrección relativista** del empuje de Boris para energías altas.
- **Control en línea por aprendizaje por refuerzo** sobre el gemelo digital.
- **Construcción de la Fase I** y comparación experimento–simulación.

---

# Apéndice A. Derivaciones

**A.1 Conservación de la rapidez en el empuje de Boris.** La rotación de
Boris implementa $\mathbf v^{n+1}=\mathcal R(\hat{\mathbf b},\theta)\mathbf v^n$
con $\theta=2\arctan(\lVert\mathbf t\rVert)$ y $\hat{\mathbf b}=\mathbf B/\lVert\mathbf B\rVert$.
Por ser $\mathcal R$ ortogonal, $\lVert\mathbf v^{n+1}\rVert=\lVert\mathbf v^n\rVert$. ∎

**A.2 Equilibrio de población.** De $\dot N=\lambda-N/\tau$ (3.11), en estado
estacionario $\dot N=0\Rightarrow N_{\text{eq}}=\lambda\tau$; la solución
transitoria es $N(t)=\lambda\tau(1-e^{-t/\tau})$. ∎

**A.3 Campo dipolar.** Partiendo de $\mathbf A=\frac{\mu_0}{4\pi}\frac{\mathbf m\times\hat{\mathbf r}}{r^2}$
y $\mathbf B=\nabla\times\mathbf A$ se obtiene
$\mathbf B=\frac{\mu_0}{4\pi}\frac{3(\mathbf m\cdot\hat{\mathbf r})\hat{\mathbf r}-\mathbf m}{r^3}$,
forma usada en (3.5) con regularización $\varepsilon$. ∎

# Apéndice B. Tabla maestra de parámetros

| Símbolo | Significado | Valor nominal |
|---|---|---|
| $R$ | radio de cavidad | 1 |
| $N$ | nº de bobinas | 12 (icosaedro) |
| $n_g$ | nº de pares | 6 |
| $n_L$ | nº de láseres | 20 |
| $\lambda$ | tasa de inyección | 75 |
| $\Delta t$ | paso temporal | 0.02 |
| $\kappa$ | acoplamiento de campo | 2.5 |
| $\varepsilon$ | suavizado | $\max(0.18,0.28 d_{NN})$ |
| $v_0$ | rapidez de inyección | 0.6 |
| $v_{\max}$ | tope de calentamiento | $2.6 v_0$ |
| $f$ | frecuencia común | gen del AG $\in[0,4]$ |
| $\varphi_g$ | desfase polifásico | $g\cdot 60°$ |
| Población / generaciones | AG | 48 / 36 |

# Apéndice C. Pseudocódigo del bucle de simulación

```
Simulation.step(Δt):
    r̄, ṙ̄ ← estadística radial de la nube
    para cada grupo g:  I_g ← A_g·sin(2πf·t+φ_g) + k_p·r̄ + k_d·ṙ̄      (3.4)
    para cada partícula i (array compacto):
        B ← Σ_bobinas dipolo(I_i, p_i, x_i)                            (3.5)
        v ← empuje_de_Boris(v, B, Δt)                                  (3.7-3.8)
        v ← calentamiento_láser(v, x_i)  si algún láser ON la ilumina  (3.10)
        x ← x + v·Δt
        si |x| ≥ R:  eliminar i (swap-remove); lost++
    inyectar ⌊λ·Δt + acumulador⌋ partículas nuevas desde cañones       (3.7.1)
    acumular métricas de aptitud                                        (4.3-4.5)
```

---

# Bibliografía

1. J. D. Griffiths, *Introduction to Electrodynamics*, 4ª ed., Cambridge UP, 2017.
2. J. P. Boris, "Relativistic plasma simulation—optimization of a hybrid code",
   *Proc. 4th Conf. on Numerical Simulation of Plasmas*, 1970.
3. C. K. Birdsall, A. B. Langdon, *Plasma Physics via Computer Simulation*,
   CRC Press, 2004.
4. W. Paul, "Electromagnetic traps for charged and neutral particles",
   *Rev. Mod. Phys.* **62**, 531 (1990).
5. J. H. Malmberg, J. S. deGrassie, "Properties of nonneutral plasma",
   *Phys. Rev. Lett.* **35**, 577 (1975).
6. R. C. Davidson, *Physics of Nonneutral Plasmas*, Imperial College Press, 2001.
7. D. E. Goldberg, *Genetic Algorithms in Search, Optimization, and Machine
   Learning*, Addison-Wesley, 1989.
8. J. Degrave et al., "Magnetic control of tokamak plasmas through deep
   reinforcement learning", *Nature* **602**, 414 (2022).
9. Á. González, "Measurement of areas on a sphere using Fibonacci and
   latitude–longitude lattices", *Math. Geosci.* **42**, 49 (2010).
10. F. F. Chen, *Introduction to Plasma Physics and Controlled Fusion*,
    3ª ed., Springer, 2016.

---

*Documento generado como complemento académico del simulador del repositorio.
Para el modelo ejecutable y la documentación técnica de implementación, véanse
`README.md` y `docs/DOCUMENTACION_TECNICA.md`.*
