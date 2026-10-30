import { createClient } from '@neondatabase/neon-js';
import type { Perfil } from '../../core';
import { mensajeDeError, type ErrorServicio } from './mensajes';
import type { DatosNuevaCuenta, ResultadoCuenta, ServicioCuenta } from './ServicioCuenta';

/**
 * Implementación del puerto de cuentas con Neon Managed Better Auth + Data API.
 * Es el único archivo (junto con el repositorio de datos) que importa el SDK de Neon.
 * Métodos según https://neon.com/docs/reference/javascript-sdk y
 * https://neon.com/docs/auth/guides/plugins/email-otp
 */

interface RespuestaSdk {
  error?: ErrorServicio | null;
}

function aResultado(respuesta: RespuestaSdk): ResultadoCuenta {
  return respuesta.error ? { ok: false, mensaje: mensajeDeError(respuesta.error) } : { ok: true };
}

interface FilaPerfil {
  nombre_mostrar: string;
  institucion: string | null;
  programa: string | null;
  escala_monetaria: number;
  base_diaria: number;
}

function deFila(fila: FilaPerfil): Perfil {
  return {
    nombre: fila.nombre_mostrar,
    institucion: fila.institucion,
    programa: fila.programa,
    escala: fila.escala_monetaria === 2 ? 2 : 0,
    baseDiaria: fila.base_diaria === 365 ? 365 : 360,
  };
}

function aFila(perfil: Perfil) {
  return {
    nombre_mostrar: perfil.nombre,
    institucion: perfil.institucion,
    programa: perfil.programa,
    escala_monetaria: perfil.escala,
    base_diaria: perfil.baseDiaria,
    actualizado_en: new Date().toISOString(),
  };
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

    sesionActual: async () => {
      try {
        const usuario = (await cliente.auth.getSession()).data?.user;
        return usuario ? { nombre: usuario.name, correo: usuario.email } : null;
      } catch {
        return null;
      }
    },

    iniciarSesion: (correo: string, contrasena: string) =>
      capturar(() => cliente.auth.signIn.email({ email: correo, password: contrasena })),

    cerrarSesion: () => capturar(() => cliente.auth.signOut()),

    pedirCodigoRecuperacion: (correo: string) =>
      capturar(() => cliente.auth.forgetPassword.emailOtp({ email: correo })),

    restablecerContrasena: ({ correo, codigo, contrasena }) =>
      capturar(() => cliente.auth.emailOtp.resetPassword({ email: correo, otp: codigo, password: contrasena })),

    leerPerfil: async () => {
      try {
        const { data, error } = await cliente.from('perfil').select('*').maybeSingle();
        if (error) {
          return { ok: false, mensaje: mensajeDeError(error) };
        }
        const fila = data as FilaPerfil | null;
        return { ok: true, perfil: fila ? deFila(fila) : null };
      } catch {
        return { ok: false, mensaje: mensajeDeError(null) };
      }
    },

    guardarPerfil: (perfil: Perfil) =>
      capturar(async () => {
        const usuario = (await cliente.auth.getSession()).data?.user;
        if (!usuario) {
          return { error: { code: 'SIN_SESION' } };
        }
        const guardado = await cliente.from('perfil').upsert({ usuario_id: usuario.id, ...aFila(perfil) });
        if (guardado.error) {
          return guardado;
        }
        // El nombre de la cabecera sale de la cuenta, así que también se actualiza ahí.
        return await cliente.auth.updateUser({ name: perfil.nombre });
      }),

    leerConsentimientos: async () => {
      try {
        const { data, error } = await cliente
          .from('consentimiento')
          .select('version_politica, aceptado_en')
          .order('aceptado_en');
        if (error) {
          return { ok: false, mensaje: mensajeDeError(error) };
        }
        const filas = (data ?? []) as { version_politica: string; aceptado_en: string }[];
        return { ok: true, consentimientos: filas.map((f) => ({ version: f.version_politica, aceptadoEn: f.aceptado_en })) };
      } catch {
        return { ok: false, mensaje: mensajeDeError(null) };
      }
    },

    // Se comprueba la contraseña iniciando sesión de nuevo; luego la función SQL borra la cuenta del JWT.
    eliminarCuenta: (correo: string, contrasena: string) =>
      capturar(async () => {
        const comprobacion = await cliente.auth.signIn.email({ email: correo, password: contrasena });
        if (comprobacion.error) {
          return comprobacion;
        }
        const borrado = await cliente.rpc('eliminar_mi_cuenta');
        if (borrado.error) {
          return borrado;
        }
        await cliente.auth.signOut();
        return {};
      }),
  };
}
