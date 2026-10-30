# Propuesta técnica: Amortiza

Fecha de referencia: octubre de 2026. Fuente funcional: `PROJECT_SPEC.md`, más los requisitos que agregó el usuario el 29-oct-2026 (modo invitado, registro, login y perfil). Las citas al spec se escriben "sección X del spec". Todo dato marcado `(verificar)` no se pudo confirmar en una fuente oficial y tiene un plan B ya decidido.

## 0. Supuestos y puntos abiertos

- El código fuente de EconomicApp no está en el repositorio. El análisis se basa solo en el spec (secciones 3, 4, 9, 10 y 15 del spec).
- El `Plazo` (sección 4 del spec) no incluye los periodos de gracia. Plazo total = gracia + plazo de amortización.
- Los métodos 2 y 3 de reparto (sección 10.10 del spec, "no leídos en detalle") se interpretan como reparto **inverso** y **compuesto**. El método 1 es el reparto directo.
- La app tiene **dos modos**:
  - **Invitado:** calcula y exporta reportes sin registro y no guarda nada. Los datos viven solo en la memoria de la pestaña.
  - **Registrado:** registro y login para guardar simulaciones y perfil en la nube.
- Los cálculos siempre corren en el navegador, en ambos modos. El servidor solo guarda y devuelve datos de la cuenta. Los "endpoints REST" del spec (sección 6 del spec) pasan a ser una API de módulo TypeScript más la API de datos de Neon.
- El perfil se limita a nombre para mostrar, institución y programa (estos dos opcionales). No se pide cédula, teléfono, ingresos ni datos sensibles.
- Todos los servicios exigen crear una cuenta gratuita con correo o con GitHub, pero ninguno pide tarjeta (verificado en la sección 4). No existe despliegue público con login que no requiera al menos una cuenta del desarrollador.
- Moneda COP sin centavos visibles. La escala interna de redondeo es configurable (0 o 2 decimales) para contrastar con Excel. La base diaria es 360 días como en el spec (sección 10.5 del spec), configurable a 365 sin cambiar fórmulas.

## 1. Stack tecnológico

Versiones consultadas el 29-oct-2026 en `registry.npmjs.org/<paquete>/latest`.

| Capa | Tecnología | Versión | Alternativa descartada | Justificación (≤12 palabras) |
|---|---|---|---|---|
| Frontend | React + TypeScript + Vite | React 19.3.1 · TypeScript 6.0.x · Vite 8.3.5 | Blazor WebAssembly, Svelte 5 | Un lenguaje, ecosistema enorme, sitio estático sin servidor propio |
| Backend | Sin servidor propio: Neon Data API (compatible con PostgREST) + RLS | Plan Free | Supabase (tarjeta no confirmada), servidor Node propio | API de datos segura sin escribir ni hospedar un backend |
| Base de datos | PostgreSQL en Neon (modo registrado); memoria de la pestaña (modo invitado) | Plan Free | Firebase Firestore (sin decimal exacto), SQLite | `NUMERIC` exacto, RLS por usuario, SQL estándar defendible |
| Autenticación | Neon Managed Better Auth (correo + contraseña, verificación de correo) | Plan Free (hasta 60.000 usuarios activos/mes) | Firebase Auth, Better Auth autohospedado | Hash, sesiones, verificación y recuperación ya resueltos |
| Cliente de datos y auth | `@neondatabase/neon-js` | 0.9.0-beta (Apache-2.0) | — | SDK oficial; plan B estable: `@supabase/postgrest-js` 2.118.0 + `better-auth` 1.7.14 (MIT) |
| Motor decimal | decimal.js | 10.6.0 (MIT) | big.js, dinero.js | Potencias fraccionarias y logaritmos con precisión configurable |
| Validación | Zod | 4.6.7 (MIT) | Validación manual | Un esquema para formulario y motor, rangos centralizados |
| Exportación PDF | pdfmake | 0.3.13 (MIT) | jsPDF + autotable (plan B) | PDF real con tablas nativas generado en el navegador |
| Exportación Excel | write-excel-file | 4.1.1 (MIT) | exceljs 4.4.0 (sin publicar desde oct-2023), SheetJS CE (plan B) | XLSX real con formatos numéricos, mantenido, una dependencia |
| Gráficos | Chart.js | 4.6.1 (MIT) | Recharts | Canvas exportable como imagen al PDF |
| Fórmulas en pantalla | KaTeX con salida MathML | 0.19.1 (MIT) | MathJax | Renderiza LaTeX sin estilos inline; compatible con CSP estricta |
| Testing | Vitest + fast-check + Playwright | 5.0.5 (MIT) · 4.10.2 (MIT) · 1.64.1 (Apache-2.0) | Jest | Nativo de Vite; pruebas de propiedades sobre el motor |
| CI/CD | GitHub Actions (CI y despliegue con `wrangler deploy` al Worker `proyecto-ing-eco2026-3` de Cloudflare, solo archivos estáticos) | Node 24 | Integración Git de Cloudflare, Cloudflare Pages, Vercel Hobby, Netlify | Publica solo si las pruebas pasan; cabeceras vía `_headers` |

TypeScript 7.0.2 es la última versión publicada, pero se elige la rama 6.0, que es la que usan como dependencia de desarrollo fast-check, lucide-react y better-auth. Se pasará a la 7 cuando typescript-eslint la soporte (verificar).

### Registro de decisiones (ADR)

| Decisión | Elegido | Alternativas descartadas | Por qué ganó | Qué tendría que cambiar para reconsiderarla |
|---|---|---|---|---|
| ADR-01 Arquitectura | SPA estática que calcula en el navegador + Neon solo para cuentas y persistencia | Servidor propio (hay que hospedarlo y se suspende en planes gratuitos); Blazor Server (original) | El cálculo es determinista y local, así que el modo invitado funciona aunque la base no responda. El servidor no ejecuta lógica financiera | Que se necesite lógica secreta en el servidor (por ejemplo, una API con clave privada) |
| ADR-02 Proveedor de cuentas y datos | Neon Free | Supabase Free (su documentación oficial no dice que el plan Free funcione sin tarjeta y un directorio verificado en agosto de 2026 dice que la pide ([freetier.co](https://freetier.co/directory/products/supabase)); además pausa el proyecto tras 7 días de poca actividad); Firebase Spark (sin tarjeta según [Firebase](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans), pero Firestore no tiene decimal exacto ni SQL) | Sin tarjeta según su [página de precios](https://neon.com/pricing). Trae PostgreSQL con `NUMERIC`, login (Managed Better Auth) y una API de datos con RLS en una sola pieza. Se suspende a los 5 minutos sin uso y despierta solo con la siguiente consulta, sin pausas que haya que reactivar a mano | Que Neon quite el plan Free: se migra a Firebase Spark (plan B, sección 4). El SQL se exporta con `pg_dump` |
| ADR-03 Lenguaje | TypeScript | C# en WASM (QuestPDF no corre en WASM; carga inicial de 2-5 MB); Python con Pyodide | Un solo lenguaje para UI, motor, pruebas y exportación; tipos estáticos para los DTOs | Que el curso exija C#: el motor se portaría a `decimal` de .NET con las mismas pruebas |
| ADR-04 Aritmética | decimal.js, 34 dígitos significativos | `number` (double), big.js (sin `ln` ni potencia fraccionaria), dinero.js (solo dinero) | Cubre $(1+i)^{m_1/m_2}$, $\ln$ y despejes de $i$ y $n$ sin pasar por double | Que JavaScript incorpore un tipo decimal nativo estable (propuesta TC39, verificar) |
| ADR-05 Persistencia por modo | Invitado: estado en memoria (React), sin `localStorage` ni cookies de datos. Registrado: tablas PostgreSQL con RLS | Guardar al invitado en `localStorage` (contradice "no guardar datos") | Cumple el requisito literal: al cerrar la pestaña no queda rastro. Una interfaz `SimulacionRepo` con dos implementaciones evita duplicar la UI | Que se pida un borrador del invitado: se guardaría en `sessionStorage` con aviso |
| ADR-06 Excel | write-excel-file | exceljs (sin publicaciones desde 2023); SheetJS CE | Mantenido en 2026, MIT, una sola dependencia (`fflate`), soporta el formato `#,##0` | Que deje de mantenerse: se cambia el adaptador `export/xlsx.ts` por SheetJS CE |
| ADR-07 Hosting | Cloudflare Pages | Vercel Hobby, Netlify (no verificados); GitHub Pages (plan B) | Sin tarjeta ([UCLA](https://humtech.ucla.edu/web-support/student-site-web-hosting-options/how-to-publish-a-site-with-cloudflare/)), builds desde Git, cabeceras HTTP configurables, sin suspensión de sitios estáticos | Que cambie el plan Free: se pasa a GitHub Pages con el mismo `dist/` |
| ADR-08 Pruebas | Vitest + fast-check | Jest + pruebas solo por ejemplos | Las propiedades (saldo final = 0, Σ abonos = capital) detectan errores de redondeo que los ejemplos no cubren | Ninguna previsible |

**Mayor riesgo de esta decisión.** El SDK oficial `@neondatabase/neon-js` está en beta (0.9.0-beta) y su API puede cambiar. Mitigación:
- La UI no importa el SDK. Solo lo usan `adapters/auth/session.ts` y `adapters/repo/NeonRepo.ts`.
- La Data API es compatible con PostgREST y la autenticación es Better Auth. Si el SDK falla, esos dos archivos pasan a `@supabase/postgrest-js` (MIT, estable) y al cliente de `better-auth` (MIT), contra las mismas URL (verificar la compatibilidad del cliente con Managed Better Auth).
- La versión del SDK se fija exacta en `package.json`, sin `^`.

**Pieza más fácil de reemplazar.** El hosting. El build es una carpeta `dist/` estática y portable entre Cloudflare Pages, GitHub Pages o cualquier CDN, sin cambiar el código. Le sigue la persistencia: el esquema es SQL estándar en `db/migrations/` y la UI solo conoce la interfaz `SimulacionRepo`.

## 2. Arquitectura

Patrón: **núcleo funcional puro + adaptadores** (hexagonal ligera). El motor no sabe que existe React, el DOM ni la red.

```
[UI React: rutas, formularios, tablas, gráficos]  →  [Casos de uso / hooks: orquestan y validan con Zod]
[Casos de uso]  →  [core/finance: funciones puras sobre Decimal]   (sin imports de UI, red ni almacenamiento)
[Casos de uso]  →  [Adaptadores: export (pdfmake, write-excel-file) · repo: GuestRepo (memoria) o NeonRepo · auth]
[NeonRepo / auth]  →  [Neon: Managed Better Auth + Data API + PostgreSQL con RLS]   (solo guarda datos; no calcula)
[GitHub Actions: lint + typecheck + test + build]  →  [Cloudflare Pages: dist/ estático en *.pages.dev]
```

```
interes-claro/
├─ src/
│  ├─ core/                     # Motor financiero PURO. Prohibido importar react, fetch, window o storage (regla ESLint no-restricted-imports)
│  │  ├─ decimal.ts             # Instancia configurada de Decimal (precision 34, ROUND_HALF_UP) y helpers de redondeo
│  │  ├─ rates.ts               # Nominal/efectiva, vencida/anticipada, equivalencias
│  │  ├─ amortization.ts        # Francés, Alemán, filas, totales, cierre exacto
│  │  ├─ grace.ts               # Gracia muerta y con pago de intereses
│  │  ├─ prepayment.ts          # Abono extraordinario: recálculo de cuota o de plazo
│  │  ├─ compound.ts            # Interés compuesto: S, P, i, n
│  │  ├─ annuity.ts             # Anualidades vencidas y anticipadas: S, P, A
│  │  ├─ proportions.ts         # Reparto directo, inverso y compuesto (mayor residuo)
│  │  ├─ usury.ts               # Comparación contra la tasa de usura en EA
│  │  ├─ schemas.ts             # Esquemas Zod (rangos de la sección 10.7 del spec), compartidos con la UI
│  │  └─ index.ts               # API pública del motor (equivale a los servicios y endpoints de la sección 6 del spec)
│  ├─ data/usura.json           # IBC y usura por vigencia, con URL de la fuente SFC
│  ├─ adapters/
│  │  ├─ export/pdf.ts          # Reporte PDF real (parámetros reales, tabla, gráfico)
│  │  ├─ export/xlsx.ts         # Reporte XLSX real con formato COP
│  │  ├─ repo/SimulacionRepo.ts # Interfaz: guardar, listar, obtener, borrar
│  │  ├─ repo/GuestRepo.ts      # Modo invitado: Map en memoria; se pierde al cerrar la pestaña
│  │  ├─ repo/NeonRepo.ts       # Modo registrado: lee NUMERIC como texto (::text) y lo convierte a Decimal
│  │  ├─ auth/session.ts        # Registro, login, logout, recuperación, eliminación de cuenta
│  │  └─ share/url.ts           # Codifica parámetros en el hash (#) de la URL
│  ├─ app/                      # Hooks/casos de uso: useSesion (elige el repo según el modo), useSimulacion, useEscenarios
│  └─ ui/                       # Componentes, rutas, estilos, tokens de diseño
├─ db/migrations/               # SQL versionado: tablas, CHECK, índices, políticas RLS, triggers de auditoría
├─ tests/
│  ├─ unit/                     # Casos de la sección 7.3 contra Excel
│  ├─ property/                 # Propiedades fast-check
│  ├─ rls/                      # Dos usuarios de prueba contra la rama `test` de Neon
│  └─ e2e/                      # Playwright: invitado, registro, simular, exportar, guardar
├─ public/_headers              # CSP, HSTS y demás cabeceras (Cloudflare Pages)
└─ .github/                     # workflows/ci.yml, workflows/usura-recordatorio.yml, dependabot.yml
```

## 3. Base de datos

**¿Se necesita servidor?** Solo para el modo registrado, y solo para guardar.

| Modo | Dónde viven los datos | Qué se conserva al cerrar la pestaña |
|---|---|---|
| Invitado | `GuestRepo`: un `Map` en la memoria de React. No escribe en `localStorage`, `sessionStorage`, IndexedDB ni cookies | Nada. El tema sigue a `prefers-color-scheme` y no se persiste. Un aviso fijo dice "Modo invitado: tus simulaciones no se guardan" |
| Registrado | PostgreSQL en Neon, aislado por usuario con RLS. En el navegador solo queda la sesión que maneja el SDK (verificar si usa cookie o almacenamiento local), que se borra al cerrar sesión | Perfil, simulaciones, escenarios y consentimientos |

En ambos modos los reportes PDF y XLSX se generan en el navegador. El invitado puede descargar todos los que quiera sin crear cuenta.

**Esquema PostgreSQL** (en `db/migrations/`; dinero en `NUMERIC(18,2)`, tasas en `NUMERIC(30,20)`; RLS activado en todas las tablas de `public`; las políticas comparan con `auth.user_id()`, la función que expone Neon):

| Entidad | Campos clave y tipos | Relaciones | Índices y notas |
|---|---|---|---|
| `neon_auth.user` (gestionada por Managed Better Auth) | `id UUID`, `email`, `emailVerified`, fechas | 1:1 `perfil` | No se modifica desde la app. Las contraseñas viven en las tablas de Better Auth, con hash |
| `perfil` | `usuario_id UUID PK FK → neon_auth.user ON DELETE CASCADE` · `nombre_mostrar TEXT CHECK (length ≤ 60)` · `institucion TEXT NULL` · `programa TEXT NULL` · `escala_monetaria SMALLINT CHECK (IN (0,2))` · `base_diaria SMALLINT CHECK (IN (360,365))` · `tema TEXT` · `ibc_manual NUMERIC(30,20) NULL` · `ibc_manual_vigencia DATE NULL` · `created_at`, `updated_at TIMESTAMPTZ` | 1:N `simulacion`, `escenario`, `consentimiento` | Se crea en el primer login. RLS: `usuario_id::text = auth.user_id()` en SELECT, INSERT y UPDATE |
| `simulacion` | `id UUID PK DEFAULT gen_random_uuid()` · `usuario_id UUID FK ON DELETE CASCADE` · `modulo TEXT CHECK (IN ('credito','compuesto','anualidad','reparto'))` · `nombre TEXT ≤ 60` · `parametros JSONB` (montos y tasas como string) · `capital NUMERIC(18,2) CHECK (capital >= 1)` · `plazo SMALLINT CHECK (plazo BETWEEN 1 AND 360)` · `tasa_ea NUMERIC(30,20)` · `cuota`, `total_intereses`, `total_pagado NUMERIC(18,2)` · `motor_version TEXT` (SHA del commit) · `created_at`, `updated_at TIMESTAMPTZ` | N:1 `perfil`; N:M `escenario` | Índice (`usuario_id`, `updated_at DESC`). RLS en las 4 operaciones. La tabla de cuotas no se guarda: se recalcula con `parametros` y `motor_version` (determinista) |
| `escenario` | `id UUID PK` · `usuario_id UUID FK ON DELETE CASCADE` · `nombre TEXT ≤ 40` · `created_at` | N:M vía `escenario_simulacion` (`escenario_id`, `simulacion_id`, PK compuesta; máx. 3 por escenario, controlado con trigger) | RLS por `usuario_id`. Al borrar una simulación se borra su vínculo (CASCADE) |
| `consentimiento` | `id BIGSERIAL` · `usuario_id UUID FK ON DELETE CASCADE` · `version_politica TEXT` · `aceptado_en TIMESTAMPTZ` · `revocado_en TIMESTAMPTZ NULL` | N:1 `perfil` | Prueba del consentimiento (Ley 1581, sección 5). Solo inserción y revocación |
| `audit_log` | `id BIGSERIAL` · `usuario_id UUID` · `entidad TEXT` · `entidad_id UUID` · `accion TEXT CHECK (IN ('crear','editar','borrar'))` · `ocurrido_en TIMESTAMPTZ DEFAULT now()` | — | Lo llenan triggers en `simulacion` y `perfil`. El usuario solo lee lo suyo y nadie lo edita. Se purga a los 12 meses |

**Precisión al leer:** la Data API, como PostgREST, devuelve `NUMERIC` como número JSON, que JavaScript convierte a double. `NeonRepo` pide esas columnas con cast a texto (`select('capital::text, ...')`, verificar el soporte de casts en la Data API de Neon) y las convierte a `Decimal` desde el string.

**Migraciones y pruebas:** los archivos SQL se aplican con `psql` (licencia PostgreSQL) desde un workflow manual de GitHub Actions. La cadena de conexión se guarda como secreto del repositorio y nunca va al frontend. Las pruebas de RLS corren en una rama `test` de Neon (el plan Free trae 10 ramas por proyecto), que copia el esquema sin tocar los datos reales.

**PostgreSQL frente a SQLite:**
- PostgreSQL tiene `NUMERIC` exacto, `CHECK` estrictos, `TIMESTAMPTZ`, `JSONB` y RLS, que es lo que aísla los datos de cada usuario sin escribir un backend. SQLite guarda `NUMERIC` con afinidad REAL o INTEGER y no tiene RLS.
- Con SQLite (por ejemplo Cloudflare D1) habría que escribir y mantener un backend propio para la autorización y el login.

## 4. Despliegue gratuito

Todos los servicios piden una cuenta gratuita (correo o GitHub). Ninguno pide tarjeta: la columna "¿Pide tarjeta?" cita la fuente de cada uno.

| Componente | Servicio | Límites y qué pasa al excederse | ¿Pide tarjeta? (fuente) | URL | Riesgo de inactividad y mitigación | Plan B gratuito |
|---|---|---|---|---|---|---|
| Hosting y CD | Cloudflare Pages (plan Free) | 500 builds/mes, 1 build a la vez, 20 min por build, 20.000 archivos, 25 MiB por archivo, 100 reglas en `_headers` ([límites](https://developers.cloudflare.com/pages/platform/limits/)). Al exceder: el build no corre y el sitio publicado sigue en línea | No ([guía de UCLA](https://humtech.ucla.edu/web-support/student-site-web-hosting-options/how-to-publish-a-site-with-cloudflare/)). No activar Zero Trust/Access, que sí exige tarjeta ([comunidad Cloudflare](https://community.cloudflare.com/t/please-tell-me-how-to-delete-the-payment-information-of-zero-trust-free-plan/381620)) | `https://interes-claro.pages.dev` | Ninguno: los sitios estáticos no se suspenden | GitHub Pages |
| Hosting (plan B) | GitHub Pages | Repo público, sitio ≤1 GB, ~100 GB/mes de ancho de banda (límite blando). Al exceder: HTTP 429 o aviso por correo ([límites](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)) | No (incluido en GitHub Free) | `https://<usuario>.github.io/interes-claro` | Ninguno. No permite cabeceras HTTP propias: la CSP va por `<meta>` (sin `frame-ancestors`). Exige un aviso visible de proyecto educativo | — |
| Cuentas y base de datos | Neon Free (PostgreSQL + Managed Better Auth + Data API) | 100 proyectos, 100 CU-horas/proyecto/mes, 1 GB de almacenamiento por proyecto, 5 GB/mes de transferencia, hasta 60.000 usuarios activos/mes. Al exceder la CU o la transferencia, el cómputo se suspende hasta el mes siguiente; al exceder el almacenamiento, fallan las escrituras. No se borran datos ni se cobra ([planes](https://neon.com/docs/introduction/plans)) | No: "no credit card required" ([precios](https://neon.com/pricing)) | `https://<endpoint>.apirest.<región>.aws.neon.tech` y `https://<endpoint>.neonauth.<región>.aws.neon.tech` | Se suspende a los 5 minutos sin consultas y despierta sola con la siguiente; no hay pausa que reactivar a mano. La primera consulta tras la suspensión tarda más (unos cientos de ms, verificar). Mitigación: precargar la sesión al abrir la app. Aceptable para la demo | Firebase Spark (Auth + Firestore; montos como string): "no se requiere información de pago" ([Firebase](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans)) |
| Correos de verificación y recuperación | Correo integrado de Managed Better Auth (`auth@mail.myneon.app`) | Neon lo recomienda para desarrollo y pruebas; los límites de envío no están publicados (verificar) ([checklist](https://neon.com/docs/auth/production-checklist)) | No (incluido en Neon Free) | — | Ninguno | Brevo Free como SMTP propio: 300 correos/día, "no credit card" ([Brevo](https://www.brevo.com/free-smtp-server/)); verificar que el plan Free de Neon permita SMTP propio |
| CI | GitHub Actions | Gratis para repos públicos con runners estándar ([docs](https://docs.github.com/en/actions/concepts/billing-and-usage)). El repo debe ser público: en repos privados el exceso se factura | No | — | Los workflows programados (solo el recordatorio de usura) se desactivan tras 60 días sin actividad en el repo (verificar); GitHub avisa por correo y se reactivan con un clic | `npm test` local antes del merge |
| Repositorio y Dependabot | GitHub Free | Repos públicos ilimitados. GitHub se puede usar sin costo ([cómo funciona la facturación](https://docs.github.com/en/billing/get-started/how-billing-works)) | No (registro con usuario y correo) | `github.com/<usuario>/interes-claro` | Ninguno | GitLab Free |
| Dato de usura | Publicación mensual de la SFC, copiada a `data/usura.json` | No hay API: se transcribe por PR | No (sitio público, sin cuenta) | superfinanciera.gov.co | Si nadie actualiza: la UI marca el dato vencido y pide el valor manual (sección 7.4) | Valor manual con vigencia |

**Combinación elegida:** GitHub (repo + Actions + Dependabot), Cloudflare Pages (sitio) y Neon (cuentas y datos).
- Son tres proveedores, todos sin tarjeta según su fuente y con registro por correo o GitHub.
- Ninguno necesita keep-alive: el sitio es estático y Neon despierta solo.
- El despliegue lo hace GitHub Actions (`.github/workflows/ci-cd.yml`) con `wrangler deploy` al Worker `proyecto-ing-eco2026-3` (configuración en `wrangler.jsonc`), y solo después de que pasan lint, tipos, pruebas, auditoría y build. Se usa un Worker con archivos estáticos en lugar de Pages porque es el proyecto que se creó en la cuenta; las solicitudes a archivos estáticos son gratis e ilimitadas ([precios de Workers](https://developers.cloudflare.com/workers/platform/pricing/)) y `_headers` funciona igual ([docs](https://developers.cloudflare.com/workers/static-assets/headers/)). No se usa la integración Git de Cloudflare porque esa publica aunque las pruebas fallen.
- Las URL de vista previa y la de producción se registran como dominios de confianza en Managed Better Auth, que solo redirige a dominios de confianza.

## 5. Seguridad y normativa

Con registro hay datos personales (correo y nombre), así que esta sección cubre lo mínimo obligatorio. El modo invitado no trata datos personales.

- **Ley 1581 de 2012** (aplica solo al modo registrado):
  - **Minimización:** correo, contraseña (gestionada por Managed Better Auth) y perfil con nombre para mostrar, institución y programa opcionales. No se piden documento, teléfono, ingresos ni datos sensibles.
  - **Finalidad declarada:** guardar simulaciones y perfil para uso académico. Sin publicidad, perfilamiento, cesión a terceros ni analítica de terceros.
  - **Consentimiento previo, expreso e informado:** casilla sin marcar en el registro con enlace a `/politica-de-datos`. Se guarda versión y fecha en `consentimiento`. Si la política cambia, se pide aceptarla de nuevo.
  - **Política de tratamiento** publicada con responsable (equipo del proyecto y correo de contacto), finalidad, derechos del titular y procedimiento de consultas y reclamos (verificar plazos en el Decreto 1377 de 2013).
  - **Derechos del titular en la propia app:** ver y editar el perfil, descargar todos sus datos en JSON y "Eliminar mi cuenta", que borra en cascada perfil, simulaciones y escenarios (verificar que Managed Better Auth permita borrar el usuario desde el cliente; si no, se hace con una función SQL `SECURITY DEFINER` limitada al propio usuario).
  - **Transferencia internacional:** Neon corre en regiones de AWS fuera de Colombia. Se elige la región más cercana que ofrezca Managed Better Auth (verificar disponibilidad de São Paulo) y se informa en la política.
- **Autenticación:** contraseñas con hash (Better Auth usa scrypt por defecto, verificar en la versión administrada), verificación de correo obligatoria y mensajes de error genéricos ("correo o contraseña incorrectos") para no revelar qué cuentas existen. Better Auth trae límite de intentos (verificar en la versión administrada).
- **Autorización:** RLS en todas las tablas, con políticas por `auth.user_id()`. La cadena de conexión de la base solo vive en los secretos de GitHub. CI prueba con dos usuarios que A no puede leer, editar ni borrar datos de B.
- **Cabeceras** (`public/_headers`):
  - `Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' https://*.apirest.<región>.aws.neon.tech https://*.neonauth.<región>.aws.neon.tech; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'`. Las fuentes van en el bundle y KaTeX usa salida MathML para no necesitar `'unsafe-inline'`.
  - `Strict-Transport-Security: max-age=31536000; includeSubDomains` · `X-Frame-Options: DENY` · `Referrer-Policy: strict-origin-when-cross-origin` · `X-Content-Type-Options: nosniff` · `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- **Validación de entradas:**
  - Cliente: Zod con mensajes en español. Los números se parsean como string `es-CO` → `Decimal`, nunca con `parseFloat`.
  - Motor: repite las aserciones en cada llamada, porque es su frontera de confianza.
  - Servidor: `CHECK` de PostgreSQL con los mismos rangos del spec y longitudes máximas en los textos.
  - Los parámetros de una URL compartida pasan por el mismo esquema y se descartan si no son válidos. El texto del usuario se muestra siempre escapado por React.
- **Cadena de suministro:** `package-lock.json` versionado y `npm ci` en CI; Dependabot semanal para npm y Actions; `npm audit --audit-level=high` bloquea el merge; Actions fijadas por SHA; sin `dangerouslySetInnerHTML` salvo la salida de KaTeX, que se genera a partir de cadenas propias.

## 6. UI/UX 2026 (propuesta nueva)

**Tendencias y decisiones concretas**

| Tendencia | Decisión de diseño |
|---|---|
| Explicabilidad ("muestra tu trabajo") | Cada resultado tiene "¿Cómo se calculó?". Abre la fórmula en LaTeX con los valores del usuario sustituidos y el paso intermedio (por ejemplo, $EA \rightarrow i_p$) |
| Bento grid de resultados | El resumen es una cuadrícula de bloques de tamaños distintos: cuota (bloque grande), EA, total de intereses, total pagado y estado frente a la usura. En móvil se apila en una columna |
| Divulgación progresiva | El formulario muestra monto, plazo y tasa. Gracia, tasa anticipada y abonos están en "Opciones avanzadas", y cada paso se valida al instante |
| Tipografía de datos y tema según el sistema | Cifras tabulares (`font-variant-numeric: tabular-nums`) con montos alineados a la derecha. Tema claro/oscuro según `prefers-color-scheme`, con selector manual (persistido solo en el perfil) |

**Paleta** (ratios calculados a mano con la luminancia relativa de WCAG 2.2; AA exige ≥4,5:1 en texto normal y ≥3:1 en componentes; comprobar con una herramienta de contraste antes de publicar):

| Rol | Claro HEX | Ratio sobre fondo / superficie | Oscuro HEX | Ratio sobre fondo / superficie |
|---|---|---|---|---|
| Fondo | `#F6F7F4` | — | `#0E1417` | — |
| Superficie | `#FFFFFF` | — | `#172127` | — |
| Texto | `#14202B` | 15,4 / 16,5 | `#E6EDF0` | 15,7 / 13,8 |
| Texto secundario | `#4B5866` | 6,8 / 7,3 | `#9AA8B0` | 7,6 / 6,7 |
| Acento (marca, foco, enlaces) | `#0A6B63` | 6,0 / 6,4 (texto blanco encima: 6,4) | `#4FD1C1` | 9,9 / 8,7 (texto `#0E1417` encima: 9,9) |
| Éxito | `#1E6B3C` | 6,1 / 6,5 | `#6FD08C` | 9,8 / 8,6 |
| Error | `#B3261E` | 6,1 / 6,5 | `#FF8F85` | 8,4 / 7,4 |
| Advertencia (usura cercana, dato vencido) | `#8A5000` | 6,1 / 6,5 | `#F2BD4B` | 10,7 / 9,5 |

El estado nunca se comunica solo con color: va acompañado de un ícono (lucide-react 1.64.0, ISC) y un texto.

**Tipografía y escala:**
- IBM Plex Sans para la interfaz e IBM Plex Mono para fórmulas y valores en tablas, alojadas en el bundle con `@fontsource/ibm-plex-sans` 5.3.0 (OFL-1.1).
- Escala modular 1,2 con base de 16 px: 13 · 16 · 19 · 23 · 28 · 33 px. Interlineado de 1,5 en el texto y 1,2 en los títulos. Peso de 400 a 600.

**Formato COP y decimales:**
- Montos: `new Intl.NumberFormat('es-CO', {style:'currency', currency:'COP', minimumFractionDigits:0, maximumFractionDigits:0})` produce "$ 916.800". Con `escala_monetaria = 2` muestra 2 decimales.
- Tasas: `Intl.NumberFormat('es-CO', {style:'percent', minimumFractionDigits:4})` produce "1,5000 %". En "¿Cómo se calculó?" se muestran hasta 10 decimales.
- Internamente, montos y tasas usan 34 dígitos significativos (sección 7.2). La UI nunca recalcula a partir del texto ya formateado.
- Entrada: se aceptan "10.000.000", "10000000" y "1,5". El parser convierte a `Decimal` desde un string.

**Accesibilidad** (es parte de la definición de terminado de cada historia, no una historia aparte):
- Navegación completa con teclado, orden de foco lógico, anillo de foco de 3 px en el color de acento y enlace "Saltar al contenido".
- Etiquetas `<label>` visibles. Errores asociados con `aria-describedby` y anunciados con `aria-live="polite"`, sin mover el foco.
- Tabla de amortización con `<caption>`, `<th scope>` y cabecera fija, para que el lector de pantalla anuncie "Periodo 5, Interés, $ 120.300".
- Con `prefers-reduced-motion: reduce` se desactivan las transiciones de gráficos y paneles.
- Diseño móvil primero (360 px), con objetivos táctiles de 44×44 px o más. En móviles la tabla se desplaza horizontalmente y la columna "Periodo" queda fija.

**Estados de la interfaz:**
- Vacío: "Ingresa monto, plazo y tasa para ver tu plan de pagos", con un botón "Cargar ejemplo". En "Mis simulaciones" sin datos: "Aún no guardas simulaciones" y un botón "Nueva simulación".
- Modo: una etiqueta fija en la cabecera indica "Invitado: no se guarda nada" o el nombre del perfil. El invitado ve "Crear cuenta para guardar" junto al botón de exportar, como sugerencia y nunca como bloqueo.
- Carga: esqueleto de la tabla mientras se genera el PDF o el XLSX, o mientras despierta la base. El cálculo tarda menos de 50 ms con 420 filas (verificar con benchmark), así que no lleva spinner.
- Error: un mensaje por campo con la causa y la corrección (por ejemplo, "El abono supera el saldo del periodo 5 ($ 4.120.300)"). Si la base no responde: "No pudimos conectar con tu cuenta; puedes seguir como invitado". Ante un error inesperado aparece una tarjeta con "Copiar detalles" y "Reiniciar".

## 7. Motor de cálculo financiero

Notación común:
- $P$: capital.
- $i$: tasa efectiva del periodo de pago, en decimal.
- $n$: número de cuotas.
- $k$: índice del periodo.
- $S_k$: saldo al cierre del periodo $k$.
- $I_k$: interés del periodo.
- $A_k$: abono a capital.
- $R$: cuota.
- $m$: periodos por año (enum `Frecuencia`, sección 4 del spec).
- $E$: abono extraordinario.

Todas las operaciones usan `Decimal` y ninguna pasa por `number`.

### 7.1 Cálculos

| Cálculo | Fórmula | Qué calcula exactamente | Para qué sirve y por qué esta fórmula | Mejora técnica propuesta | Caso límite que rompe la fórmula |
|---|---|---|---|---|---|
| Nominal vencida → EA | $EA=\left(1+\frac{j}{m}\right)^{m}-1$; $j$: nominal anual vencida, $m$: capitalizaciones por año | Tasa efectiva anual equivalente a $j$ capitalizada $m$ veces | Es la forma de comparar créditos en Colombia (se pactan en EA). Es compuesta porque el interés genera interés; usar $\frac{j}{m}$ como tasa simple era el error de las secciones 10.1 y 15 del spec | Una sola función `nominalToEA` para todos los módulos (corrige la inconsistencia del spec). `Decimal.pow` con exponente entero es multiplicación exacta | $\frac{j}{m}\le -1$ (base no positiva) |
| Nominal anticipada → EA | $EA=\left(1-\frac{j_a}{m}\right)^{-m}-1$; $j_a$: nominal anual anticipada | EA cuando el interés se cobra al inicio de cada periodo | Muchos créditos de libranza y descuentos se cotizan "TA/MA". Se deriva de $i_v=\frac{i_a}{1-i_a}$ elevado a $m$ | Mejora: el spec no soporta tasas anticipadas | $\frac{j_a}{m}\ge 1$ (se cobraría todo el capital por adelantado); se rechaza en validación |
| Periódica anticipada ↔ vencida | $i_v=\frac{i_a}{1-i_a}$ ; $i_a=\frac{i_v}{1+i_v}$ | Convierte la tasa de un periodo entre las modalidades anticipada y vencida | Cobrar $i_a$ al inicio equivale a pagar $i_v$ al final sobre el capital neto recibido $(1-i_a)$ | Función separada y probada ida y vuelta | $i_a = 1$ (división por cero); $i_v=-1$ |
| EA → nominal | $j=m\left[(1+EA)^{\frac{1}{m}}-1\right]$ | Nominal anual con capitalización $m$ equivalente a una EA | Para reportar la tasa en el formato de los extractos ("NMV") | Exponente fraccionario con `Decimal.pow` (internamente $e^{y\ln x}$ a 34 dígitos), no `Math.pow` | $EA\le -1$ |
| Equivalencia entre frecuencias | $i_2=(1+i_1)^{\frac{m_1}{m_2}}-1$; $m_1$: periodos/año de origen, $m_2$: de destino | Tasa efectiva del periodo destino equivalente a la del periodo origen | Mantiene el mismo valor futuro en un año: $(1+i_1)^{m_1}=(1+i_2)^{m_2}$. Es la fórmula de la sección 10.1 del spec | El exponente se forma como `Decimal(m1).div(m2)`. Si $m_1=m_2$ devuelve $i_1$ sin operar | $i_1\le -1$ |
| EA → periódica | $i_p=(1+EA)^{\frac{1}{m_p}}-1$; $m_p$: pagos por año | Tasa del periodo de pago que usa la tabla | Es el caso $m_1=1$ de la equivalencia. Se muestra antes de generar la tabla (Anexo del spec) | La tasa periódica nunca se redondea: se guarda con 34 dígitos y se muestra con 4 a 10 | Igual que la equivalencia |
| Interés del periodo | $I_k=S_{k-1}\cdot i$ | Interés causado en el periodo $k$ sobre el saldo inicial | Interés vencido sobre saldos, no sobre el capital original | Se redondea a la escala monetaria en cada fila, como en un extracto bancario (sección 7.2) | $S_{k-1}<0$: imposible por invariante |
| Cuota Francés | $R=\frac{P\,i}{1-(1+i)^{-n}}$; si $i=0$: $R=\frac{P}{n}$ | Cuota constante que liquida $P$ en $n$ periodos | Iguala $P$ al valor presente de una anualidad vencida. Es la forma estable de $\frac{P\,i(1+i)^n}{(1+i)^n-1}$: evita restar números casi iguales cuando $i$ es pequeño | Cálculo exacto a 34 dígitos y un solo redondeo de $R$. El caso $i=0$ es una rama explícita | $i=0$ (división 0/0, resuelta por la rama); $n=0$ (rechazado por el esquema) |
| Abono a capital (Francés) | $A_k=R-I_k$ ; $S_k=S_{k-1}-A_k$ | Parte de la cuota que reduce la deuda | Con cuota fija, $A_k$ crece en progresión geométrica de razón $(1+i)$ | En la última fila $A_n=S_{n-1}$ y $R_n=S_{n-1}+I_n$: el saldo cierra en 0 exacto (residuo absorbido) | $R\le I_1$ sería amortización negativa; se valida tras un abono |
| Sistema Alemán | $A=\frac{P}{n}$ ; $R_k=A+S_{k-1}\,i$ | Abono constante y cuota decreciente | Paga menos interés total que el Francés: $\sum I_k=P\,i\,\frac{n+1}{2}$. Es la base de la comparativa (HU-11) | $A$ se redondea una vez; la diferencia de redondeo la absorbe la última fila | Ninguno con $n\ge 1$; con $i=0$, $R_k=A$ |
| Gracia muerta | $S_k=S_{k-1}(1+i)$, $R_k=0$, $k=1..g$ ⇒ $S_g=P(1+i)^g$ | Saldo capitalizado al terminar $g$ periodos sin pagos | Replica la sección 10.4 del spec. Muestra el costo de diferir: el interés se convierte en capital | El interés de cada fila de gracia se redondea igual que en las demás filas, así que tabla y total cuadran. El saldo puede crecer (se excluye de la propiedad de monotonía) | $g>60$ (rango del spec); $g$ igual al plazo total (no queda amortización) |
| Gracia con pago de intereses | $R_k=I_k=P\,i$, $A_k=0$, $k=1..g$ ⇒ $S_g=P$ | Cuotas de solo interés durante la gracia | Es la otra modalidad común (crédito educativo, vivienda en construcción). El saldo no crece | Mejora: el spec solo tiene gracia muerta (sección 15 del spec). El tipo de gracia es un parámetro | Ninguno adicional |
| Abono extraordinario con recálculo de cuota | $S'_k=S_k-E$ ; Francés: $R'=\frac{S'_k\,i}{1-(1+i)^{-(n-k)}}$ ; Alemán: $A'=\frac{S'_k}{n-k}$ | Nueva cuota con el plazo restante intacto | Modo `RecalcularCuota` (sección 9 del spec). Se reaplica la misma fórmula al saldo reducido, sin atajos proporcionales | Se valida $0<E\le S_k$. Si $E=S_k$ el crédito se liquida y la tabla termina en $k$ | $n-k=0$ (no quedan cuotas); $E>S_k$ (rechazado) |
| Abono extraordinario con reducción de plazo | Francés: $n'=\left\lceil\frac{-\ln\left(1-\frac{S'_k\,i}{R}\right)}{\ln(1+i)}\right\rceil$ ; Alemán: $n'=\left\lceil\frac{S'_k}{A}\right\rceil$ | Cuotas restantes manteniendo $R$ (o $A$) | Modo `AbonarCapital` del spec. Se despeja $n$ de la fórmula de la cuota en vez de iterar "mientras saldo > 0" (sección 9 del spec): da el número exacto y la última cuota parcial | Forma cerrada con `Decimal.ln`. La tabla tiene $n'$ filas y la última cuota es menor (cierre exacto). Si $i=0$: $n'=\left\lceil\frac{S'_k}{R}\right\rceil$ | $R\le S'_k\,i$: logaritmo de un número ≤ 0 (la cuota no cubre el interés). No ocurre con $E>0$, pero se protege con un error explícito |
| Totales y comparativa | $T_I=\sum_k I_k$ ; $T_P=\sum_k R_k+\sum_k E_k$ ; $\Delta=\frac{T_I^{F}-T_I^{A}}{T_I^{A}}$ | Intereses totales, total pagado y sobrecosto relativo del Francés frente al Alemán | Se derivan de la tabla redondeada (Anexo del spec), así que lo exportado coincide con lo mostrado | Se suman los valores redondeados de cada fila, no se recalculan con la fórmula cerrada | $T_I^{A}=0$ (con $i=0$): $\Delta$ se reporta "no aplica" |
| Razón interés/capital | $\rho=\frac{T_I}{P}$ | Pesos de interés por cada peso prestado | Indicador simple para comparar escenarios (HU-23) | Mismo motor, sin fórmulas nuevas | $P=0$ (rechazado) |
| Valor futuro (interés compuesto) | $S=P(1+i)^{n}$ | Monto acumulado de $P$ tras $n$ periodos | Base del valor del dinero en el tiempo (sección 10.8 del spec) | `Decimal`, no `double` (corrige la sección 10.6 del spec) | $i\le -1$ |
| Valor presente | $P=\frac{S}{(1+i)^{n}}$ | Capital equivalente hoy a $S$ en $n$ periodos | Descontar flujos para compararlos en una misma fecha | Igual | $i=-1$ (división por cero) |
| Tasa del interés compuesto | $i=\left(\frac{S}{P}\right)^{\frac{1}{n}}-1$ | Tasa periódica que lleva $P$ a $S$ en $n$ | Despeje directo, sin iterar | Si la tasa de entrada es nominal, se convierte con la fórmula compuesta (corrige el $\frac{J}{m}$ de la sección 10.1 del spec) | $P\le 0$, $\frac{S}{P}\le 0$, $n=0$ |
| Periodos del interés compuesto | $n=\frac{\ln\left(\frac{S}{P}\right)}{\ln(1+i)}$ | Periodos necesarios para que $P$ llegue a $S$ | Despeje con logaritmos; puede dar un resultado fraccionario y se muestra así, con explicación | `Decimal.ln` a 34 dígitos | $i=0$ (si $S\ne P$, no hay solución); $\frac{S}{P}\le 0$ |
| Anualidad vencida | $S=A\,\frac{(1+i)^{n}-1}{i}$ ; $P=A\,\frac{1-(1+i)^{-n}}{i}$ | VF y VP de $n$ pagos iguales al final de cada periodo | Permite contrastar con la anticipada en la misma pantalla (HU-19) y es la base del Francés | Mejora: el spec solo tiene la anticipada. Rama $i=0$: $S=P=A\,n$ | $i=0$ (resuelto por la rama) |
| Anualidad anticipada | $S=A\,\frac{(1+i)^{n}-1}{i}(1+i)$ ; $P=A\,\frac{1-(1+i)^{-n}}{i}(1+i)$ | Igual, con los pagos al inicio de cada periodo | Cada pago gana un periodo más de interés: factor $(1+i)$ (sección 10.9 del spec) | Comparte el núcleo con la vencida (`factor × (1+i)^{tipo}`), sin duplicar código | $i=0$ (rama $A\,n$) |
| Cuota de la anualidad anticipada | $A=\frac{S\,i}{\left[(1+i)^{n}-1\right](1+i)}$ ; $A=\frac{P\,i}{\left[1-(1+i)^{-n}\right](1+i)}$ | Pago periódico para una meta $S$ o un valor actual $P$ | Despejes de la sección 10.9 del spec | Igual. Con $i=0$: $A=\frac{S}{n}$ | $n=0$ |
| Tasa de usura | $U_{EA}=1{,}5\cdot IBC_{EA}$ ; alerta si $EA_{\text{crédito}}>U_{EA}$ | Tope legal de interés y si el crédito simulado lo supera | Art. 884 del Código de Comercio (verificar). La comparación se hace **siempre en EA** para no comparar una nominal con una efectiva | La EA del crédito sale de la misma función del simulador; el estado muestra el margen en puntos básicos | Dato de IBC vencido: se pide el valor manual (sección 7.4) |
| Reparto proporcional directo | $C_k=M\,\frac{x_k}{\sum_j x_j}$ | Parte de $M$ proporcional al índice $x_k$ | Sección 10.10 del spec (método 1) | **Método del mayor residuo:** se redondea hacia abajo y los pesos sobrantes van a los mayores residuos, así que $\sum C_k=M$ exacto | $\sum x_j=0$; $x_k<0$ (rechazados) |
| Reparto inverso | $C_k=M\,\frac{\frac{1}{x_k}}{\sum_j \frac{1}{x_j}}$ | Parte inversamente proporcional (por ejemplo, a más días de mora, menos bonificación) | Interpretación del método 2 del spec (supuesto de la sección 0) | Mayor residuo; cálculo con `Decimal` | $x_k=0$ |
| Reparto compuesto | $C_k=M\,\frac{x_k\,y_k}{\sum_j x_j\,y_j}$ | Reparto proporcional a dos criterios a la vez (por ejemplo, aporte × tiempo) | Interpretación del método 3 del spec; se reduce al directo cuando $y_k=1$ | Mayor residuo | $\sum x_j y_j=0$ |

### 7.2 Política de precisión

- **Biblioteca:** decimal.js 10.6.0 (MIT). Es aritmética decimal de precisión arbitraria con `pow` de exponente no entero, `ln` y `exp`. big.js no tiene `ln` ni potencias fraccionarias, que se necesitan para las equivalencias y los despejes de $i$ y $n$. `number` (double) no representa 0,1 exacto.
- **Precisión interna:** `Decimal.clone({ precision: 34, rounding: Decimal.ROUND_HALF_UP })`, los 34 dígitos significativos de IEEE 754 decimal128. Las tasas **nunca** se redondean internamente. El spec redondeaba a 10 decimales en cada paso (sección 10.6 del spec), lo que acumulaba error en 360 periodos.
- **Dónde se redondea:** solo en los montos de cada fila ($R$, $I_k$, $A_k$, $S_k$), a la escala monetaria (0 por defecto, 2 para contrastar con Excel), con `ROUND_HALF_UP`. Es el mismo criterio de la función `REDONDEAR` de Excel y de un extracto bancario, donde cada fila es un valor pagable. La presentación solo formatea.
- **Residuo:** la última fila hace $A_n=S_{n-1}$, $R_n=S_{n-1}+I_n$, $S_n=0$. El residuo (del orden de $\pm\frac{n}{2}$ unidades de la escala) queda visible en la última cuota. La invariante $\sum A_k=P$ se cumple por construcción.
- **Tasa = 0:** rama explícita en Francés ($R=\frac{P}{n}$), anualidades ($A\,n$), reducción de plazo ($\left\lceil\frac{S'}{R}\right\rceil$) y despeje de $n$ (sin solución si $S\ne P$). Nunca se divide entre $i$ sin comprobar antes `i.isZero()`.
- **Serialización:** los `Decimal` viajan como string en `parametros` (JSONB) y en la URL compartida. Las columnas `NUMERIC` se leen con cast `::text` (sección 3). En XLSX los montos ya redondeados se escriben como número (enteros menores que $2^{53}$, exactos en double) para que Excel pueda sumarlos.
- **Rendimiento:** una tabla de 420 filas (360 + 60 de gracia) son unas 2.000 operaciones decimales, del orden de milisegundos (verificar con un benchmark de Vitest). No requiere Web Worker.

### 7.3 Verificación

Casos calculados a mano. Cada prueba fija la escala monetaria indicada. En Excel en español el separador de argumentos es `;`.

| ID | Entrada | Salida esperada | Contraste en Excel |
|---|---|---|---|
| T1 | 24 % nominal mensual vencida → EA, y de vuelta a mensual | EA = 26,824179 %; ida y vuelta = 2,000000 % exacto a 30 dígitos | `=TASA.EFECTIVA(24%;12)` → 0,268241795 |
| T2 | 30 % nominal trimestral anticipada → EA | $i_a$ = 7,5 %; $i_v$ = 8,108108 %; EA = 36,5945 % | `=(1-0,3/4)^-4-1` |
| T3 | Francés: P = 10.000.000; i = 1,5 % mensual; n = 12; escala 2 | R = 916.799,92; $I_1$ = 150.000,00; $A_1$ = 766.799,92; $I_2$ = 138.498,00; $S_{12}$ = 0; $T_I$ ≈ 1.001.599 (±1 por el residuo) | `=PAGO(1,5%;12;-10000000)`; `=PAGOINT(1,5%;1;12;-10000000)`; `=PAGOPRIN(1,5%;1;12;-10000000)`; `=PAGOINT(1,5%;2;12;-10000000)` |
| T3b | T3 con escala 0 | R = 916.800 (filas 1-11); $R_{12}$ absorbe el residuo (cálculo a mano: ≈ 916.799; cota $\lvert R_{12}-916.800\rvert\le 6$); $S_{12}$ = 0; $\sum A_k$ = 10.000.000 | `=REDONDEAR(PAGO(...);0)` |
| T4 | Alemán: P = 12.000.000; i = 1 %; n = 12 | A = 1.000.000; $R_1$ = 1.120.000; $R_{12}$ = 1.010.000; $T_I$ = 780.000 exacto ($P\,i\,\frac{n+1}{2}$) | Columna manual `=1000000+saldo*1%` |
| T5 | Francés con i = 0: P = 1.200.000; n = 12 | R = 100.000; $T_I$ = 0; no lanza error | `=PAGO(0;12;-1200000)` |
| T6 | Gracia muerta g = 3 + Francés n = 12; P = 10.000.000; i = 1,5 %; escala 0 | $I$ = 150.000; 152.250; 154.534 → $S_3$ = 10.456.784; luego R = 958.678 | `=PAGO(1,5%;12;-10456784)` → 958.677,88 |
| T7 | Gracia con pago de intereses g = 3 (mismo crédito) | $R_1..R_3$ = 150.000; $S_3$ = 10.000.000; luego R = 916.800 | `=10000000*1,5%` |
| T8 | Abono extra Alemán: T4 con E = 2.000.000 al cierre del periodo 2 ($S_2$ = 10.000.000) | Recálculo de cuota: A' = 800.000, $R_3$ = 880.000, 10 cuotas restantes. Reducción de plazo: A = 1.000.000, n' = 8 restantes (10 en total) | Manual |
| T9 | Anualidad anticipada: A = 500.000; i = 1 %; n = 12; escala 2 | S = 6.404.664,02; P = 5.683.814,15 (±0,01) | `=VF(1%;12;-500000;0;1)`; `=VA(1%;12;-500000;0;1)` |
| T10 | Interés compuesto, despeje de n: P = 1.000.000; S = 2.000.000; i = 2 % | n = 35,0028 | `=NPER(2%;0;-1000000;2000000)` |
| T11 | Reparto directo: M = 1.000.000; x = (1, 1, 1); escala 0 | 333.334; 333.333; 333.333 (empate resuelto por orden); Σ = 1.000.000 | `=1000000/3` (contraste del residuo) |
| T12 | Usura: IBC oct-2026 = 19,06 % EA; crédito al 2,2 % mensual | $U_{EA}$ = 28,59 %; EA del crédito ≈ 29,84 % → alerta "supera la usura" | `=1,5*19,06%`; `=(1+2,2%)^12-1` |

**Propiedades (fast-check, 1.000 casos por propiedad).** Generadores dentro de los rangos del spec: P de 1 a $10^{12}$, n de 1 a 360, tasa de 0 a 100 %, g de 0 a 60.
- $\sum_k A_k = P$ exacto (con gracia muerta: $\sum A_k = S_g$).
- $S_n = 0$ exacto y $S_k\ge 0$ en todas las filas.
- $R_k>0$ en cada fila de amortización, y $R_k$ no crece en el sistema Alemán.
- Monotonía: $S_k\le S_{k-1}$ para todo $k>g$.
- Francés: $R_1=\dots=R_{n-1}$ y $\lvert R_n-R\rvert\le\frac{n}{2}$ unidades de la escala.
- Ida y vuelta: `eaToPeriodic(nominalToEA(j, m), m)` es igual a $\frac{j}{m}$ con una tolerancia de $10^{-30}$.
- Reparto: $\sum C_k=M$ y $\lvert C_k-M\frac{x_k}{\sum x}\rvert<1$ unidad.
- Abono: después de cualquier $E\in(0, S_k]$ se siguen cumpliendo las dos primeras propiedades, y $T_I$ no aumenta.

Cobertura mínima de `src/core`: 95 % de líneas, como requisito del CI.

### 7.4 Tasa de usura

- **Fuente:** la certificación mensual del Interés Bancario Corriente (IBC) que publica la Superintendencia Financiera (superfinanciera.gov.co, sección de publicaciones). Para el 1 al 31 de octubre de 2026 la SFC certificó un IBC de 19,06 % EA para consumo y ordinario ([SFC](https://www.superfinanciera.gov.co/publicaciones/10116267/superfinanciera-certifica-el-interes-bancario-corriente/)), lo que da una usura de 28,59 % EA.
- **datos.gov.co:** al consultar su API de catálogo con "usura" y "tasa de usura" el 29-oct-2026 no apareció ningún dataset. Se revisa cada semestre.
- **Mecanismo:** sin llamadas en tiempo de ejecución. La SFC no publica una API estable y llamarla desde el navegador exigiría ampliar `connect-src` y depender de CORS.
  - `data/usura.json` guarda por vigencia: `{modalidad, ibcEA, usuraEA, desde, hasta, fuenteUrl}`.
  - Un workflow programado (día 1 de cada mes) abre un *issue* recordatorio. Una persona copia el valor y abre un PR, y CI valida que `usuraEA = 1,5 × ibcEA` y que las vigencias no se solapen.
- **Plan alterno:** si la fecha actual pasa de `hasta`, la UI muestra "Dato de usura vencido (vigente hasta …)" con color de advertencia y un campo para ingresar el IBC a mano. El valor manual se guarda en el perfil si hay sesión, o solo en memoria si es invitado, con la etiqueta "Ingresado por el usuario, vigencia …". Nunca se compara contra un dato vencido sin avisar.

## 8. Historias de usuario

Están en el orden en que se construyen. Primero el acceso, porque decide dónde se guardan los datos de todo lo demás. Después el simulador, que es el núcleo del spec, luego sus reportes, las calculadoras y, al final, lo que solo tiene sentido con cuenta y simulaciones ya hechas. La columna "Origen" indica si la historia viene del spec (HU-01 a HU-06 de la sección 16 del spec, o un módulo del spec sin historia) o si es nueva. El motor de la sección 7 no es una historia de usuario: es la base técnica de las épicas B a D y se construye en el hito 1 (sección 10).

**Épica A: acceso y cuenta**

| ID | Como… quiero… para… | Criterios de aceptación | Origen | Depende de | Valor | Esfuerzo | Prioridad |
|---|---|---|---|---|---|---|---|
| HU-01 | Como visitante quiero registrarme con correo y contraseña, aceptando la política de datos, para tener una cuenta donde guardar mi trabajo | Dado que no marco la casilla de la política, cuando envío el registro, entonces no se crea la cuenta y veo por qué.<br>Dado un registro válido, cuando confirmo el correo, entonces puedo iniciar sesión y queda guardado el consentimiento con versión y fecha | Nuevo (requisito del usuario) | — | Contexto Colombia (Ley 1581) | M | Must |
| HU-02 | Como usuario registrado quiero iniciar y cerrar sesión para acceder a mis datos de forma segura | Dado una contraseña incorrecta, cuando intento entrar, entonces veo "Correo o contraseña incorrectos" sin revelar si el correo existe.<br>Dado que cierro sesión, cuando vuelvo a la app, entonces entro como invitado y no veo datos de la cuenta | Nuevo (requisito del usuario) | HU-01 | Usabilidad | S | Must |
| HU-03 | Como usuario registrado quiero recuperar mi contraseña por correo para no perder mi cuenta si la olvido | Dado "Olvidé mi contraseña", cuando abro el enlace del correo, entonces puedo definir una nueva y entrar con ella.<br>Dado un enlace ya usado o vencido, cuando lo abro, entonces veo que no es válido y puedo pedir otro | Nuevo (requisito del usuario) | HU-01 | Usabilidad | S | Must |
| HU-04 | Como usuario registrado quiero un perfil con nombre, institución, programa y preferencias para personalizar mis reportes y la app | Dado que edito mi nombre e institución, cuando exporto un PDF, entonces el encabezado los muestra.<br>Dado que elijo escala de 2 decimales, cuando inicio sesión en otro equipo, entonces la preferencia se aplica sola | Nuevo (requisito del usuario) | HU-02 | Usabilidad | S | Must |
| HU-05 | Como titular de datos quiero descargar mis datos y eliminar mi cuenta para ejercer mis derechos de acceso y supresión | Dado que pulso "Descargar mis datos", cuando termina, entonces obtengo un JSON con perfil, simulaciones, escenarios y consentimientos.<br>Dado que confirmo "Eliminar mi cuenta" con mi contraseña, cuando termina, entonces mis datos se borran en cascada y ya no puedo iniciar sesión | Nuevo (obligación de la Ley 1581 al haber cuentas) | HU-04 | Contexto Colombia (Ley 1581) | M | Must |
| HU-06 | Como visitante quiero usar la app sin registrarme para calcular y descargar reportes sin dar mis datos | Dado que entro sin sesión, cuando abro cualquier calculadora, entonces funciona completa y no se me pide cuenta.<br>Dado que cierro la pestaña y vuelvo, cuando abro la app, entonces no queda ninguna simulación (sin rastro en `localStorage`, IndexedDB ni cookies) | Nuevo (requisito del usuario) | — | Usabilidad | S | Must |

**Épica B: simulador de créditos**

| ID | Como… quiero… para… | Criterios de aceptación | Origen | Depende de | Valor | Esfuerzo | Prioridad |
|---|---|---|---|---|---|---|---|
| HU-07 | Como estudiante quiero ingresar monto, plazo y frecuencia de pago con validación inmediata para definir el crédito a simular | Dado un plazo de 361 o un monto de 0, cuando salgo del campo, entonces veo el rango permitido (monto ≥ 1, plazo 1-360) y no se puede simular.<br>Dado datos válidos, cuando pulso "Simular", entonces se pasa al cálculo de la tasa | Spec HU-01 (Parametrización) | HU-06 | Pedagógico | S | Must |
| HU-08 | Como estudiante quiero ingresar la tasa como nominal o efectiva con su frecuencia y ver la tasa periódica equivalente antes de la tabla para entender qué tasa se aplica | Dado 24 % nominal mensual vencida, cuando calculo, entonces veo EA = 26,8242 % y tasa mensual = 2,0000 %.<br>Dado una tasa fuera de 0,01-100 %, cuando envío, entonces veo el error en el campo | Spec HU-02 (Equivalencia de tasas) | HU-07 | Pedagógico | M | Must |
| HU-09 | Como estudiante quiero ingresar tasas nominales anticipadas (TA, MA) para resolver ejercicios con la convención colombiana | Dado 30 % TA, cuando simulo, entonces veo una EA de 36,5945 % y el paso $i_v=\frac{i_a}{1-i_a}$.<br>Dado $\frac{j_a}{m}\ge 1$, cuando envío, entonces veo un error en el campo y no se genera la tabla | Nuevo (extensión de spec HU-02) | HU-08 | Contexto Colombia | S | Should |
| HU-10 | Como estudiante quiero generar la tabla de amortización en sistema Francés o Alemán, con la fila del desembolso, para ver periodo a periodo interés, abono y saldo | Dado P = 10.000.000, 1,5 % mensual y 12 cuotas en Francés, cuando genero la tabla, entonces la fila 0 muestra el saldo 10.000.000, la cuota es 916.800 y el saldo final es 0.<br>Dado el mismo crédito en Alemán, cuando genero la tabla, entonces el abono es constante y la cuota decrece | Spec HU-03 (Tabla de pagos) | HU-08 | Pedagógico | M | Must |
| HU-11 | Como estudiante quiero comparar Francés y Alemán para el mismo crédito para decidir cuál cuesta menos | Dado un crédito válido, cuando abro "Comparar sistemas", entonces veo cuota inicial, total de intereses y total pagado de ambos, y el sobrecosto relativo $\Delta$.<br>Dado i = 0, cuando comparo, entonces ambos totales de intereses son 0 y $\Delta$ dice "no aplica" | Spec HU-04 (Comparativa) | HU-10 | Pedagógico | S | Must |
| HU-12 | Como estudiante quiero agregar periodos de gracia muerta y elegir la frecuencia de capitalización para simular escenarios reales | Dado g = 3 con gracia muerta, cuando genero la tabla, entonces las filas 1-3 tienen cuota 0 y el saldo crece con el interés (T6).<br>Dado una gracia de 61 periodos, cuando envío, entonces veo el límite de 0-60 | Spec HU-05 (Escenarios) | HU-10 | Pedagógico | M | Must |
| HU-13 | Como estudiante quiero elegir gracia con pago de intereses para comparar su costo con la gracia muerta | Dado g = 3 con pago de intereses, cuando genero la tabla, entonces las cuotas 1-3 son iguales al interés y el saldo no cambia.<br>Dado el mismo crédito con gracia muerta, cuando comparo, entonces veo la diferencia de intereses totales | Nuevo (completa la gracia del spec, sección 15 del spec) | HU-12 | Pedagógico | S | Should |
| HU-14 | Como estudiante quiero registrar un abono extraordinario en un periodo y elegir si reduce la cuota o el plazo para ver el efecto de prepagar | Dado un abono mayor que el saldo del periodo, cuando lo registro, entonces veo el error y la tabla no cambia.<br>Dado un abono válido con "reducir plazo", cuando lo aplico, entonces la cuota se mantiene, la tabla tiene menos filas y el saldo final es 0 | Spec, secciones 6 y 9 (abono y recálculo; sin HU en el spec) | HU-10 | Pedagógico | M | Must |
| HU-15 | Como usuario quiero saber si la tasa de mi crédito supera la usura vigente para detectar ofertas ilegales | Dado un IBC vigente de 19,06 %, cuando simulo al 2,2 % mensual, entonces veo "Supera la usura (28,59 % EA)" con ícono y texto.<br>Dado un dato vencido, cuando abro el simulador, entonces veo el aviso y puedo ingresar el IBC a mano con su fecha | Nuevo | HU-08 | Contexto Colombia | M | Should |
| HU-16 | Como estudiante quiero ver paso a paso la fórmula de cada resultado con mis valores para entenderlo y preparar exámenes | Dado un resultado, cuando pulso "¿Cómo se calculó?", entonces veo la fórmula en LaTeX con los valores sustituidos y el resultado intermedio.<br>Dado el panel abierto, cuando navego con teclado, entonces cada paso es enfocable y lo lee un lector de pantalla | Nuevo (Anexo del spec: "no caja negra") | HU-10 | Pedagógico | M | Should |

**Épica C: reportes**

| ID | Como… quiero… para… | Criterios de aceptación | Origen | Depende de | Valor | Esfuerzo | Prioridad |
|---|---|---|---|---|---|---|---|
| HU-17 | Como usuario, con o sin cuenta, quiero exportar la tabla a PDF y Excel reales con los parámetros reales para entregarla como soporte | Dado una simulación con gracia y abonos, cuando exporto, entonces el PDF y el XLSX muestran sistema, gracia, tasa EA y periódica reales (no valores fijos) y el XLSX abre en Excel y LibreOffice con montos sumables.<br>Dado una tabla de 360 filas, cuando exporto a PDF, entonces se pagina y repite la cabecera en cada página | Spec HU-06 (Exportación), corregida (sección 15 del spec) | HU-10 | Usabilidad | M | Must |

**Épica D: calculadoras**

| ID | Como… quiero… para… | Criterios de aceptación | Origen | Depende de | Valor | Esfuerzo | Prioridad |
|---|---|---|---|---|---|---|---|
| HU-18 | Como estudiante quiero calcular interés compuesto despejando S, P, i o n para resolver ejercicios de valor del dinero en el tiempo | Dado P = 1.000.000, S = 2.000.000 e i = 2 %, cuando despejo n, entonces veo 35,0028 periodos (T10).<br>Dado una tasa nominal, cuando calculo, entonces se convierte con la fórmula compuesta, igual que en el simulador | Spec, sección 10.8 (módulo sin HU en el spec) | HU-08 | Pedagógico | S | Must |
| HU-19 | Como estudiante quiero calcular anualidades anticipadas y vencidas (S, P y cuota A) para comparar ambos tipos de pago | Dado A = 500.000, i = 1 % y n = 12 anticipada, cuando calculo, entonces S = 6.404.664,02 y P = 5.683.814,15 (T9).<br>Dado i = 0, cuando calculo, entonces S = P = A·n sin error | Spec, sección 10.9 (módulo sin HU en el spec); la vencida es nueva | HU-08 | Pedagógico | S | Must |
| HU-20 | Como estudiante quiero repartir un monto en forma directa, inversa o compuesta para resolver problemas de razones y proporciones | Dado M = 1.000.000 e índices (1, 1, 1), cuando reparto, entonces obtengo 333.334; 333.333; 333.333 y la suma es exacta (T11).<br>Dado un índice 0 en el reparto inverso, cuando calculo, entonces veo el error en ese índice | Spec, sección 10.10 (módulo sin HU en el spec) | HU-06 | Pedagógico | S | Must |

**Épica E: trabajo guardado y compartido** (HU-21 y HU-22 requieren cuenta; HU-23 y HU-24 también funcionan como invitado)

| ID | Como… quiero… para… | Criterios de aceptación | Origen | Depende de | Valor | Esfuerzo | Prioridad |
|---|---|---|---|---|---|---|---|
| HU-21 | Como usuario registrado quiero guardar, renombrar, abrir y borrar mis simulaciones para retomarlas desde cualquier equipo | Dado que guardé 3 simulaciones, cuando inicio sesión en otro navegador, entonces aparecen ordenadas por fecha y al abrir una se regenera la misma tabla.<br>Dado que borro una simulación y lo confirmo, cuando recargo, entonces ya no aparece ni en mis escenarios | Nuevo (requisito del usuario) | HU-02, HU-10 | Usabilidad | M | Must |
| HU-22 | Como invitado que decide registrarse quiero llevar la simulación abierta a mi cuenta para no repetirla | Dado una simulación abierta en modo invitado, cuando me registro o inicio sesión, entonces se ofrece "Guardar esta simulación en mi cuenta".<br>Dado que rechazo la oferta, cuando entro a "Mis simulaciones", entonces no se guardó nada | Nuevo | HU-06, HU-21 | Usabilidad | S | Should |
| HU-23 | Como estudiante quiero comparar hasta 3 simulaciones lado a lado para elegir la más conveniente | Dado 3 simulaciones, cuando abro el comparador, entonces veo cuota, EA, total de intereses y $\rho$ en columnas, con el menor costo resaltado.<br>Dado que soy invitado, cuando comparo, entonces funciona con las simulaciones de la sesión y se pierde al cerrar la pestaña | Nuevo | HU-11, HU-21 | Pedagógico | M | Should |
| HU-24 | Como estudiante quiero compartir una simulación por enlace para que el docente vea el mismo resultado sin crear cuenta | Dado una simulación, cuando pulso "Copiar enlace", entonces la URL lleva los parámetros en el hash (no se envían al servidor) y al abrirla se reproduce la misma tabla.<br>Dado un enlace alterado con valores fuera de rango, cuando lo abro, entonces veo un error de validación y no un cálculo erróneo | Nuevo | HU-10 | Usabilidad | S | Should |

## 9. Matriz de trazabilidad

| RF | Requisito | Estado | Componente | Prueba | HU | Justificación si no cumple |
|---|---|---|---|---|---|---|
| RF-01 | Parametrización y rangos (sección 10.7 del spec) | Cumple | `core/schemas.ts`, formulario | `unit/schemas.test.ts` (bordes 0, 1, 360, 361) | HU-07 | — |
| RF-02 | Conversión nominal/efectiva y equivalencia (sección 10.1 del spec) | Cumple | `core/rates.ts` | T1, T2, propiedad ida y vuelta | HU-08, HU-09 | — |
| RF-03 | Mostrar la tasa periódica antes de la tabla (Anexo del spec) | Cumple | Bloque "Tasa del periodo" | e2e `simular.spec.ts` | HU-08, HU-16 | — |
| RF-04 | Sistema Francés (sección 10.2 del spec) | Cumple | `core/amortization.ts` | T3, T3b, propiedades | HU-10 | — |
| RF-05 | Sistema Alemán (sección 10.3 del spec) | Cumple | `core/amortization.ts` | T4, propiedades | HU-10 | — |
| RF-06 | Fila Periodo 0 de desembolso (Anexo del spec) | Cumple | `core/amortization.ts` | `unit/amortization.test.ts` (fila 0: saldo = P, resto 0) | HU-10 | — |
| RF-07 | Gracia muerta (sección 10.4 del spec) | Cumple | `core/grace.ts` | T6 | HU-12 | — |
| RF-08 | Abono que reduce el plazo (sección 9 del spec) | Cumple | `core/prepayment.ts` | T8, propiedad de abono | HU-14 | — |
| RF-09 | Abono con recálculo de cuota (sección 9 del spec) | Cumple | `core/prepayment.ts` | T8 | HU-14 | — |
| RF-10 | Validación del abono y saldo no negativo (sección 10.7 del spec) | Cumple | `core/schemas.ts`, `prepayment.ts` | `unit/prepayment.test.ts` (E = 0, E = S, E > S) | HU-14 | — |
| RF-11 | Totales derivados de la tabla (Anexo del spec) | Cumple | `core/amortization.ts` | T3, T4 | HU-10 | — |
| RF-12 | Comparativa Francés vs. Alemán (spec HU-04) | Cumple | Vista comparativa + $\Delta$ | `unit/compare.test.ts` | HU-11 | — |
| RF-13 | Exportación (sección 6 del spec, HU-06), mejorada a PDF/XLSX reales | Cumple | `adapters/export/pdf.ts`, `xlsx.ts` | e2e: descarga con MIME `application/pdf` y `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`; parámetros reales en el contenido | HU-17 | — |
| RF-14 | Interés compuesto S, P, i, n (sección 10.8 del spec) | Cumple | `core/compound.ts` | T10, `unit/compound.test.ts` | HU-18 | — |
| RF-15 | Anualidad anticipada S, P, A (sección 10.9 del spec) | Cumple | `core/annuity.ts` | T9 | HU-19 | — |
| RF-16 | Reparto proporcional, 3 métodos (sección 10.10 del spec) | Cumple | `core/proportions.ts` | T11, propiedad Σ = M | HU-20 | — |
| RF-17 | Conversión unificada en todos los módulos (sección 15 del spec) | Cumple | Una sola `rates.ts` importada por todos | `unit/consistency.test.ts` (misma EA en los 4 módulos) | HU-08, HU-18 | — |
| RF-18 | Formato `es-CO`, 2 decimales visibles (Anexo del spec) | Parcial | `ui/format.ts` | `unit/format.test.ts` | HU-04 | Por defecto se muestran 0 decimales (COP no usa centavos); 2 es una preferencia del perfil |
| RF-19 | Precisión decimal y cierre exacto en 0 (sección 10.6 del spec) | Cumple, con otra técnica | `core/decimal.ts` | Propiedad $S_n=0$ | HU-10 | 34 dígitos sin redondear tasas, en vez de redondear a 10 decimales en cada paso: más exacto |
| RF-20 | Servicios inyectables y endpoints REST (sección 6 y Anexo del spec) | Parcial | `core/index.ts` (API de módulo tipada); Data API de Neon para los datos guardados | `unit/api.test.ts` | — | El cálculo no se expone por REST porque corre en el cliente. Los datos sí tienen REST con RLS |
| RF-21 | Modo invitado: calcular y exportar sin registro, sin guardar datos (usuario) | Cumple | `adapters/repo/GuestRepo.ts`, exportación en cliente | e2e `invitado.spec.ts`: exporta, recarga y comprueba almacenamiento vacío | HU-06 | — |
| RF-22 | Registro, login, logout y recuperación de contraseña (usuario) | Cumple | `adapters/auth/session.ts` + Managed Better Auth | e2e `auth.spec.ts` contra la rama `test` | HU-01, HU-02, HU-03 | — |
| RF-23 | Perfil del usuario (usuario) | Cumple | Tabla `perfil` + vista de perfil | `rls/perfil.test.ts` (A no lee el perfil de B); e2e de edición | HU-04 | — |
| RF-24 | Guardar, listar, abrir y borrar simulaciones (usuario) | Cumple | `adapters/repo/NeonRepo.ts`, tablas `simulacion`, `escenario` | `rls/simulacion.test.ts`; ida y vuelta: guardar → abrir → misma tabla y totales | HU-21, HU-22, HU-23 | — |
| RF-25 | Consentimiento y derechos del titular, Ley 1581 (consecuencia de RF-22 y RF-23) | Cumple | Tabla `consentimiento`, "Descargar mis datos", "Eliminar mi cuenta" | e2e `datos-personales.spec.ts` | HU-01, HU-05 | — |

## 10. Hoja de ruta MVP

| Hito | Historias | Entregable verificable |
|---|---|---|
| H1 Motor y acceso (semanas 1-2) | HU-01 a HU-06 | `src/core` completo con `npm test` en verde (T1-T12 y propiedades, cobertura ≥95 %). Sitio publicado en `*.pages.dev` desde `main` con registro, login, recuperación, perfil, eliminación de cuenta y modo invitado; `rls/*.test.ts` en verde con dos usuarios; cabeceras comprobadas con `curl -I` |
| H2 Simulador (semanas 3-4) | HU-07 a HU-16 | Simulador completo con los casos T3-T8 y T12 reproducidos en pantalla; e2e `simular.spec.ts` en verde |
| H3 Reportes y calculadoras (semanas 5-6) | HU-17 a HU-20 | PDF/XLSX reales que abren en Excel y LibreOffice; calculadoras con T9-T11 en pantalla; e2e `invitado.spec.ts` (exportar sin cuenta y sin rastro) en verde |
| H4 Trabajo guardado (semanas 7-8) | HU-21 a HU-24 | Guardar, abrir, comparar y compartir; política de datos publicada; auditoría Lighthouse de accesibilidad ≥95 (verificar umbral) |

## 11. Riesgos

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Suspensión del sitio por inactividad | Muy baja (sitio estático) | Alto en la sustentación | Abrir la URL el día anterior; plan B GitHub Pages con el mismo `dist/` |
| Suspensión de la base de Neon (scale-to-zero) | Alta, pero esperada: ocurre a los 5 minutos sin uso | Bajo: la primera consulta tarda más | Despierta sola con la siguiente consulta; precargar la sesión al abrir la app; el modo invitado no depende de la base |
| Límite de Neon Free (100 CU-horas, 1 GB, 5 GB de transferencia) | Baja (las simulaciones ocupan pocos KB y no se guarda la tabla) | Medio: el cómputo se suspende hasta el mes siguiente | Guardar solo parámetros y resumen; revisar el consumo en el panel antes de la demo |
| SDK `@neondatabase/neon-js` en beta | Media | Medio | Versión fijada sin `^`; SDK aislado en dos adaptadores; plan B con `@supabase/postgrest-js` + `better-auth` |
| Correos de verificación no llegan (SMTP compartido) | Media | Medio: nadie puede terminar el registro | Probar el registro la semana anterior; plan B Brevo como SMTP propio |
| Fuga de datos entre usuarios | Baja | Alto (Ley 1581) | RLS en todas las tablas; prueba automática A/B en CI; cadena de conexión solo en secretos |
| Cambio de términos de un plan gratuito | Media | Medio | Hosting intercambiable; datos exportables con `pg_dump`; plan B Firebase Spark para cuentas |
| Errores de redondeo | Media | Alto (pierde credibilidad) | decimal.js a 34 dígitos, cierre en la última fila, propiedades fast-check, contraste con Excel |
| Dependencia de un solo proveedor (GitHub) | Baja | Alto | El repo se puede espejar en GitLab; el build corre en local con `npm run build` |
| Dato de usura desactualizado | Media | Medio | Aviso de vencimiento y valor manual (sección 7.4) |

## 12. Auditoría de costo $0

**Servicios** (todos con cuenta gratuita por correo o GitHub; ninguno con tarjeta):

| Servicio | Costo | ¿Tarjeta? (fuente) | ¿Expira? | Al exceder el límite |
|---|---|---|---|---|
| GitHub Free (repo público, Actions, Dependabot, Pages) | 0 COP | No ([GitHub](https://docs.github.com/en/billing/get-started/how-billing-works)) | No | Actions es gratis en repos públicos; Pages responde 429. Sin método de pago no hay cobro |
| Cloudflare Workers Free (solo archivos estáticos) | 0 COP | No (cuenta creada sin tarjeta); no activar Zero Trust | No | Los archivos estáticos son gratis e ilimitados; el plan Free no tiene cobro por excedente |
| Neon Free (PostgreSQL, Managed Better Auth, Data API) | 0 COP | No ([Neon](https://neon.com/pricing)) | No ("no time limits") | El cómputo se suspende hasta el mes siguiente o fallan las escrituras; no borra datos ni cobra ([planes](https://neon.com/docs/introduction/plans)) |
| Brevo Free (solo si hace falta SMTP propio) | 0 COP | No ([Brevo](https://www.brevo.com/free-smtp-server/)) | No | 300 correos/día; deja de enviar hasta el día siguiente |
| Firebase Spark (solo plan B) | 0 COP | No ([Firebase](https://firebase.google.com/docs/projects/billing/firebase-pricing-plans)) | No | Al agotar la cuota el producto deja de responder hasta el siguiente ciclo |
| Publicaciones SFC | 0 COP | No (sitio público, sin cuenta) | No | No aplica |
| Dominio | 0 COP (subdominio `*.pages.dev`) | No | No | No aplica |

Servicios descartados por costo: Supabase (tarjeta no confirmada en su documentación oficial y un directorio verificado en agosto de 2026 dice que la pide). Google Cloud, AWS y Azure no se usan directamente.

**Librerías** (versión verificada en npm el 29-oct-2026; todas de código abierto, sin licencia comercial):

| Librería | Licencia | Costo |
|---|---|---|
| react 19.3.1, vite 8.3.5, vitest 5.0.5, zod 4.6.7, decimal.js 10.6.0, pdfmake 0.3.13, write-excel-file 4.1.1, chart.js 4.6.1, fast-check 4.10.2, katex 0.19.1, better-auth 1.7.14, @supabase/postgrest-js 2.118.0 (plan B), ESLint | MIT | 0 COP |
| TypeScript, @playwright/test 1.64.1, @neondatabase/neon-js 0.9.0-beta | Apache-2.0 | 0 COP |
| lucide-react 1.64.0 | ISC | 0 COP |
| @fontsource/ibm-plex-sans 5.3.0 e IBM Plex Mono | OFL-1.1 | 0 COP |
| psql (cliente de PostgreSQL, para migraciones) | PostgreSQL License | 0 COP |

No hay APIs con costo por uso, servicios de IA ni VPS.

## 13. Recomendación final

Stack ganador: SPA en **React + TypeScript + Vite** con el motor puro en **decimal.js**, PDF/XLSX reales con **pdfmake** y **write-excel-file**, pruebas con **Vitest + fast-check**, despliegue en **Cloudflare Pages** y **Neon Free** (Managed Better Auth + Data API + PostgreSQL con RLS) solo para el modo registrado. Gana porque los cálculos y reportes corren en el navegador: el invitado usa todo sin cuenta y sin dejar rastro, y el registrado guarda perfil y simulaciones sin servidor propio ni tarjeta en ningún servicio. Primer paso: `npm create vite@latest interes-claro -- --template react-ts`, luego `npm i decimal.js zod` y `npm i -D vitest fast-check`, y escribir `src/core/rates.ts` con la prueba T1 en verde. En paralelo, crear el proyecto en Neon y activar Data API con Managed Better Auth para empezar HU-01.
