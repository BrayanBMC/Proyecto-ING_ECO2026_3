/**
 * Traduce los errores del servicio de autenticación a mensajes en español para el usuario.
 * No revela si un correo existe salvo en el registro, donde Better Auth ya lo informa.
 */
export interface ErrorServicio {
  code?: string | undefined;
  message?: string | undefined;
  status?: number | undefined;
}

const MENSAJES: Record<string, string> = {
  USER_ALREADY_EXISTS: 'Ya existe una cuenta con ese correo. Inicia sesión o recupera tu contraseña.',
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: 'Ya existe una cuenta con ese correo. Inicia sesión o recupera tu contraseña.',
  PASSWORD_TOO_SHORT: 'La contraseña es demasiado corta.',
  PASSWORD_TOO_LONG: 'La contraseña es demasiado larga.',
  INVALID_EMAIL: 'El correo no es válido.',
  INVALID_OTP: 'El código no es correcto. Revísalo o pide uno nuevo.',
  OTP_EXPIRED: 'El código venció. Pide uno nuevo.',
  TOO_MANY_ATTEMPTS: 'Demasiados intentos. Espera unos minutos y vuelve a intentarlo.',
};

export function mensajeDeError(error: ErrorServicio | null | undefined): string {
  if (error?.code && MENSAJES[error.code]) {
    return MENSAJES[error.code] as string;
  }
  if (error?.status === 429) {
    return MENSAJES.TOO_MANY_ATTEMPTS as string;
  }
  return 'No pudimos completar la operación. Revisa tu conexión e inténtalo de nuevo.';
}
