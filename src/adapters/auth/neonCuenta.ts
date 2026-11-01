import { createClient } from '@neondatabase/neon-js';
import { leerParametros, type Perfil, type SimulacionGuardada } from '../../core';
import { mensajeDeError, mensajeDeExcepcion, type ErrorServicio } from './mensajes';
import { conReintento, conTiempo } from './resiliencia';
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

interface FilaSimulacion {
  id: string;
  nombre: string;
  parametros: unknown;
  actualizado_en: string;
}

const COLUMNAS_SIMULACION = 'id, nombre, parametros, actualizado_en';

/** Una fila cuyos parámetros no pasan la validación de forma se descarta: no se podría abrir. */
function deFilaSimulacion(fila: FilaSimulacion): SimulacionGuardada | null {
  const parametros = leerParametros(fila.parametros);
  return parametros.ok
    ? { id: fila.id, nombre: fila.nombre, parametros: parametros.datos, actualizadoEn: fila.actualizado_en }
    : null;
}

/** Escrituras y acciones de cuenta: con tiempo máximo, pero SIN reintento (repetir un INSERT podría duplicarlo). */
async function capturar(operacion: () => Promise<RespuestaSdk>): Promise<ResultadoCuenta> {
  try {
    return aResultado(await conTiempo(operacion));
  } catch (error) {
    return { ok: false, mensaje: mensajeDeExcepcion(error) };
  }
}

/** Lecturas: con tiempo máximo y un reintento si la base estaba dormida o la red falló. */
const leer = <T>(operacion: () => PromiseLike<T>): Promise<T> => conReintento(operacion);

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
        const usuario = (await leer(() => cliente.auth.getSession())).data?.user;
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
        const { data, error } = await leer(() => cliente.from('perfil').select('*').maybeSingle());
        if (error) {
          return { ok: false, mensaje: mensajeDeError(error) };
        }
        const fila = data as FilaPerfil | null;
        return { ok: true, perfil: fila ? deFila(fila) : null };
      } catch (error) {
        return { ok: false, mensaje: mensajeDeExcepcion(error) };
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
        const { data, error } = await leer(() =>
          cliente.from('consentimiento').select('version_politica, aceptado_en').order('aceptado_en'),
        );
        if (error) {
          return { ok: false, mensaje: mensajeDeError(error) };
        }
        const filas = (data ?? []) as { version_politica: string; aceptado_en: string }[];
        return { ok: true, consentimientos: filas.map((f) => ({ version: f.version_politica, aceptadoEn: f.aceptado_en })) };
      } catch (error) {
        return { ok: false, mensaje: mensajeDeExcepcion(error) };
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

    // Tema de color (migración 005). Leer nunca falla: sin perfil o sin la columna, la app usa el tema del sistema.
    leerTema: async () => {
      try {
        const { data, error } = await leer(() => cliente.from('perfil').select('tema').maybeSingle());
        const tema = error ? null : (data as { tema?: unknown } | null)?.tema;
        return tema === 'sistema' || tema === 'claro' || tema === 'oscuro' ? tema : null;
      } catch {
        return null;
      }
    },

    guardarTema: (tema) =>
      capturar(async () => {
        const usuario = (await cliente.auth.getSession()).data?.user;
        if (!usuario) {
          return { error: { code: 'SIN_SESION' } };
        }
        // Primero se intenta cambiar el tema del perfil existente, sin tocar nombre ni institución.
        const cambio = await cliente.from('perfil').update({ tema }).eq('usuario_id', usuario.id).select('usuario_id');
        if (cambio.error || (cambio.data ?? []).length > 0) {
          return cambio;
        }
        // Todavía no hay perfil: se crea uno mínimo con el nombre de la cuenta.
        return await cliente
          .from('perfil')
          .insert({ usuario_id: usuario.id, nombre_mostrar: (usuario.name || 'Usuario').slice(0, 60), tema });
      }),

    // HU-21: usuario_id lo pone la base de datos y la política RLS solo deja ver y tocar las filas propias.
    listarSimulaciones: async () => {
      try {
        const { data, error } = await leer(() =>
          cliente.from('simulacion').select(COLUMNAS_SIMULACION).order('actualizado_en', { ascending: false }),
        );
        if (error) {
          return { ok: false, mensaje: mensajeDeError(error) };
        }
        const simulaciones = ((data ?? []) as FilaSimulacion[])
          .map(deFilaSimulacion)
          .filter((s): s is SimulacionGuardada => s !== null);
        return { ok: true, simulaciones };
      } catch (error) {
        return { ok: false, mensaje: mensajeDeExcepcion(error) };
      }
    },

    guardarSimulacion: async (nombre, parametros) => {
      try {
        // Sin reintento: repetir el INSERT podría guardar la simulación dos veces.
        const { data, error } = await conTiempo(() =>
          cliente.from('simulacion').insert({ nombre, parametros }).select(COLUMNAS_SIMULACION).single(),
        );
        if (error) {
          return { ok: false, mensaje: mensajeDeError(error) };
        }
        const simulacion = deFilaSimulacion(data as FilaSimulacion);
        return simulacion ? { ok: true, simulacion } : { ok: false, mensaje: mensajeDeError(null) };
      } catch (error) {
        return { ok: false, mensaje: mensajeDeExcepcion(error) };
      }
    },

    renombrarSimulacion: (id: string, nombre: string) =>
      capturar(async () =>
        await cliente.from('simulacion').update({ nombre, actualizado_en: new Date().toISOString() }).eq('id', id),
      ),

    borrarSimulacion: (id: string) => capturar(async () => await cliente.from('simulacion').delete().eq('id', id)),
  };
}
