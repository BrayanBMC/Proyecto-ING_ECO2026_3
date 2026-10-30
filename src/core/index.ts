// API pública del motor financiero (sección 2 de la propuesta).
// Cada historia de usuario agrega aquí los módulos que necesita.
export { D, dec, redondearMonto } from './decimal';
export type { Dec, EscalaMonetaria } from './decimal';
export { parseNumeroEsCo } from './parse';
export {
  VERSION_POLITICA,
  LONGITUD_MINIMA_CONTRASENA,
  LONGITUD_MAXIMA_CONTRASENA,
  LONGITUD_MAXIMA_NOMBRE,
  esquemaRegistro,
  esquemaCodigo,
  validarRegistro,
  validarCodigo,
} from './cuenta';
export type { DatosRegistro, RegistroValido, CampoRegistro, ErroresRegistro, ResultadoValidacion } from './cuenta';
