import { createClient } from '@neondatabase/neon-js';
import { mensajeDeError, type ErrorServicio } from './mensajes';
import type { DatosNuevaCuenta, ResultadoCuenta, ServicioCuenta } from './ServicioCuenta';

/**
 * Implementación del puerto de cuentas con Neon Managed Better Auth + Data API.
 * Es el único archivo (junto con el repositorio de datos) que importa el SDK de Neon.
 * Métodos según https://neon.com/docs/reference/javascript-sdk
 */

interface RespuestaSdk {
  error?: ErrorServicio | null;
}

function aResultado(respuesta: RespuestaSdk): ResultadoCuenta {
  return respuesta.error ? { ok: false, mensaje: mensajeDeError(respuesta.error) } : { ok: true };
}

async function capturar(operacion: () => Promise<RespuestaSdk>): Promise<ResultadoCuenta> {
  try {
    return aResultado(await operacion());
  } catch {
    return { ok: false, mensaje: mensajeDeError(null) };
  }
}

export function crearServicioCuentaNeon(urlAuth: string, urlDataApi: string): ServicioCuenta {
  const cliente = createClient({ auth: { url: urlAuth }, dataApi: { url: urlDataApi } });

  return {
    registrar: ({ nombre, correo, contrasena }: DatosNuevaCuenta) =>
      capturar(() => cliente.auth.signUp.email({ email: correo, password: contrasena, name: nombre })),

    verificarCorreo: ({ correo, codigo, contrasena }) =>
      capturar(async () => {
        const verificacion = await cliente.auth.emailOtp.verifyEmail({ email: correo, otp: codigo });
        if (verificacion.error) {
          return verificacion;
        }
        // Neon inicia sesión al verificar por defecto; si el proyecto lo tiene desactivado, se inicia aquí.
        const sesion = await cliente.auth.getSession();
        if (sesion.data?.session) {
          return {};
        }
        return await cliente.auth.signIn.email({ email: correo, password: contrasena });
      }),

    reenviarCodigo: (correo: string) =>
      capturar(() => cliente.auth.emailOtp.sendVerificationOtp({ email: correo, type: 'email-verification' })),

    // usuario_id lo pone la base de datos con auth.user_id() y la política RLS lo exige.
    // Si un reintento choca con UNIQUE (23505), el consentimiento ya quedó guardado: cuenta como éxito.
    registrarConsentimiento: (versionPolitica: string) =>
      capturar(async () => {
        const respuesta = await cliente.from('consentimiento').insert({ version_politica: versionPolitica });
        return respuesta.error?.code === '23505' ? {} : respuesta;
      }),
  };
}
