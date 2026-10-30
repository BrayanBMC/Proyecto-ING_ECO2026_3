import { z } from 'zod';
import { LONGITUD_MAXIMA_NOMBRE, type ResultadoValidacion } from './cuenta';

/** HU-04: perfil del usuario. Módulo puro: solo valida y arma datos. */

export const LONGITUD_MAXIMA_INSTITUCION = 80;

export interface Perfil {
  nombre: string;
  institucion: string | null;
  programa: string | null;
  /** Decimales de los montos: 0 (pesos) o 2 (centavos). */
  escala: 0 | 2;
  /** Días del año para tasas diarias. */
  baseDiaria: 360 | 365;
}

/** Valores por defecto si el usuario aún no ha guardado su perfil. */
export function perfilInicial(nombre: string): Perfil {
  return { nombre, institucion: null, programa: null, escala: 0, baseDiaria: 360 };
}

// Texto opcional: vacío se guarda como null.
const textoOpcional = (campo: string) =>
  z
    .string()
    .trim()
    .max(LONGITUD_MAXIMA_INSTITUCION, `${campo} admite hasta ${LONGITUD_MAXIMA_INSTITUCION} caracteres.`)
    .transform((texto) => (texto === '' ? null : texto));

export const esquemaPerfil = z.object({
  nombre: z
    .string()
    .trim()
    .min(1, 'Escribe tu nombre.')
    .max(LONGITUD_MAXIMA_NOMBRE, `El nombre admite hasta ${LONGITUD_MAXIMA_NOMBRE} caracteres.`),
  institucion: textoOpcional('La institución'),
  programa: textoOpcional('El programa'),
  escala: z.union([z.literal(0), z.literal(2)]),
  baseDiaria: z.union([z.literal(360), z.literal(365)]),
});

export interface FormularioPerfil {
  nombre: string;
  institucion: string;
  programa: string;
  escala: 0 | 2;
  baseDiaria: 360 | 365;
}

export type ErroresPerfil = Partial<Record<keyof FormularioPerfil, string>>;

export function validarPerfil(datos: FormularioPerfil): ResultadoValidacion<Perfil, ErroresPerfil> {
  const resultado = esquemaPerfil.safeParse(datos);
  if (resultado.success) {
    return { ok: true, datos: resultado.data };
  }
  const errores: ErroresPerfil = {};
  for (const problema of [...resultado.error.issues].reverse()) {
    errores[problema.path[0] as keyof FormularioPerfil] = problema.message;
  }
  return { ok: false, errores };
}

/** HU-05: arma el archivo de "Descargar mis datos" (derecho de acceso, Ley 1581). */
export function armarExportacion(datos: {
  correo: string;
  perfil: Perfil | null;
  consentimientos: readonly { version: string; aceptadoEn: string }[];
  generadoEn: Date;
}) {
  return {
    aplicacion: 'Amortiza',
    generado_en: datos.generadoEn.toISOString(),
    cuenta: { correo: datos.correo },
    perfil: datos.perfil,
    consentimientos: datos.consentimientos,
    // Se llenan cuando existan las historias HU-21 a HU-23.
    simulaciones: [],
    escenarios: [],
  };
}
