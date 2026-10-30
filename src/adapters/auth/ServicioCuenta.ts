import type { Perfil } from '../../core';

/**
 * Puerto de cuentas de usuario. La UI solo conoce esta interfaz; la implementación real
 * (Neon Managed Better Auth) vive en neonCuenta.ts y se puede cambiar sin tocar la UI.
 * Sección 1 de la propuesta: el SDK de Neon está en beta, por eso se aísla aquí.
 */

export type ResultadoCuenta = { ok: true } | { ok: false; mensaje: string };

export interface DatosNuevaCuenta {
  nombre: string;
  correo: string;
  contrasena: string;
}

/** Datos mínimos del usuario con sesión iniciada que muestra la cabecera. */
export interface Usuario {
  nombre: string;
  correo: string;
}

export interface ServicioCuenta {
  /** HU-01: crea la cuenta. Neon envía un código de verificación al correo. */
  registrar(datos: DatosNuevaCuenta): Promise<ResultadoCuenta>;
  /**
   * HU-01: confirma el correo con el código recibido y deja la sesión iniciada.
   * Recibe la contraseña porque, si Neon no inicia sesión solo tras verificar, el adaptador la inicia.
   */
  verificarCorreo(datos: { correo: string; codigo: string; contrasena: string }): Promise<ResultadoCuenta>;
  /** HU-01: vuelve a enviar el código de verificación (vence a los 15 minutos). */
  reenviarCodigo(correo: string): Promise<ResultadoCuenta>;
  /** HU-01: guarda la prueba del consentimiento (Ley 1581) para el usuario con sesión iniciada. */
  registrarConsentimiento(versionPolitica: string): Promise<ResultadoCuenta>;

  /** HU-02: usuario con sesión iniciada, o null si es invitado. */
  sesionActual(): Promise<Usuario | null>;
  /** HU-02: inicia sesión con correo y contraseña. */
  iniciarSesion(correo: string, contrasena: string): Promise<ResultadoCuenta>;
  /** HU-02: cierra la sesión en este navegador. */
  cerrarSesion(): Promise<ResultadoCuenta>;

  /** HU-03: envía al correo un código para restablecer la contraseña. */
  pedirCodigoRecuperacion(correo: string): Promise<ResultadoCuenta>;
  /** HU-03: cambia la contraseña con el código recibido. */
  restablecerContrasena(datos: { correo: string; codigo: string; contrasena: string }): Promise<ResultadoCuenta>;

  /** HU-04: perfil guardado del usuario, o null si aún no lo ha guardado. */
  leerPerfil(): Promise<{ ok: true; perfil: Perfil | null } | { ok: false; mensaje: string }>;
  /** HU-04: guarda el perfil (y actualiza el nombre de la cuenta). */
  guardarPerfil(perfil: Perfil): Promise<ResultadoCuenta>;

  /** HU-05: consentimientos guardados del usuario (para "Descargar mis datos"). */
  leerConsentimientos(): Promise<
    { ok: true; consentimientos: { version: string; aceptadoEn: string }[] } | { ok: false; mensaje: string }
  >;
  /** HU-05: comprueba la contraseña y borra la cuenta con todos sus datos. Deja la sesión cerrada. */
  eliminarCuenta(correo: string, contrasena: string): Promise<ResultadoCuenta>;
}
