# Bitácora de desarrollo: Amortiza

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

## [HU-01] - Registro con correo, contraseña y aceptación de la política de datos

**Fecha:** 30 de octubre de 2026

**Estado:** Completado y probado en local con un servicio de cuentas simulado. La prueba contra Neon real se hace en producción después de aplicar la migración (ver "Cómo probar").

**Historia:** Como visitante quiero registrarme con correo y contraseña, aceptando la política de datos, para tener una cuenta donde guardar mi trabajo.

### ¿Qué se hizo?

- `src/core/cuenta.ts`: reglas del registro con zod. Nombre de 1 a 60 caracteres, correo válido (se recorta y pasa a minúsculas), contraseña de 10 a 128 caracteres, confirmación igual y casilla de la política marcada. También valida el código de verificación (4 a 8 dígitos). Fija `VERSION_POLITICA = '2026-10-30'`.
- `src/adapters/auth/ServicioCuenta.ts`: puerto (interfaz) con `registrar`, `verificarCorreo`, `reenviarCodigo` y `registrarConsentimiento`.
- `src/adapters/auth/neonCuenta.ts`: implementación con el SDK `@neondatabase/neon-js` 0.9.0-beta (Managed Better Auth + Data API).
- `src/adapters/auth/crearServicioCuenta.ts`: crea el servicio solo si el build trae `VITE_NEON_AUTH_URL` y `VITE_NEON_DATA_API_URL`, y carga el SDK con import dinámico.
- `src/adapters/auth/mensajes.ts`: traduce los códigos de error de Better Auth a mensajes en español.
- `src/ui/navegacion.tsx`: enrutador mínimo con la History API (`useRuta`, `navegar`, `Enlace`).
- `src/ui/paginas/Registro.tsx`: formulario en tres pasos: datos, código enviado al correo y confirmación.
- `src/ui/paginas/PoliticaDatos.tsx`: política de tratamiento de datos en `/politica-de-datos`.
- `src/ui/paginas/Inicio.tsx`: la página de inicio sale de `App.tsx`, que ahora solo arma la cabecera, el pie y las rutas. La cabecera tiene el botón "Crear cuenta".
- `db/migrations/001_consentimiento.sql`: tabla `public.consentimiento` con RLS.
- `.github/workflows/db-migrate.yml`: workflow manual "Migraciones de base de datos" que aplica los `.sql` con `psql`.
- `public/_headers`: `connect-src` permite los dos hosts de Neon (Auth y Data API) y nada más.
- `package.json`: `overrides` para que el SDK de Neon use versiones sin vulnerabilidades conocidas de zod y Better Auth.

### ¿Cómo se hizo? (Explicación técnica)

- **Verificación por código:** el SMTP compartido de Neon solo envía códigos, no enlaces. Tras `auth.signUp.email`, Neon envía el código; `auth.emailOtp.verifyEmail` lo comprueba. Neon inicia sesión al verificar por defecto; si no hay sesión, el adaptador llama a `auth.signIn.email`. La contraseña se borra de la memoria del formulario cuando el registro termina.
- **Prueba del consentimiento (Ley 1581, art. 9):** la autorización se pide con una casilla que empieza sin marcar. Después de verificar el correo se inserta una fila en `consentimiento` con la versión de la política. El cliente solo manda `version_politica`. La base pone `usuario_id` con `auth.user_id()` (el `sub` del JWT) y `aceptado_en` con `now()`, así nadie puede registrar un consentimiento a nombre de otro. RLS deja leer e insertar solo las filas propias. `UPDATE` y `DELETE` están revocados, así que la prueba no se puede alterar. La FK a `neon_auth."user"` con `ON DELETE CASCADE` borra los consentimientos al eliminar la cuenta (HU-05).
- **Si falla el guardado del consentimiento:** la cuenta ya está verificada, así que la pantalla "Falta guardar tu aceptación" reintenta solo esa inserción, sin pedir otro código. Si el primer intento sí llegó a la base, el reintento choca con `UNIQUE (usuario_id, version_politica)` (código 23505) y el adaptador lo cuenta como éxito.
- **Aislamiento del SDK beta:** la UI solo conoce `ServicioCuenta`. Las pruebas usan un servicio falso, y cambiar de proveedor solo toca `neonCuenta.ts`. El SDK se descarga cuando el visitante usa el registro, no al abrir la página de inicio.
- **Accesibilidad:** cada campo tiene `<label>`. Los errores se enlazan con `aria-describedby` y marcan `aria-invalid`. El foco va al primer campo con error y, al cambiar de paso, al título. El campo del código usa `autocomplete="one-time-code"` e `inputmode="numeric"`.
- **Dependencias:** el SDK de Neon trae `better-auth` 1.7.6 y zod 4.1/4.5, que `npm audit` marca como altas (GHSA-mrhx-c7xc-m3w5 en zod < 4.6.6). `overrides` fuerza la misma zod del proyecto y Better Auth 1.7.14.
- **Cambio frente a la propuesta:** no se usa React Router. Con tres rutas, un enrutador de 40 líneas evita una dependencia.

### Pruebas unitarias implementadas

- `tests/unit/cuenta.test.ts`
  - Test: acepta un registro válido.
  - Test: criterio HU-01, sin marcar la política no es válido y se explica por qué.
  - Test: normaliza el correo (espacios y mayúsculas) y recorta el nombre.
  - Test: rechaza nombre vacío o de 61 caracteres, correo sin arroba, contraseña de 9 o 129 caracteres y confirmación distinta, cada uno con su mensaje.
  - Test: acepta contraseñas de exactamente 10 y 128 caracteres.
  - Test: da un solo mensaje por campo aunque fallen varias reglas.
  - Test (propiedad con fast-check): sin aceptar la política nunca es válido, para cualquier nombre, correo y contraseña.
  - Test: la versión de la política tiene formato de fecha ISO.
  - Test: el código acepta de 4 a 8 dígitos y rechaza letras, espacios internos y largos fuera de rango.
- `tests/unit/Registro.test.tsx`
  - Test: criterio HU-01, sin marcar la política no se llama al servicio, se muestra el motivo y el foco va a la casilla.
  - Test: la casilla empieza sin marcar y enlaza `/politica-de-datos`.
  - Test: con el formulario vacío muestra los errores y enfoca "Nombre".
  - Test: criterio HU-01, con datos válidos crea la cuenta, verifica el código y guarda el consentimiento con la versión vigente.
  - Test: muestra el error del servicio si el correo ya tiene cuenta.
  - Test: valida el formato del código antes de llamar al servicio.
  - Test: si el código es incorrecto no guarda el consentimiento.
  - Test: "Enviar otro código" reenvía y lo confirma en pantalla.
  - Test: si falla el consentimiento, lo reintenta sin repetir la verificación.
  - Test: sin URL de Neon informa que el registro no está disponible.
  - Test: el botón "Crear cuenta" de la cabecera abre `/registro` sin recargar.
  - Test: `/politica-de-datos` muestra versión, responsable y derechos.
  - Test: una ruta desconocida muestra "Página no encontrada".
  - Test: el botón Atrás del navegador vuelve a la página anterior.

Verificación: `npm run typecheck` sin errores en local. Lint, pruebas con cobertura, auditoría y build se verifican en GitHub Actions al subir a `develop`.

### ¿Cómo probar esta funcionalidad manualmente?

Una sola vez, después de fusionar el PR en `main`:

1. En GitHub → Actions → "Migraciones de base de datos" → Run workflow (rama `main`). Debe terminar en verde.
2. En la consola de Neon → Data API → pulsar "Refresh schema cache" para que la Data API vea la tabla `consentimiento`.

Prueba:

1. Abrir `https://proyecto-ing-eco2026-3.bacostap.workers.dev` y pulsar "Crear cuenta".
2. Llenar nombre, un correo real, una contraseña de al menos 10 caracteres y repetirla. Dejar la casilla sin marcar y pulsar "Crear cuenta".
3. Resultado esperado: aparece "Debes aceptar la política de tratamiento de datos para crear la cuenta." y no llega ningún correo.
4. Marcar la casilla y pulsar "Crear cuenta". Resultado esperado: la pantalla cambia a "Revisa tu correo" y llega un correo de Neon con un código.
5. Escribir el código y pulsar "Verificar correo". Resultado esperado: "Tu cuenta está lista".
6. En Neon → SQL Editor: `select usuario_id, version_politica, aceptado_en from consentimiento;`. Resultado esperado: una fila con la versión `2026-10-30`.
7. Repetir el registro con el mismo correo. Resultado esperado: "Ya existe una cuenta con ese correo."

Para las pruebas locales: `npm run coverage`.

### Ajuste posterior de HU-01: activar la verificación en Neon (30 de octubre de 2026)

- **Problema:** al crear la cuenta no llegaba el código. Neon trae la verificación de correo apagada por defecto.
- **Solución:** en Neon → Settings → Better Auth se activaron "Sign-up with Email", "Verify at Sign-up" y el método "Verification code". No hubo cambios de código.

## [HU-02 y HU-03] - Iniciar y cerrar sesión, y recuperar la contraseña

**Fecha:** 30 de octubre de 2026

**Estado:** Completado. Pruebas en verde en GitHub Actions.

**Historias:**
- HU-02: como usuario registrado quiero iniciar y cerrar sesión para acceder a mis datos de forma segura.
- HU-03: como usuario registrado quiero recuperar mi contraseña por correo para no perder mi cuenta si la olvido.

### ¿Qué se hizo?

- `src/ui/paginas/IniciarSesion.tsx` (`/iniciar-sesion`): correo y contraseña, con enlaces a "¿Olvidaste tu contraseña?" y "Crear cuenta".
- `src/ui/paginas/RecuperarContrasena.tsx` (`/recuperar-contrasena`): pide el correo, envía un código y permite escribir el código con la nueva contraseña.
- `src/ui/App.tsx`: la app consulta la sesión al abrir. Con sesión, la cabecera muestra "Hola, {nombre}" y "Cerrar sesión", y oculta "Invitado", "Iniciar sesión" y "Crear cuenta" (esto corrige lo reportado en HU-01). Sin sesión muestra lo de antes más "Iniciar sesión".
- `src/ui/Campo.tsx`: campo de formulario reutilizable (etiqueta, ayuda y error accesibles).
- `src/core/cuenta.ts`: `validarInicioSesion`, `validarRestablecimiento` y `validarCorreo`, que reutilizan las reglas de HU-01.
- `ServicioCuenta` y `neonCuenta.ts`: `sesionActual`, `iniciarSesion`, `cerrarSesion`, `pedirCodigoRecuperacion` y `restablecerContrasena`.
- `mensajes.ts`: "Correo o contraseña incorrectos." para contraseña errada y para correo inexistente.

### ¿Cómo se hizo? (Explicación técnica)

- **Sesión:** `auth.getSession()` al montar la app; `auth.signIn.email` para entrar y `auth.signOut` para salir. Al cerrar sesión se limpia el usuario y se vuelve al inicio como invitado.
- **No revelar correos (criterio HU-02):** Better Auth responde `INVALID_EMAIL_OR_PASSWORD` en ambos casos y la app muestra el mismo mensaje. La recuperación dice "Si el correo tiene una cuenta, le enviamos un código", sin confirmar si existe.
- **Recuperación con código:** `auth.forgetPassword.emailOtp` envía el código y `auth.emailOtp.resetPassword` cambia la contraseña ([docs de Neon](https://neon.com/docs/auth/guides/plugins/email-otp)).
- **Cambio frente a la propuesta:** HU-03 decía "enlace del correo". El correo compartido de Neon solo envía códigos (la misma razón de HU-01), así que se usa código. Si el código está usado o vencido, se muestra el error y el botón "Enviar otro código".

### Pruebas unitarias implementadas

- `tests/unit/cuenta.test.ts`: `validarInicioSesion` (normaliza el correo; pide correo y contraseña), `validarRestablecimiento` (válido; solo confirmación distinta; tres errores a la vez) y `validarCorreo`.
- `tests/unit/Sesion.test.tsx`
  - Test: criterio HU-02, contraseña incorrecta muestra "Correo o contraseña incorrectos." y sigue como invitado.
  - Test: valida el formulario antes de llamar al servicio.
  - Test: al entrar, la cabecera muestra "Hola, Ana Pérez" y oculta "Invitado", "Iniciar sesión" y "Crear cuenta".
  - Test: si ya hay sesión al abrir, aparece "Cerrar sesión".
  - Test: criterio HU-02, al cerrar sesión vuelve a invitado y al inicio.
  - Test: el inicio de sesión enlaza la recuperación.
  - Test: criterio HU-03, con el código define la nueva contraseña y ofrece iniciar sesión.
  - Test: criterio HU-03, con código vencido muestra el error y permite pedir otro.
  - Test: rechaza correo inválido, muestra error de envío y valida código, longitud y confirmación.
  - Test: sin URL de Neon, ambas páginas dicen que no está disponible.
  - Test: el botón "Iniciar sesión" de la cabecera abre la página.
- `tests/unit/servicioFalso.ts`: servicio de cuentas falso compartido por las pruebas de UI.

### ¿Cómo probar esta funcionalidad manualmente?

1. Abrir la app, pulsar "Iniciar sesión" y escribir tu correo con una contraseña equivocada. Resultado esperado: "Correo o contraseña incorrectos."
2. Escribir la contraseña correcta. Resultado esperado: vuelve al inicio y la cabecera dice "Hola, {tu nombre}" con "Cerrar sesión"; ya no aparecen "Invitado" ni "Crear cuenta".
3. Recargar la página. Resultado esperado: sigue la sesión.
4. Pulsar "Cerrar sesión" y recargar. Resultado esperado: aparece "Invitado: no se guarda nada".
5. En "Iniciar sesión", pulsar "¿Olvidaste tu contraseña?", escribir tu correo y "Enviar código". Llega un código al correo.
6. Escribir un código inventado y una contraseña nueva. Resultado esperado: un error y el botón "Enviar otro código".
7. Escribir el código real y la contraseña nueva dos veces. Resultado esperado: "Contraseña actualizada". Entrar con la nueva contraseña.
