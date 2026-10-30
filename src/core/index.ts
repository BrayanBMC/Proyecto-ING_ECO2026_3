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
  numero,
} from './tasas';
export { explicarAmortizacion } from './explicacion';
export type { Paso } from './explicacion';
export type { Frecuencia, TipoTasa, PasoTasa, ResultadoTasa } from './tasas';
export { cuotaFrances, cuotasRestantes, generarTabla } from './amortizacion';
export type { Sistema, Fila, Tabla, TipoGracia, Gracia, ModoAbono, AbonoExtra } from './amortizacion';
export { compararSistemas, compararGracias } from './comparar';
export type { Comparacion, ResumenSistema } from './comparar';
export {
  MONTO_MAXIMO,
  PLAZO_MAXIMO,
  GRACIA_MAXIMA,
  validarMonto,
  validarPlazo,
  validarTasa,
  validarSimulacion,
  validarGracia,
  validarAbono,
  validarIbc,
} from './simulador';
export type { FormularioSimulacion, Simulacion, ErroresSimulacion, ErroresAbono } from './simulador';
export {
  VIGENCIAS_IBC,
  FACTOR_USURA,
  usuraDesdeIbc,
  fechaIso,
  vigenciaActual,
  ultimaVigencia,
  evaluarUsura,
} from './usura';
export type { VigenciaIbc, EstadoUsura } from './usura';
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
