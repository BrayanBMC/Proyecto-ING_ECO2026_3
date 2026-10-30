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
  validarInicioSesion,
  validarRestablecimiento,
  validarCorreo,
} from './cuenta';
export {
  FRECUENCIAS,
  nombreFrecuencia,
  nominalVencidaAEA,
  nominalAnticipadaAEA,
  anticipadaAVencida,
  vencidaAAnticipada,
  tasaEquivalente,
  eaAPeriodica,
  eaANominal,
  calcularTasa,
} from './tasas';
export type { Frecuencia, TipoTasa, PasoTasa, ResultadoTasa } from './tasas';
export { cuotaFrances, generarTabla } from './amortizacion';
export type { Sistema, Fila, Tabla } from './amortizacion';
export { compararSistemas } from './comparar';
export type { Comparacion, ResumenSistema } from './comparar';
export { MONTO_MAXIMO, PLAZO_MAXIMO, validarMonto, validarPlazo, validarTasa, validarSimulacion } from './simulador';
export type { FormularioSimulacion, Simulacion, ErroresSimulacion } from './simulador';
export { LONGITUD_MAXIMA_INSTITUCION, perfilInicial, esquemaPerfil, validarPerfil, armarExportacion } from './perfil';
export type { Perfil, FormularioPerfil, ErroresPerfil } from './perfil';
export type {
  DatosRegistro,
  RegistroValido,
  CampoRegistro,
  ErroresRegistro,
  ResultadoValidacion,
  DatosInicioSesion,
  ErroresInicioSesion,
  DatosRestablecimiento,
  ErroresRestablecimiento,
} from './cuenta';
