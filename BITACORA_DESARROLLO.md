# Bitácora de desarrollo: Interés Claro

Registro historia por historia. Cada entrada describe qué se hizo, cómo y cómo se probó. La fuente de verdad del diseño es `PROPUESTA_NUEVO_PROYECTO.md`.

## [Iteración 0] - Estructura del proyecto, núcleo decimal y CI/CD

**Fecha:** 29 de octubre de 2026

**Estado:** Completado y probado en local. El CI/CD queda configurado; se verá en verde en GitHub con el primer push.

### ¿Qué se hizo?

- Proyecto Vite + React 19 + TypeScript 6 creado a mano en la raíz (sin plantilla, para no pisar los archivos existentes): `package.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `eslint.config.js`, `index.html`.
- `src/core/decimal.ts`: constructor `D` de decimal.js con 34 dígitos y `ROUND_HALF_UP`, y `redondearMonto(valor, escala)` para escala 0 (pesos) o 2 (centavos).
- `src/core/parse.ts`: `parseNumeroEsCo(texto)` convierte "10.000.000", "1,5" o "$ 1.000" a `Decimal` sin pasar por `parseFloat`, y rechaza textos ambiguos como "1.5".
- `src/core/index.ts`: API pública del motor.
- `src/ui/App.tsx` y `src/ui/styles.css`: página inicial con la paleta, la tipografía (IBM Plex, solo el subconjunto latino) y la cuadrícula tipo bento de la sección 6 de la propuesta, más la etiqueta de modo invitado y el enlace "Saltar al contenido".
- `public/_headers`: CSP, HSTS, X-Frame-Options, Referrer-Policy, X-Content-Type-Options y Permissions-Policy para Cloudflare Pages.
- `.github/workflows/ci-cd.yml`: pipeline de lint, tipos, pruebas con cobertura, auditoría, build y despliegue.
- `.github/dependabot.yml`: actualizaciones semanales de npm y de Actions.
- `README.md`, `.env.example`, `.gitignore`.

### ¿Cómo se hizo? (Explicación técnica)

- **Precisión:** `Decimal.clone({ precision: 34, rounding: ROUND_HALF_UP })` reproduce la precisión de IEEE 754 decimal128 (sección 7.2 de la propuesta). `ROUND_HALF_UP` redondea los medios alejándose de cero, igual que `REDONDEAR` de Excel, así que los valores se pueden contrastar con `PAGO`, `PAGOINT` y `PAGOPRIN`. `toExpNeg`/`toExpPos` amplios evitan que `toString()` use notación científica al guardar tasas muy pequeñas.
- **Entrada es-CO:** en Colombia el punto separa miles y la coma separa decimales. El parser exige grupos de 3 dígitos después de cada punto; si no los encuentra, devuelve `null` en vez de adivinar. Así "1.5" no se convierte en silencio en 15 ni en 1,5.
- **Motor puro:** `eslint.config.js` prohíbe en `src/core/**` importar React, UI o adaptadores, y usar `window`, `document`, `fetch`, `localStorage` y `sessionStorage`. Se comprobó con un archivo de sonda temporal, que ESLint rechazó con 3 errores, y luego se borró.
- **Cobertura:** `vitest.config.ts` mide solo `src/core/**` y falla por debajo de 95 % de líneas, funciones y sentencias (90 % de ramas).
- **CI/CD:** el job `deploy` depende de `test-build` (`needs`), así que solo se publica si pasan lint, tipos, pruebas, auditoría y build. Las Actions están fijadas por SHA: checkout v7.0.1, setup-node v7.1.0, upload-artifact v7.0.2, download-artifact v8.0.2 y wrangler-action v4.1.3. Si faltan los secretos de Cloudflare, el despliegue se omite con un aviso en vez de fallar. Si el proyecto de Pages no existe, el pipeline lo crea.
- **Cambio frente a la propuesta:** se despliega desde GitHub Actions y no con la integración Git de Cloudflare, porque esa integración publica aunque las pruebas fallen.

### Pruebas unitarias implementadas

28 pruebas en 3 archivos, todas en verde. Cobertura de `src/core`: 100 % de sentencias, ramas, funciones y líneas.

- `tests/unit/decimal.test.ts`
  - Test: la precisión es de 34 dígitos (1/3 da 34 treses).
  - Test: 0,1 + 0,2 = 0,3 exacto (en double da 0,30000000000000004).
  - Test: no usa notación científica con valores muy pequeños o muy grandes.
  - Test: redondeo al peso con ROUND_HALF_UP (916.799,5 → 916.800; 916.799,49 → 916.799; 2,5 → 3).
  - Test: −2,5 → −3 (igual que Excel).
  - Test: escala 2 (916.799,924 → 916.799,92; 0,005 → 0,01).
  - Test: `redondearMonto` no modifica el valor original.
- `tests/unit/parse.test.ts`
  - Test: acepta 9 formatos válidos ("10.000.000", "1,5", "1.234,56", "$ 1.000", "2,5 %", "0,01", "−3,25", espacio duro de miles).
  - Test: rechaza 8 formatos ambiguos o inválidos ("1.5", "1,2,3", "12.34.567", "abc", "", "1e5", "--1", ",").
  - Test: conserva 19 decimales sin pasar por double.
- `tests/unit/App.test.tsx`
  - Test: muestra el título y los 4 módulos del spec.
  - Test: la etiqueta de estado dice que el modo invitado no guarda nada.
  - Test: existe el enlace "Saltar al contenido" hacia `#contenido`.

Otras verificaciones locales: `npm run lint` sin errores, `npm run typecheck` sin errores, `npm audit --audit-level=high` con 0 vulnerabilidades y `npm run build` correcto (JS de 221,7 kB, 69,5 kB con gzip; `_headers` copiado a `dist/`).

### ¿Cómo probar esta funcionalidad manualmente?

1. Ejecutar `npm ci` y luego `npm run dev` (en PowerShell con scripts bloqueados: `npm.cmd run dev`).
2. Ir a `http://localhost:5173`.
3. Revisar la página inicial; no hay datos que ingresar en esta iteración. Pulsar `Tab` una vez y luego `Enter`.
4. Resultado esperado: al pulsar `Tab` aparece el enlace "Saltar al contenido", que lleva a la sección principal. La cabecera muestra "Invitado: no se guarda nada" y se ven 4 módulos, con el simulador en el bloque grande. Con el sistema en modo oscuro, la página usa la paleta oscura. Para las pruebas, ejecutar `npm run coverage` y ver 28 pruebas en verde con 100 % de cobertura.

### Ajuste posterior: despliegue en Cloudflare Workers (30 de octubre de 2026)

- **Problema:** se creó en Cloudflare un Worker llamado `proyecto-ing-eco2026-3` con la integración Git activa. Ese Worker construyó `main`, que solo tenía el "Initial commit", y falló con "Could not detect a directory containing static files". Además, esa integración publica sin correr las pruebas.
- **Decisión:** se usa ese Worker en lugar de un proyecto de Pages. Cloudflare sirve los archivos estáticos de un Worker gratis y sin límite de solicitudes ([precios](https://developers.cloudflare.com/workers/platform/pricing/)) y aplica el mismo `_headers` ([docs](https://developers.cloudflare.com/workers/static-assets/headers/)).
- **Cambios:** nuevo `wrangler.jsonc` (nombre del Worker, `assets.directory = ./dist/` y `not_found_handling = single-page-application`). El job `deploy` de `ci-cd.yml` ahora descarga el código, recupera el `dist/` ya probado y ejecuta `wrangler deploy`; se quitó el paso que creaba el proyecto de Pages.
- **Acción manual pendiente:** desconectar la integración Git del Worker (Settings → Build) para que solo despliegue GitHub Actions, y crear el token con permiso "Workers Scripts: Edit".
