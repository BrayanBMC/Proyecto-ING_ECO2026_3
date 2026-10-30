# Interés Claro

Simulador académico de créditos e ingeniería económica en pesos colombianos (COP). Es el sucesor de EconomicApp: replica sus funciones (ver `PROJECT_SPEC.md`) y las mejora según `PROPUESTA_NUEVO_PROYECTO.md`.

- Calcula en el navegador con precisión decimal de 34 dígitos (decimal.js).
- Modo invitado sin registro: calcula y exporta reportes sin guardar nada.
- Modo registrado (desde HU-01): guarda perfil y simulaciones en Neon (PostgreSQL con RLS).
- Costo $0: Cloudflare Pages, GitHub Actions y Neon Free, sin tarjeta.

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
| `VITE_NEON_AUTH_URL` | No (aún no se usa) | HU-01 | URL de Managed Better Auth de Neon. Es pública por diseño |
| `VITE_NEON_DATA_API_URL` | No (aún no se usa) | HU-01 | URL de la Data API de Neon. Es pública por diseño; RLS protege los datos |

Secretos del pipeline (se guardan en GitHub → Settings → Secrets and variables → Actions, nunca en el código):

| Nombre | Tipo | Uso |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | Secret | Desplegar en Cloudflare Pages (permiso "Cloudflare Pages: Edit") |
| `CLOUDFLARE_ACCOUNT_ID` | Secret | Cuenta de Cloudflare donde vive el proyecto `interes-claro` |
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
5. Si todo pasa y es un push a `main`, publica `dist/` en Cloudflare Pages (`https://interes-claro.pages.dev`).

Si faltan los secretos de Cloudflare, el despliegue se omite con un aviso y el pipeline sigue en verde. Dependabot revisa dependencias de npm y de Actions cada semana.

## Estructura

```
src/core/        Motor financiero puro (sin UI, red ni almacenamiento)
src/ui/          Componentes React y estilos
tests/unit/      Pruebas unitarias (Vitest)
public/_headers  Cabeceras de seguridad para Cloudflare Pages
.github/         CI/CD y Dependabot
```
