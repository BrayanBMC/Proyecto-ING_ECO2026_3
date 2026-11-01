import type { ResultadoCuenta, ServicioCuenta, Usuario } from '../../src/adapters/auth/ServicioCuenta';

export const OK: ResultadoCuenta = { ok: true };

/** Servicio de cuentas en memoria para las pruebas de UI. Todo responde bien salvo lo que se cambie. */
export function servicioFalso(cambios: Partial<ServicioCuenta> = {}) {
  return {
    registrar: vi.fn(async () => OK),
    verificarCorreo: vi.fn(async () => OK),
    reenviarCodigo: vi.fn(async () => OK),
    registrarConsentimiento: vi.fn(async () => OK),
    sesionActual: vi.fn(async (): Promise<Usuario | null> => null),
    iniciarSesion: vi.fn(async () => OK),
    cerrarSesion: vi.fn(async () => OK),
    pedirCodigoRecuperacion: vi.fn(async () => OK),
    restablecerContrasena: vi.fn(async () => OK),
    leerPerfil: vi.fn(async () => ({ ok: true as const, perfil: null })),
    guardarPerfil: vi.fn(async () => OK),
    leerConsentimientos: vi.fn(async () => ({
      ok: true as const,
      consentimientos: [{ version: '2026-10-30', aceptadoEn: '2026-10-30T15:00:00Z' }],
    })),
    eliminarCuenta: vi.fn(async () => OK),
    listarSimulaciones: vi.fn<ServicioCuenta['listarSimulaciones']>(async () => ({ ok: true, simulaciones: [] })),
    guardarSimulacion: vi.fn<ServicioCuenta['guardarSimulacion']>(async (nombre, parametros) => ({
      ok: true,
      simulacion: { id: 'nueva', nombre, parametros, actualizadoEn: '2026-11-01T12:00:00.000Z' },
    })),
    leerTema: vi.fn<ServicioCuenta['leerTema']>(async () => null),
    guardarTema: vi.fn<ServicioCuenta['guardarTema']>(async () => OK),
    renombrarSimulacion: vi.fn<ServicioCuenta['renombrarSimulacion']>(async () => OK),
    borrarSimulacion: vi.fn<ServicioCuenta['borrarSimulacion']>(async () => OK),
    ...cambios,
  } satisfies ServicioCuenta;
}

export function fallo(mensaje: string) {
  return vi.fn(async (): Promise<ResultadoCuenta> => ({ ok: false, mensaje }));
}
