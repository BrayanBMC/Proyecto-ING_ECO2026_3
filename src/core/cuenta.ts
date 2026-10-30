import { z } from 'zod';

/**
 * Reglas de la cuenta de usuario (HU-01). Módulo puro: solo valida datos, no habla con la red.
 * Las mismas reglas se repiten en la base de datos con CHECK (sección 5 de la propuesta).
 */

/** Versión vigente de la política de tratamiento de datos. Se guarda con cada consentimiento. */
export const VERSION_POLITICA = '2026-10-30';

export const LONGITUD_MINIMA_CONTRASENA = 10;
export const LONGITUD_MAXIMA_CONTRASENA = 128;
export const LONGITUD_MAXIMA_NOMBRE = 60;

const MENSAJE_NO_COINCIDEN = 'Las contraseñas no coinciden.';

export const esquemaRegistro = z
  .object({
    nombre: z
      .string()
      .trim()
      .min(1, 'Escribe tu nombre.')
      .max(LONGITUD_MAXIMA_NOMBRE, `El nombre admite hasta ${LONGITUD_MAXIMA_NOMBRE} caracteres.`),
    correo: z.string().trim().toLowerCase().pipe(z.email('Escribe un correo válido, por ejemplo nombre@dominio.co.')),
    contrasena: z
      .string()
      .min(LONGITUD_MINIMA_CONTRASENA, `La contraseña debe tener al menos ${LONGITUD_MINIMA_CONTRASENA} caracteres.`)
      .max(LONGITUD_MAXIMA_CONTRASENA, `La contraseña admite hasta ${LONGITUD_MAXIMA_CONTRASENA} caracteres.`),
    confirmacion: z.string(),
    // Se valida en el propio campo para que el error salga aunque fallen otros campos.
    aceptaPolitica: z
      .boolean()
      .refine((acepta) => acepta, 'Debes aceptar la política de tratamiento de datos para crear la cuenta.'),
  })
  .superRefine((datos, ctx) => {
    if (datos.confirmacion !== datos.contrasena) {
      ctx.addIssue({ code: 'custom', path: ['confirmacion'], message: MENSAJE_NO_COINCIDEN });
    }
  });

export type DatosRegistro = z.input<typeof esquemaRegistro>;
export type RegistroValido = z.output<typeof esquemaRegistro>;
export type CampoRegistro = keyof DatosRegistro;
export type ErroresRegistro = Partial<Record<CampoRegistro, string>>;

export type ResultadoValidacion<T, E> = { ok: true; datos: T } | { ok: false; errores: E };

/** Valida el formulario de registro y devuelve un mensaje por campo (el primero que falle). */
export function validarRegistro(datos: DatosRegistro): ResultadoValidacion<RegistroValido, ErroresRegistro> {
  const resultado = esquemaRegistro.safeParse(datos);
  if (resultado.success) {
    return { ok: true, datos: resultado.data };
  }
  const errores: ErroresRegistro = {};
  // Se recorre al revés para que quede el primer mensaje de cada campo.
  for (const problema of [...resultado.error.issues].reverse()) {
    errores[problema.path[0] as CampoRegistro] = problema.message;
  }
  // zod 4 no corre superRefine si algún campo falla; la confirmación se revisa aquí también.
  if (errores.confirmacion === undefined && datos.confirmacion !== datos.contrasena) {
    errores.confirmacion = MENSAJE_NO_COINCIDEN;
  }
  return { ok: false, errores };
}

const MENSAJE_CODIGO = 'El código tiene solo números. Revísalo en tu correo.';

/** Código de verificación que llega al correo: solo dígitos, entre 4 y 8. */
export const esquemaCodigo = z
  .string()
  .trim()
  .regex(/^\d{4,8}$/, MENSAJE_CODIGO);

export function validarCodigo(codigo: string): ResultadoValidacion<string, string> {
  const resultado = esquemaCodigo.safeParse(codigo);
  return resultado.success ? { ok: true, datos: resultado.data } : { ok: false, errores: MENSAJE_CODIGO };
}

/** Primer mensaje de error de cada campo. */
function erroresPorCampo<C extends string>(issues: readonly { path: PropertyKey[]; message: string }[]) {
  const errores: Partial<Record<C, string>> = {};
  for (const problema of [...issues].reverse()) {
    errores[problema.path[0] as C] = problema.message;
  }
  return errores;
}

// HU-02: iniciar sesión. Solo se revisa el formato; la contraseña la valida el servidor.
export const esquemaInicioSesion = z.object({
  correo: esquemaRegistro.shape.correo,
  contrasena: z.string().min(1, 'Escribe tu contraseña.'),
});

export type DatosInicioSesion = z.input<typeof esquemaInicioSesion>;
export type ErroresInicioSesion = Partial<Record<keyof DatosInicioSesion, string>>;

export function validarInicioSesion(
  datos: DatosInicioSesion,
): ResultadoValidacion<z.output<typeof esquemaInicioSesion>, ErroresInicioSesion> {
  const resultado = esquemaInicioSesion.safeParse(datos);
  return resultado.success
    ? { ok: true, datos: resultado.data }
    : { ok: false, errores: erroresPorCampo<keyof DatosInicioSesion>(resultado.error.issues) };
}

// HU-03: nueva contraseña con el código que llega al correo.
export const esquemaRestablecimiento = z.object({
  codigo: esquemaCodigo,
  contrasena: esquemaRegistro.shape.contrasena,
  confirmacion: z.string(),
});

export type DatosRestablecimiento = z.input<typeof esquemaRestablecimiento>;
export type ErroresRestablecimiento = Partial<Record<keyof DatosRestablecimiento, string>>;

export function validarRestablecimiento(
  datos: DatosRestablecimiento,
): ResultadoValidacion<z.output<typeof esquemaRestablecimiento>, ErroresRestablecimiento> {
  const resultado = esquemaRestablecimiento.safeParse(datos);
  const errores = resultado.success
    ? {}
    : erroresPorCampo<keyof DatosRestablecimiento>(resultado.error.issues);
  if (datos.confirmacion !== datos.contrasena) {
    errores.confirmacion = MENSAJE_NO_COINCIDEN;
  }
  return resultado.success && Object.keys(errores).length === 0
    ? { ok: true, datos: resultado.data }
    : { ok: false, errores };
}

/** HU-03: valida solo el correo (pedir código de recuperación). */
export function validarCorreo(correo: string): ResultadoValidacion<string, string> {
  const resultado = esquemaRegistro.shape.correo.safeParse(correo);
  return resultado.success
    ? { ok: true, datos: resultado.data }
    : { ok: false, errores: 'Escribe un correo válido, por ejemplo nombre@dominio.co.' };
}
