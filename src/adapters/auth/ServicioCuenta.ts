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

export interface ServicioCuenta {
  /** Crea la cuenta. Neon envía un código de verificación al correo. */
  registrar(datos: DatosNuevaCuenta): Promise<ResultadoCuenta>;
  /**
   * Confirma el correo con el código recibido y deja la sesión iniciada.
   * Recibe la contraseña porque, si Neon no inicia sesión solo tras verificar, el adaptador la inicia.
   */
  verificarCorreo(datos: { correo: string; codigo: string; contrasena: string }): Promise<ResultadoCuenta>;
  /** Vuelve a enviar el código de verificación (vence a los 15 minutos). */
  reenviarCodigo(correo: string): Promise<ResultadoCuenta>;
  /** Guarda la prueba del consentimiento (Ley 1581) para el usuario con sesión iniciada. */
  registrarConsentimiento(versionPolitica: string): Promise<ResultadoCuenta>;
}
