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
    aceptaPolitica: z.boolean(),
  })
  .superRefine((datos, ctx) => {
    if (datos.confirmacion !== datos.contrasena) {
      ctx.addIssue({ code: 'custom', path: ['confirmacion'], message: 'Las contraseñas no coinciden.' });
    }
    if (!datos.aceptaPolitica) {
      ctx.addIssue({
        code: 'custom',
        path: ['aceptaPolitica'],
        message: 'Debes aceptar la política de tratamiento de datos para crear la cuenta.',
      });
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
  for (const problema of resultado.error.issues) {
    const campo = problema.path[0] as CampoRegistro | undefined;
    if (campo && errores[campo] === undefined) {
      errores[campo] = problema.message;
    }
  }
  return { ok: false, errores };
}

/** Código de verificación que llega al correo: solo dígitos, entre 4 y 8. */
export const esquemaCodigo = z
  .string()
  .trim()
  .regex(/^\d{4,8}$/, 'El código tiene solo números. Revísalo en tu correo.');

export function validarCodigo(codigo: string): ResultadoValidacion<string, string> {
  const resultado = esquemaCodigo.safeParse(codigo);
  return resultado.success
    ? { ok: true, datos: resultado.data }
    : { ok: false, errores: resultado.error.issues[0]?.message ?? 'Código inválido.' };
}
