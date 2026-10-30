# Proyecto-ING_ECO2026_3

Simulador académico de créditos e ingeniería económica en pesos colombianos (COP). El diseño técnico está en `PROPUESTA_NUEVO_PROYECTO.md`.

- Calcula en el navegador con precisión decimal de 34 dígitos (decimal.js).
- Modo invitado sin registro: calcula y exporta reportes sin guardar nada.
- Registro con correo, contraseña, código de verificación y aceptación de la política de datos (HU-01). Inicio y cierre de sesión (HU-02) y recuperación de contraseña con código al correo (HU-03).
- En Neon → Settings → Better Auth deben estar activos "Sign-up with Email", "Verify at Sign-up" y el método "Verification code"; si no, no llegan los códigos. Más adelante guardará perfil y simulaciones en Neon (PostgreSQL con RLS).
- Costo $0: Cloudflare Workers (solo archivos estáticos, gratis e ilimitados), GitHub Actions y Neon Free, sin tarjeta.

El avance historia por historia está en `BITACORA_DESARROLLO.md`.

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

El Worker no debe tener conectada la integración Git de Cloudflare (Settings → Build): esa integración publica sin correr las pruebas. Solo despliega GitHub Actions.

## Estructura

```
src/core/        Motor financiero y reglas de validación puras (sin UI, red ni almacenamiento)
src/adapters/    Conexión con servicios externos (auth/: cuentas con Neon)
src/ui/          Componentes React, páginas, enrutador y estilos
db/migrations/   SQL de la base de datos en Neon (tablas y políticas RLS)
tests/unit/      Pruebas unitarias (Vitest)
public/_headers  Cabeceras de seguridad (Cloudflare las aplica a los archivos estáticos)
wrangler.jsonc   Configuración del Worker que sirve dist/
.github/         CI/CD y Dependabot
```
