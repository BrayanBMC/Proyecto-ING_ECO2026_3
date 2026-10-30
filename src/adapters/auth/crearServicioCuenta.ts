import type { ServicioCuenta } from './ServicioCuenta';

/**
 * Devuelve el servicio de cuentas o null si faltan las URL de Neon en el build.
 * El SDK de Neon se descarga solo la primera vez que se usa (import dinámico),
 * así la página de inicio y el modo invitado no cargan código de autenticación.
 */
export function crearServicioCuenta(urlAuth: string | undefined, urlDataApi: string | undefined): ServicioCuenta | null {
  if (!urlAuth || !urlDataApi) {
    return null;
  }
  let real: Promise<ServicioCuenta> | null = null;
  const obtener = () => {
    real ??= import('./neonCuenta').then((m) => m.crearServicioCuentaNeon(urlAuth, urlDataApi));
    return real;
  };
  return {
    registrar: async (datos) => (await obtener()).registrar(datos),
    verificarCorreo: async (datos) => (await obtener()).verificarCorreo(datos),
    reenviarCodigo: async (correo) => (await obtener()).reenviarCodigo(correo),
    registrarConsentimiento: async (version) => (await obtener()).registrarConsentimiento(version),
  };
}
