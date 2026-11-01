# Proyecto-ING_ECO2026_3

Simulador académico de créditos e ingeniería económica en pesos colombianos (COP). El diseño técnico está en `PROPUESTA_NUEVO_PROYECTO.md`.

- Calcula en el navegador con precisión decimal de 34 dígitos (decimal.js).
- Modo invitado sin registro: calcula y exporta reportes sin guardar nada.
- Registro con correo, contraseña, código de verificación y aceptación de la política de datos (HU-01). Inicio y cierre de sesión (HU-02) y recuperación de contraseña con código al correo (HU-03).
- Simulador de créditos (HU-07 a HU-10): tasas nominales vencidas, anticipadas y efectivas con su EA y tasa periódica, y tabla Francés o Alemán.
- Perfil, consentimientos y (más adelante) simulaciones se guardan en Neon (PostgreSQL con RLS).
- En Neon → Settings → Better Auth deben estar activos "Sign-up with Email", "Verify at Sign-up" y el método "Verification code"; si no, no llegan los códigos.
- Costo $0: Cloudflare Workers (solo archivos estáticos, gratis e ilimitados), GitHub Actions y Neon Free, sin tarjeta.

El avance historia por historia está en `BITACORA_DESARROLLO.md`.

## Historias de usuario realizadas

| HU | Historia | Qué se hizo |
|---|---|---|
| — | Iteración 0: estructura y CI/CD | Proyecto React + TypeScript + Vite, núcleo decimal de 34 dígitos, lectura de números en formato colombiano, cabeceras de seguridad y pipeline que prueba y despliega en Cloudflare solo si todo pasa. |
| HU-01 | Registro con política de datos | Página "Crear cuenta" con nombre, correo y contraseña. Se verifica el correo con un código y se guarda la aceptación de la política de datos (Ley 1581) con versión y fecha. Sin marcar la casilla no se crea la cuenta. |
| HU-02 | Iniciar y cerrar sesión | Página "Iniciar sesión". Con contraseña errada sale "Correo o contraseña incorrectos" sin revelar si el correo existe. Con sesión, la cabecera muestra "Hola, {nombre}", "Mi perfil" y "Cerrar sesión". |
| HU-03 | Recuperar la contraseña | "¿Olvidaste tu contraseña?" envía un código al correo para definir una nueva. Si el código está mal o venció, se puede pedir otro. |
| HU-04 | Perfil | "Mi perfil" guarda nombre, institución, programa, decimales (0 o 2) y días del año (360 o 365). Se carga igual en cualquier equipo, y el simulador usa sola la preferencia de decimales. |
| HU-05 | Descargar mis datos y eliminar mi cuenta | "Descargar mis datos" baja un JSON con cuenta, perfil y consentimientos. "Eliminar mi cuenta" pide la contraseña y borra todo en cascada. |
| HU-06 | Modo invitado | Toda la app funciona sin cuenta y no guarda nada en el navegador (ni `localStorage`, ni `sessionStorage`, ni cookies). |
| HU-07 | Datos del crédito | Monto, número de cuotas (1 a 360) y frecuencia de pago, con el rango permitido visible al salir de cada campo. |
| HU-08 | Tasa nominal o efectiva | Convierte la tasa a efectiva anual (EA) y a la tasa del periodo de pago, y muestra los pasos en "¿Cómo se calculó?". |
| HU-09 | Tasas anticipadas | Acepta tasas nominales anticipadas (por ejemplo, 30 % trimestre anticipado) con el paso i_v = i_a / (1 − i_a), y rechaza j_a/m ≥ 1. |
| HU-10 | Tabla de amortización | Tabla Francés (cuota fija) o Alemán (abono fijo), con la fila 0 del desembolso, interés, abono, saldo y totales. El saldo final siempre es 0. |
| HU-11 | Comparar sistemas | "Comparar sistemas" muestra Francés frente a Alemán para el mismo crédito: cuota inicial, total de intereses, total pagado y cuánto más intereses paga el Francés (Δ). |
| HU-12 | Gracia muerta | De 0 a 60 periodos sin pagar; el interés se suma a la deuda y la cuota se calcula después sobre el saldo mayor. |
| HU-13 | Gracia con pago de intereses | En la gracia solo se paga el interés y el saldo no cambia. La tarjeta "Costo de la gracia" muestra cuántos intereses de más cuesta la gracia muerta. |
| HU-14 | Abono extraordinario | Un abono al final de un periodo que reduce la cuota (mismo plazo) o el plazo (misma cuota). Si supera el saldo del periodo, sale el error y la tabla no cambia. |
| HU-15 | Alerta de usura | Compara la EA del crédito con la usura (1,5 × IBC certificado). Si el dato del mes venció, avisa y deja escribir el IBC a mano. El IBC se actualiza cada mes en `src/core/usura.ts`. |
| HU-16 | ¿Cómo se calculó? | Paneles con cada paso del cálculo de la tasa, la cuota y la usura: la fórmula, la fórmula con los valores del crédito y el resultado. Cada paso se recorre con Tab y lo lee el lector de pantalla. |
| HU-17 | Exportar a PDF y Excel | Botones que descargan la simulación como PDF (pdfmake) y Excel (write-excel-file) reales, generados en el navegador, con los parámetros reales, el perfil en el encabezado y los montos sumables en Excel. Funciona también como invitado. |
| HU-18 | Interés compuesto | Calculadora en `/interes-compuesto` que despeja el valor futuro (S), el valor presente (P), la tasa (i) o los periodos (n). La tasa nominal se convierte con la misma fórmula del simulador. Un resultado fraccionario de n (por ejemplo 35,0028) se muestra así, con explicación. |
| HU-19 | Anualidades | Calculadora en `/anualidades` que, con la cuota A, calcula S y P; o, con una meta S o un valor presente P, calcula la cuota. Muestra los pagos vencidos y anticipados lado a lado. Con tasa 0 da S = P = A · n sin error. |
| HU-20 | Reparto proporcional | Calculadora en `/reparto` que reparte un monto entre 2 y 20 partes de forma directa, inversa o compuesta. Usa el método del mayor residuo, así que la suma de las partes es exactamente el monto. |
| HU-21 | Mis simulaciones | En `/simulaciones`: guardar la simulación (botón "Guardar simulación" bajo la tabla), verla en la lista ordenada por fecha, abrirla (regenera la misma tabla), renombrarla y borrarla con confirmación. Con sesión se guarda en Neon, aislada por usuario con RLS (hasta 50). Como invitado se guarda solo en la memoria de la pestaña. |
| HU-22 | Llevar la simulación a mi cuenta | Si un invitado tiene una simulación abierta y inicia sesión o se registra, se le ofrece "Guardar esta simulación en mi cuenta". Si dice "No guardar", no se guarda nada. |
| HU-23 | Comparar simulaciones | En "Mis simulaciones" se eligen de 2 a 3 y "Comparar seleccionadas" las muestra en columnas: primera cuota, EA, total de intereses, total pagado y ρ (intereses por cada peso prestado). La de menos intereses queda resaltada. El invitado compara las de su sesión. |
| HU-24 | Compartir por enlace | "Copiar enlace" arma una URL con los parámetros en el hash (`#c=…`), que el navegador no envía al servidor. Quien la abra ve la misma tabla sin cuenta. Si el enlace está alterado o fuera de rango, muestra el error y no calcula. |

## 1. Requisitos previos

| Herramienta | Versión | Para qué |
|---|---|---|
| Node.js | 22.12 o superior (CI usa 24) | Ejecutar Vite, Vitest y el build |
| npm | 10 o superior (viene con Node) | Instalar dependencias |
| Git | Cualquiera reciente | Control de versiones |

En Windows, si PowerShell bloquea `npm` ("la ejecución de scripts está deshabilitada"), usa `npm.cmd` en lugar de `npm` (por ejemplo `npm.cmd test`) o abre una terminal `cmd`. No hace falta cambiar la política de ejecución del sistema.

## 2. Instalación de dependencias

```bash
npm ci
```

`npm ci` instala exactamente las versiones de `package-lock.json`. Usa `npm install` solo si vas a agregar o actualizar una dependencia.

## 3. Variables de entorno

Copia `.env.example` como `.env.local` (este archivo no se sube al repositorio).

| Variable | Obligatoria | Desde | Descripción |
|---|---|---|---|
| `VITE_NEON_AUTH_URL` | Para el registro | HU-01 | URL de Managed Better Auth de Neon. Es pública por diseño |
| `VITE_NEON_DATA_API_URL` | Para el registro | HU-01 | URL de la Data API de Neon. Es pública por diseño; RLS protege los datos |

Sin estas dos variables la app funciona en modo invitado y la página de registro dice "El registro no está disponible en este momento". Para probar el registro en `localhost`, agrega `http://localhost:5173` como dominio de confianza en Neon → Auth → Configuration.

Si cambias el proyecto de Neon, actualiza también los dos hosts de `connect-src` en `public/_headers`; la CSP bloquea cualquier otro.

Secretos del pipeline. Se guardan en GitHub → Settings → Environments → **`neon`** → Environment secrets, nunca en el código. Los dos jobs del pipeline declaran `environment: neon` para poder leerlos. Las URL de Neon se aceptan como secreto o como variable.

| Nombre | Tipo | Uso |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | Secret | Desplegar el Worker (token con permiso de cuenta "Workers Scripts: Edit") |
| `CLOUDFLARE_ACCOUNT_ID` | Secret | Cuenta de Cloudflare donde vive el Worker `proyecto-ing-eco2026-3` |
| `NEON_DATABASE_URL` | Secret | Desde HU-01: aplicar migraciones SQL |
| `VITE_NEON_AUTH_URL`, `VITE_NEON_DATA_API_URL` | Variables | Desde HU-01: se inyectan en el build |

## 4. Ejecución local

```bash
npm run dev
```

Abre `http://localhost:5173`.

## 5. Compilación (build)

```bash
npm run build     # verifica tipos y genera dist/
npm run preview   # sirve dist/ en http://localhost:4173
```

## 6. Pruebas

```bash
npm test            # todas las pruebas unitarias una vez
npm run coverage    # pruebas + cobertura; falla si src/core baja de 95 % de líneas
npm run test:watch  # modo observación mientras desarrollas
npm run lint        # reglas de código, incluida la pureza de src/core
npm run typecheck   # verificación de tipos TypeScript
```

## 7. Estado del CI/CD

El pipeline `.github/workflows/ci-cd.yml` corre en cada push y pull request a `main`:

1. Instala dependencias con `npm ci`.
2. Ejecuta lint, verificación de tipos y pruebas con cobertura.
3. Ejecuta `npm audit --audit-level=high`.
4. Genera el build.
5. Si todo pasa y es un push a `main`, publica el `dist/` ya probado en el Worker `proyecto-ing-eco2026-3` con `wrangler deploy` (configuración en `wrangler.jsonc`). La URL es `https://proyecto-ing-eco2026-3.<tu-subdominio>.workers.dev`.

En `develop` y en los pull request el pipeline prueba y construye, pero no despliega. Si faltan los secretos de Cloudflare, el despliegue se omite con un aviso y el pipeline sigue en verde. Dependabot revisa dependencias de npm y de Actions cada semana.

### Migraciones de base de datos

El workflow `.github/workflows/db-migrate.yml` ("Migraciones de base de datos") aplica en orden los archivos de `db/migrations/` con `psql`, usando el secreto `NEON_DATABASE_URL`. Se ejecuta a mano: GitHub → Actions → "Migraciones de base de datos" → Run workflow. Los archivos son idempotentes, así que repetirlo no hace daño. Después de cada migración, en Neon → Data API, pulsa "Refresh schema cache".

| Archivo | Historia | Qué crea |
|---|---|---|
| `001_consentimiento.sql` | HU-01 | Tabla `consentimiento` con RLS: cada usuario solo lee e inserta sus filas, y nadie las modifica |
| `002_perfil_y_eliminar_cuenta.sql` | HU-04, HU-05 | Tabla `perfil` con RLS y la función `eliminar_mi_cuenta()`, que borra solo la cuenta de quien la llama |
| `003_simulaciones.sql` | HU-21 | Tabla `simulacion` (nombre y parámetros del crédito) con RLS por usuario y un tope de 50 por usuario con un trigger |
| `004_limite_global.sql` | HU-21 | Reemplaza el trigger para agregar un tope global de 50.000 simulaciones guardadas (ver "Límites del plan gratuito de Neon") |

### Límites del plan gratuito de Neon

El plan gratuito de Neon da, por proyecto y según [su documentación](https://neon.com/faqs/free-plan-limits-and-quotas), 1 GB de almacenamiento, 100 CU-horas de cómputo al mes y 5 GB de transferencia. Auth cubre hasta 60.000 usuarios activos al mes. Amortiza está hecha para no pasar de ahí nunca:

| Qué podría crecer | Cómo se evita |
|---|---|
| Datos de invitados | No se guardan en Neon. Viven en la memoria de la pestaña y se borran al cerrarla o a las 24 horas de su última modificación. Los PDF y Excel se generan en el navegador y tampoco se guardan. |
| Simulaciones de usuarios registrados | Cada una pesa como máximo ~2,5 KB (parámetros de hasta 2.000 caracteres). Tope de 50 por usuario y de 50.000 en total (máx. ~125 MB, una octava parte del GB gratuito). Lo aplican triggers de la base de datos, no solo la app. |
| Cuentas de relleno o abandonadas | Cada día se borran las cuentas sin verificar con más de 2 días, y las sesiones y códigos vencidos. |
| Cómputo | La app no consulta la base de forma periódica: solo al iniciar sesión y al guardar, abrir, renombrar o borrar. Neon suspende el cómputo solo cuando no hay actividad. La limpieza diaria lo despierta un minuto. |
| Un crecimiento que no previmos | El mismo workflow mide el almacenamiento: avisa al llegar a 500 MB y falla al llegar a 800 MB, y GitHub envía un correo. |

La limpieza es el workflow `.github/workflows/db-limpieza.yml` ("Limpieza diaria de la base de datos"), que corre solo a las 03:17 hora de Colombia, usa el mismo secreto `NEON_DATABASE_URL` y ejecuta `db/mantenimiento/limpieza_diaria.sql`. También se puede lanzar a mano desde Actions. Los workflows programados corren solo desde la rama `main`, y GitHub los pausa si el repositorio pasa 60 días sin actividad: en ese caso, entra a Actions y reactívalo.

El Worker no debe tener conectada la integración Git de Cloudflare (Settings → Build): esa integración publica sin correr las pruebas. Solo despliega GitHub Actions.

## Estructura

```
src/core/        Motor financiero y reglas de validación puras (sin UI, red ni almacenamiento)
src/adapters/    Conexión con servicios externos (auth/: cuentas con Neon)
src/ui/          Componentes React, páginas, enrutador y estilos
db/migrations/   SQL de la base de datos en Neon (tablas y políticas RLS)
db/mantenimiento/ SQL de la limpieza diaria de la base de datos
tests/unit/      Pruebas unitarias (Vitest)
public/_headers  Cabeceras de seguridad (Cloudflare las aplica a los archivos estáticos)
wrangler.jsonc   Configuración del Worker que sirve dist/
.github/         CI/CD y Dependabot
```
