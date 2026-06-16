# Documentación técnica — Simulador de confinamiento de electrones

Confinamiento de electrones en una esfera de bobinas polifásicas, con láseres
de calentamiento y un algoritmo genético que aprende a mantener la nube de
plasma estable y centrada.

> **Alcance y honestidad.** Este es un **modelo educativo simplificado**, no un
> código de física de plasmas validado. Reproduce de forma cualitativa varios
> fenómenos reales (fuerza de Lorentz, campos dipolares, trampas oscilantes tipo
> RF, calentamiento por haz), pero hace simplificaciones fuertes (campos
> dipolares puntuales, sin colisiones, sin autocampos del plasma, sin
> relatividad). La sección §9 detalla qué es realista y qué no. La §8 describe
> qué haría falta para una implementación física real.

---

## Índice

1. [Sistema de unidades](#1-sistema-de-unidades)
2. [Geometría](#2-geometría)
3. [Electromagnetismo](#3-electromagnetismo)
4. [Integración numérica (empuje de Boris)](#4-integración-numérica-empuje-de-boris)
5. [Inyección de energía: cañones y láseres](#5-inyección-de-energía-cañones-y-láseres)
6. [Algoritmo genético](#6-algoritmo-genético)
7. [Pipeline de simulación](#7-pipeline-de-simulación)
8. [Requisitos técnicos para una implementación real](#8-requisitos-técnicos-para-una-implementación-real)
9. [Limitaciones y simplificaciones del modelo](#9-limitaciones-y-simplificaciones-del-modelo)
10. [Referencias](#10-referencias)

---

## 1. Sistema de unidades

La simulación usa **unidades normalizadas** (adimensionales) para que la dinámica
sea numéricamente estable y visualizable:

| Magnitud | Símbolo | Valor en el modelo |
|---|---|---|
| Radio de la esfera (frontera) | $R$ | $1$ |
| Carga / masa del electrón | $q,\,m$ | $q=m=1 \Rightarrow q/m = 1$ |
| Paso de integración | $\Delta t$ | $0.02$ |
| Acoplamiento de campo | $\kappa$ (`kmag`) | $2.5$ |
| Suavizado del campo | $\varepsilon$ (`eps`) | $\max(0.18,\ 0.28\, d_{NN})$ |
| Rapidez de inyección base | $v_0$ | $0.6$ a 2 kW |

donde $d_{NN}$ es la distancia entre bobinas vecinas (§2.1). Para pasar a
unidades SI habría que fijar tres escalas independientes (longitud $L_0$,
tiempo $t_0$ y campo $B_0$) y reescalar; ver §8.

---

## 2. Geometría

### 2.1 Distribución de bobinas

Las $N$ bobinas se colocan simétricamente sobre la esfera de radio $R$.

**Sólidos platónicos** (cuando $N \in \{4,6,8,12,20\}$): se usan los vértices
normalizados del tetraedro, octaedro, cubo, icosaedro y dodecaedro.

**Espiral de Fibonacci** (cualquier $N$): distribución casi uniforme mediante el
ángulo áureo $\gamma = \pi(3-\sqrt5)$:

$$
y_i = 1 - \frac{2i+1}{N}, \qquad
r_i = \sqrt{1-y_i^2}, \qquad
\theta_i = \gamma\, i
$$

$$
\mathbf{p}_i = R\,(\,r_i\cos\theta_i,\ y_i,\ r_i\sin\theta_i\,), \qquad i = 0,\dots,N-1
$$

La distancia al vecino más cercano $d_{NN} = \min_{i\neq j}\lVert \mathbf p_i-\mathbf p_j\rVert$
fija el radio visual del anillo de cada bobina ($d_{NN}/2$, los campos cubren su
espacio) y el suavizado $\varepsilon$ del campo.

### 2.2 Pares opuestos (antípodas)

Cada bobina $i$ se empareja con la bobina más cercana a su punto antípoda:

$$
\mathrm{pareja}(i) = \arg\min_{j\neq i}\ \big\lVert \mathbf p_j - (-\mathbf p_i)\big\rVert^2
$$

Las dos bobinas de un par **comparten genes** (amplitud y fase) y por tanto la
misma corriente: se activan siempre juntas. Con $N$ bobinas hay
$n_g=\lceil N/2\rceil$ grupos.

### 2.3 Huecos entre bobinas (envolvente convexa) y láseres

Los láseres se sitúan en el **hueco entre cada trío de bobinas vecinas**. Esos
huecos se obtienen triangulando la esfera de bobinas con su **envolvente
convexa**: un triángulo $(i,j,k)$ es una cara si todos los demás puntos quedan a
un mismo lado de su plano,

$$
\mathbf n = (\mathbf p_j-\mathbf p_i)\times(\mathbf p_k-\mathbf p_i), \qquad
\operatorname{sign}\big(\mathbf n\cdot(\mathbf p_m-\mathbf p_i)\big)\ \text{constante } \forall m\neq i,j,k
$$

El láser de ese hueco se coloca en el **centroide** del triángulo y apunta al
centro:

$$
\mathbf c = \tfrac13(\mathbf p_i+\mathbf p_j+\mathbf p_k), \qquad
\hat{\mathbf d} = -\,\mathbf c/\lVert\mathbf c\rVert
$$

Por la fórmula de Euler, una triangulación de la esfera con $V$ vértices tiene
$2V-4$ caras: $N=12$ (icosaedro) ⇒ **20 huecos** (= vértices del dodecaedro).

---

## 3. Electromagnetismo

### 3.1 Corriente polifásica de las bobinas

El sistema se alimenta como un **sistema polifásico** con desfase de **60°**: una
frecuencia común $f$ y la fase de cada grupo $g$ avanza $\varphi_g = g\cdot 60° = g\,\pi/3$.
Además hay un control **proporcional-derivativo** (PD) automático que reacciona a
la deriva radial de la nube. La corriente de una bobina del grupo $g$ es:

$$
\boxed{\;I_g(t) = A_g \sin\!\big(2\pi f\, t + \varphi_g\big) \;+\; k_p\,\bar r(t) \;+\; k_d\,\dot{\bar r}(t)\;}
$$

donde:

- $A_g$ — amplitud del grupo (gen del AG),
- $f$ — frecuencia común (gen del AG); **la frecuencia modula la dirección** del giro del campo,
- $\varphi_g = g\,\pi/3$ — **desfase polifásico fijo de 60°** (no se evoluciona),
- $\bar r(t)$ — radio medio de las partículas vivas, $\dot{\bar r}$ su derivada,
- $k_p,\,k_d$ — ganancias PD (genes del AG): aumentan el empuje hacia adentro cuando la nube se aleja.

El término oscilante crea un **pseudopotencial de confinamiento** análogo al de
una trampa de iones de Paul (RF).

### 3.2 Campo magnético: superposición de dipolos

Cada bobina se modela como un **dipolo magnético puntual** situado en $\mathbf p_i$,
con momento orientado radialmente hacia el centro,
$\hat{\mathbf m}_i = -\mathbf p_i/\lVert\mathbf p_i\rVert$, y magnitud proporcional a su
corriente $I_i(t)$. El campo total en un punto $\mathbf r$ es la suma:

$$
\boxed{\;
\mathbf B(\mathbf r,t) = \kappa \sum_{i=1}^{N} I_i(t)\,
\frac{3(\hat{\mathbf m}_i\cdot \hat{\mathbf d}_i)\,\hat{\mathbf d}_i - \hat{\mathbf m}_i}
{\big(\lVert \mathbf d_i\rVert^2 + \varepsilon^2\big)^{3/2}}
\;}
$$

con $\mathbf d_i = \mathbf r - \mathbf p_i$, $\hat{\mathbf d}_i = \mathbf d_i/\lVert\mathbf d_i\rVert$.
El término $\varepsilon^2$ es un **suavizado** que evita la singularidad $1/r^3$ al
acercarse a una bobina y hace que los campos cubran su espacio. $\kappa$ agrupa la
constante física $\mu_0/4\pi$ y los factores de escala.

> Esta es la forma estándar del campo de un dipolo magnético; ver
> [Griffiths, *Introduction to Electrodynamics*]. La aproximación dipolar es
> válida lejos de la bobina; cerca del bobinado real el campo es distinto.

### 3.3 Fuerza de Lorentz

Sobre cada electrón (sin campo eléctrico en el modelo) actúa solo la fuerza
magnética:

$$
\boxed{\;\mathbf F = q\,\mathbf v \times \mathbf B \;}
\qquad\Rightarrow\qquad
m\,\frac{d\mathbf v}{dt} = q\,\mathbf v\times\mathbf B
$$

Propiedad clave: la fuerza magnética **no realiza trabajo**
($\mathbf F\cdot\mathbf v = 0$), por lo que **conserva la rapidez** $\lVert\mathbf v\rVert$.
El campo solo **curva** la trayectoria; la única forma de cambiar la energía
cinética es mediante los láseres (§5.2). Confinar = curvar las trayectorias en
órbitas cerradas dentro de la esfera.

---

## 4. Integración numérica (empuje de Boris)

Para integrar $\dot{\mathbf v} = (q/m)\,\mathbf v\times\mathbf B$ se usa el
**algoritmo de Boris**, el método estándar para partículas cargadas: es de
segundo orden, simpléctico en la práctica y, sin campo eléctrico, es una
**rotación pura** que conserva exactamente $\lVert\mathbf v\rVert$.

Dado $\mathbf v^{n}$, $\mathbf B$ y $\Delta t$:

$$
\mathbf t = \frac{q}{m}\,\mathbf B\,\frac{\Delta t}{2}, \qquad
\mathbf s = \frac{2\,\mathbf t}{1+\lVert\mathbf t\rVert^2}
$$

$$
\mathbf v' = \mathbf v^{n} + \mathbf v^{n}\times \mathbf t, \qquad
\mathbf v^{n+1} = \mathbf v^{n} + \mathbf v'\times \mathbf s
$$

$$
\mathbf x^{n+1} = \mathbf x^{n} + \mathbf v^{n+1}\,\Delta t
$$

Un electrón se considera **perdido** cuando $\lVert\mathbf x\rVert \ge R$ (toca la
frontera). En modo "en vivo" se recicla desde un cañón; en la evaluación del AG
se cuenta como pérdida.

> Referencia: Boris (1970); Birdsall & Langdon, *Plasma Physics via Computer
> Simulation*.

---

## 5. Inyección de energía: cañones y láseres

### 5.1 Cañones de electrones e inyección acumulativa

Hay **un cañón en el centro de cada bobina**. Cada electrón se inyecta desde
$\mathbf p_i\cdot 0.96$ hacia el centro con una pequeña dispersión tangencial y
rapidez inicial $v_0$. La rapidez se deriva de la **potencia del cañón** $P_c$
(en kW), suponiendo energía cinética proporcional a la potencia del haz:

$$
v_0 = v_{\text{ref}}\sqrt{\frac{P_c}{P_{\text{ref}}}}, \qquad
v_{\text{ref}}=0.6,\quad P_{\text{ref}} = 2\ \text{kW}
$$

**Modelo acumulativo (generación de plasma).** La cámara **arranca vacía**. En
cada paso los cañones inyectan partículas nuevas a una **tasa $\lambda$**
(part/s); la acumulación es **ilimitada** (sin tope fijo, salvo un límite de
seguridad de memoria):

$$
\text{inyectar } \big\lfloor a \big\rfloor \text{ partículas}, \qquad
a \mathrel{+}= \lambda\,\Delta t \ \text{(acumulador)}
$$

Las partículas que escapan ($r\ge R$) se **eliminan para siempre** (no se
reciclan; el almacenamiento es un array compacto con *swap-remove*). El número de
partículas vivas $N_{\text{viva}}(t)$ **crece si el confinamiento las retiene** y
se estabiliza en un **equilibrio** donde la tasa de escape iguala a $\lambda$: es
una medida directa de cuánto plasma logra acumular el controlador.

### 5.2 Láseres (calentamiento del plasma)

Cada láser es un rayo desde su hueco $\mathbf o$ con dirección $\hat{\mathbf d}$
(hacia el centro). Un electrón en $\mathbf p$ recibe energía si está **dentro del
haz** y por delante del emisor. Con $\mathbf w = \mathbf p-\mathbf o$:

$$
s_\parallel = \mathbf w\cdot\hat{\mathbf d}, \qquad
d_\perp^2 = \lVert\mathbf w\rVert^2 - s_\parallel^2
$$

$$
\text{impacta} \iff s_\parallel > 0 \ \wedge\ d_\perp^2 < r_{\text{haz}}^2
$$

Si impacta, **aumenta su rapidez** (calienta) por cada láser **encendido**, con
un tope $v_{\max}=2.6\,v_0$:

$$
\lVert\mathbf v\rVert \leftarrow \min\!\big(v_{\max},\ \lVert\mathbf v\rVert + P_L\,\Delta t\big)
$$

donde $P_L$ se deriva de la potencia en vatios (referencia 5 W). Como el campo
magnético no aporta energía, **los láseres son la única fuente de energía** del
plasma (y dificultan el confinamiento: hay que contener partículas más rápidas).

**Encendido/apagado por el AG.** Cada láser $k$ tiene un gen $L_k\in[0,1]$; está
**encendido si $L_k>0.5$**. El algoritmo genético decide qué láseres encender
para estabilizar y distribuir mejor la nube.

---

## 6. Algoritmo genético

### 6.1 Genoma

Un genoma es un vector real de longitud $\lceil N/2\rceil + 3 + n_L$:

$$
\underbrace{f}_{1}\;\Vert\;
\underbrace{A_0,\dots,A_{n_g-1}}_{n_g=\lceil N/2\rceil}\;\Vert\;
\underbrace{k_p,\ k_d}_{2}\;\Vert\;
\underbrace{L_0,\dots,L_{n_L-1}}_{n_L\ \text{láseres}}
$$

con cotas $f\in[0,4]$, $A_g\in[0,3]$, $k_p,k_d\in[-8,8]$, $L_k\in[0,1]$. La fase
de cada grupo es determinista ($g\cdot60°$), **no** se evoluciona.

### 6.2 Función de fitness

Cada genoma se evalúa corriendo un episodio de $T$ pasos con un lote fijo de
electrones. La aptitud combina **contención + estabilidad + distribución**,
penalizando pérdidas:

$$
\boxed{\;\mathcal{F} = \mathcal{S} \;+\; 0.30\,\mathcal{E} \;+\; 0.15\,\mathcal{D}\;}
$$

**Acumulación / retención** (fracción de la capacidad confinada y centrada),
promediada en el tiempo. Premia **acumular y retener** partículas; los escapes
la reducen de forma implícita (bajan $N_{\text{vivas}}$), por lo que no hace
falta un término de penalización aparte:

$$
\mathcal{S} = \frac{1}{T}\sum_{t=1}^{T} \frac{N_{\text{vivas}}(t)}{N_{\text{inyectadas}}(t)}\Big(0.5 + 0.5\,\overline{c}(t)\Big),
\qquad
\overline{c}(t) = \Big\langle 1-\big(r/R\big)^2 \Big\rangle_{\text{vivas}}
$$

(la normalización por las **inyectadas** hace que $\mathcal{S}$ mida la *fracción
retenida*, independiente de cualquier capacidad.)

**Estabilidad** (poca fluctuación temporal del radio medio $\bar r$):

$$
\mathcal{E} = \exp\!\big(-6\,\sigma_t[\bar r]\big)\cdot f_{\text{vivas}},
\qquad
\sigma_t[\bar r] = \sqrt{\langle \bar r^2\rangle_t - \langle \bar r\rangle_t^2}
$$

**Distribución** (grosor radial sano de la nube, centrado en $0.25R$):

$$
\mathcal{D} = \exp\!\left(-\left(\frac{\overline{\sigma_r}-0.25R}{0.22R}\right)^2\right)\cdot f_{\text{vivas}},
\qquad
\sigma_r = \sqrt{\langle r^2\rangle - \langle r\rangle^2}
$$

donde $f_{\text{vivas}}$ es la fracción del episodio con nube viva (evita premiar
nubes que se mueren). El término $\mathcal{E}$ es el que responde a la petición de
una **nube más estable**, y $\mathcal{D}$ a una **mejor distribución**.

### 6.3 Operadores

| Operador | Detalle |
|---|---|
| Selección | Torneo de tamaño 3 |
| Cruce | BLX-α con $\alpha=0.3$ por gen |
| Mutación | Ruido gaussiano (Box–Muller) escalado al rango del gen, prob. configurable |
| Elitismo | Se conserva el 10 % superior |
| Episodio | Misma semilla para todos los genomas de una generación; varía entre generaciones (evita sobreajuste) |

El AG corre en un **Web Worker** para no bloquear la interfaz; el hilo principal
muestra en vivo el mejor genoma encontrado.

---

## 7. Pipeline de simulación

```
config (UI)
  └─► getGeometry(N, R, preset)         [memoizado, 1 vez por configuración]
        • bobinas (Fibonacci / platónico)
        • pares opuestos
        • envolvente convexa ► huecos ► láseres
        • d_NN ► radio de anillo, ε
  └─► GA (Web Worker)
        para cada generación:
          para cada genoma:
            Simulation(config, genoma)   [cámara vacía]
              repetir T pasos:
                I_i(t)  = polifásico + PD            (§3.1)
                B(r,t)  = Σ dipolos                  (§3.2)
                v,x     = empuje de Boris            (§4)
                láseres ► calientan (si ON)          (§5.2)
                escapes ► se eliminan                (§5.1)
                cañones ► inyectan (tasa λ)          (§5.1)
                acumular métricas de fitness         (§6.2)
            fitness ► selección/cruce/mutación       (§6.3)
        postMessage(best genome) ──► hilo principal ──► render 3D (Three.js)
```

---

## 8. Requisitos técnicos para una implementación real

> Esta sección traduce el modelo a los componentes físicos que harían falta. Las
> cifras son **órdenes de magnitud orientativos**; un diseño real exige cálculo
> de ingeniería detallado y revisión por especialistas en física de plasmas y
> seguridad.

### 8.1 Cámara de vacío

- **Geometría**: cámara aproximadamente esférica o poliédrica (un dodecaedro es
  natural para alojar bobinas y diagnósticos en caras/aristas).
- **Vacío**: ultra-alto vacío (UHV), $10^{-8}$–$10^{-10}$ mbar, para que el
  camino libre medio de los electrones supere el tamaño de la cámara (evitar
  colisiones con gas residual).
- **Materiales**: acero inoxidable 316L o aluminio, juntas de cobre (ConFlat),
  bombas turbomoleculares + iónicas.
- **Penetraciones**: bridas para cañones, ventanas ópticas (calidad láser) para
  los haces y para diagnóstico óptico.

### 8.2 Bobinas y sistema de alimentación polifásico

- **Bobinas**: $N$ electroimanes (solenoides cortos o bobinas de Helmholtz
  pequeñas) montados simétricamente. Conductor de cobre o **superconductor**
  (NbTi/Nb₃Sn con criostato) si se requieren campos altos sostenidos.
- **Campo**: del orden de $10^{-2}$–$1\ \text{T}$ según energía de los electrones
  (radio de Larmor $r_L = m v/(qB)$ debe ser ≪ tamaño de la cámara).
- **Alimentación polifásica**: amplificadores/inversores por grupo capaces de
  generar corriente senoidal con **desfase de 60°** programable y **frecuencia
  común** ajustable (típicamente kHz–MHz para una trampa tipo RF). Pares opuestos
  en serie para garantizar corriente idéntica.
- **Refrigeración**: agua desionizada (cobre) o criogenia (superconductor).
- **Control de corriente**: fuentes con realimentación rápida (lazo PD del §3.1)
  alimentadas por la posición/densidad medida (§8.5).

### 8.3 Cañones de electrones

- **Tipo**: cañón termoiónico (cátodo de wolframio/LaB₆) o de emisión de campo,
  con óptica de enfoque electrostática/magnética.
- **Potencia/energía**: referencia 2 kW de potencia de haz; la energía por
  electrón (keV) fija $v_0$. A 2 keV, $v\approx 2.6\times10^7$ m/s (no relativista);
  a energías mayores habría que **incluir correcciones relativistas** (el modelo
  actual no las tiene).
- **Número**: uno por bobina implica decenas de cañones; en la práctica se usarían
  menos cañones pulsados, o inyección por una sola fuente.

### 8.4 Láseres de calentamiento

- **Ubicación**: en los huecos entre bobinas (aristas/vértices del poliedro),
  con ventanas ópticas y alineación hacia el centro.
- **Tipo**: el calentamiento real de plasma por láser usa potencias de **kW–MW**
  (p. ej. láseres de CO₂, Nd:YAG pulsados). Los **5 W** del modelo son
  ilustrativos; sirven para mostrar el mecanismo, no para calentar plasma real.
- **Conmutación on/off**: moduladores/obturadores rápidos (acusto-ópticos)
  controlados por el sistema de control, equivalentes al gen $L_k$.
- **Acoplamiento de energía**: en un plasma real el mecanismo no es "empujar un
  electrón" sino absorción colectiva (bremsstrahlung inverso, resonancias). El
  modelo lo simplifica a un incremento de rapidez por impacto.

### 8.5 Diagnóstico y sensores

> Diferencia clave con el modelo: en la realidad **no se puede seguir cada
> electrón**. Se miden magnitudes colectivas.

- **Densidad**: interferometría de microondas/láser, sondas de Langmuir.
- **Temperatura/energía**: dispersión de Thomson, analizadores de energía.
- **Distribución espacial**: cámaras rápidas, tomografía de emisión, detectores
  de rayos X/bremsstrahlung.
- **Posición/estabilidad de la nube**: bobinas de pickup, electrodos de imagen
  (como en trampas de Penning–Malmberg).

### 8.6 Control en tiempo real

- **Lazo de control**: el equivalente al AG + control PD. En operación real, el
  AG se usaría **fuera de línea** para encontrar buenos parámetros; en línea
  correría un controlador rápido (PID/MPC/RL) sobre **FPGA o DSP** con latencias
  de µs.
- **Entradas**: señales de diagnóstico (§8.5). **Salidas**: amplitud/frecuencia
  de cada grupo de bobinas y on/off de cada láser.
- **Sincronización**: reloj común para mantener el desfase polifásico de 60°.

### 8.7 Seguridad

- **Alto voltaje** (cañones), **campos magnéticos intensos**, **radiación**
  (rayos X por bremsstrahlung de electrones energéticos), **láseres de clase 4**,
  **criogenia** y **vacío** (implosión). Requiere apantallamiento, enclavamientos
  (interlocks), zonas controladas y cumplimiento normativo.

### 8.8 Comparación con dispositivos reales

| Dispositivo | Principio de confinamiento | Relación con este modelo |
|---|---|---|
| Trampa de Paul (RF) | Campo **eléctrico** oscilante (pseudopotencial) | Análogo conceptual del término oscilante, pero aquí es **magnético** |
| Trampa de Penning–Malmberg | Campo magnético axial + electrostático | El más parecido para confinar electrones/no-neutros |
| Espejo magnético / cúspide | Gradientes de $B$ (espejo) | Mecanismo físico distinto al dipolar rotatorio |
| Tokamak / Stellarator | Campo toroidal + poloidal | Plasmas de fusión; complejidad mucho mayor |

El esquema de **dipolos rotatorios polifásicos** del simulador es una
construcción didáctica; no corresponde exactamente a ningún dispositivo estándar.

---

## 9. Limitaciones y simplificaciones del modelo

Qué es razonable y qué **no** está modelado:

- ✅ Fuerza de Lorentz e integración de Boris: correctas y estándar.
- ✅ Campo dipolar y superposición: forma correcta (lejos de las bobinas).
- ✅ Conservación de la rapidez bajo campo magnético: física correcta.
- ⚠️ **Bobinas como dipolos puntuales**: una bobina real tiene campo de espira
  (no dipolar cerca), con su propia geometría.
- ❌ **Sin colisiones** entre partículas ni con gas residual.
- ❌ **Sin autocampos del plasma** (carga espacial, corrientes inducidas): a
  densidades reales el plasma modifica el campo (no es plasma "real" hasta que
  hay efectos colectivos).
- ❌ **Sin campo eléctrico** ni efectos de radiación (los electrones acelerados
  radian; aquí no).
- ❌ **No relativista**: a energías de keV altos haría falta corrección.
- ⚠️ **Calentamiento por láser** modelado como impulso de rapidez por impacto, no
  como absorción colectiva real.
- ⚠️ **Unidades normalizadas**: para predicciones cuantitativas hay que fijar las
  escalas físicas (§1, §8).

En resumen: es una excelente herramienta para **entender e visualizar** ideas de
confinamiento magnético y optimización por algoritmos genéticos, pero **no** para
diseñar un confinamiento real sin un modelo de plasma completo.

---

## 10. Referencias

- D. J. Griffiths, *Introduction to Electrodynamics* — campo de dipolo magnético, fuerza de Lorentz.
- J. P. Boris, "Relativistic plasma simulation", *Proc. 4th Conf. on Numerical Simulation of Plasmas* (1970) — empuje de Boris.
- C. K. Birdsall, A. B. Langdon, *Plasma Physics via Computer Simulation* — integradores de partículas (PIC).
- W. Paul, "Electromagnetic traps for charged and neutral particles", *Rev. Mod. Phys.* 62 (1990) — trampas RF.
- J. H. Malmberg, J. S. deGrassie — trampas de Penning–Malmberg para plasmas no neutros.
- D. E. Goldberg, *Genetic Algorithms in Search, Optimization, and Machine Learning* — AG, BLX-α, torneo.
- González-Hernández et al., "Fibonacci grids" — distribución casi uniforme en la esfera.
```
