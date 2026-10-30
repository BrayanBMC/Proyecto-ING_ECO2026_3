import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  LONGITUD_MINIMA_CONTRASENA,
  VERSION_POLITICA,
  validarCodigo,
  validarRegistro,
  type CampoRegistro,
  type DatosRegistro,
  type ErroresRegistro,
} from '../../core';
import type { ServicioCuenta } from '../../adapters/auth/ServicioCuenta';
import { Enlace } from '../navegacion';

type Paso = 'formulario' | 'codigo' | 'consentimiento' | 'listo';

const ORDEN_CAMPOS: CampoRegistro[] = ['nombre', 'correo', 'contrasena', 'confirmacion', 'aceptaPolitica'];

const VACIO: DatosRegistro = { nombre: '', correo: '', contrasena: '', confirmacion: '', aceptaPolitica: false };

interface Props {
  servicio: ServicioCuenta | null;
}

export function PaginaRegistro({ servicio }: Props) {
  const [paso, setPaso] = useState<Paso>('formulario');
  const [datos, setDatos] = useState<DatosRegistro>(VACIO);
  const [errores, setErrores] = useState<ErroresRegistro>({});
  const [codigo, setCodigo] = useState('');
  const [errorCodigo, setErrorCodigo] = useState<string | null>(null);
  const [alerta, setAlerta] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const formulario = useRef<HTMLFormElement>(null);
  const titulo = useRef<HTMLHeadingElement>(null);

  // Al cambiar de paso, el foco va al título para que el lector de pantalla anuncie el cambio.
  useEffect(() => {
    if (paso !== 'formulario') {
      titulo.current?.focus();
    }
  }, [paso]);

  if (!servicio) {
    return (
      <section className="tarjeta" aria-labelledby="titulo-registro">
        <h1 id="titulo-registro">Crear cuenta</h1>
        <p role="alert" className="alerta">
          El registro no está disponible en este momento. Puedes seguir usando Amortiza como invitado.
        </p>
      </section>
    );
  }

  const correo = datos.correo.trim().toLowerCase();

  const cambiar = <K extends CampoRegistro>(campo: K, valor: DatosRegistro[K]) => {
    setDatos((previo) => ({ ...previo, [campo]: valor }));
    if (errores[campo]) {
      setErrores((previo) => {
        const siguiente = { ...previo };
        delete siguiente[campo];
        return siguiente;
      });
    }
  };

  const enviarFormulario = async (evento: FormEvent) => {
    evento.preventDefault();
    setAlerta(null);
    const validacion = validarRegistro(datos);
    if (!validacion.ok) {
      setErrores(validacion.errores);
      const primero = ORDEN_CAMPOS.find((campo) => validacion.errores[campo]);
      formulario.current?.querySelector<HTMLElement>(`[name="${primero}"]`)?.focus();
      return;
    }
    setErrores({});
    setEnviando(true);
    const resultado = await servicio.registrar({
      nombre: validacion.datos.nombre,
      correo: validacion.datos.correo,
      contrasena: validacion.datos.contrasena,
    });
    setEnviando(false);
    if (resultado.ok) {
      setPaso('codigo');
    } else {
      setAlerta(resultado.mensaje);
    }
  };

  const guardarConsentimiento = async () => {
    const resultado = await servicio.registrarConsentimiento(VERSION_POLITICA);
    if (resultado.ok) {
      setDatos(VACIO); // la contraseña no se queda en memoria
      setPaso('listo');
    } else {
      setPaso('consentimiento');
      setAlerta(resultado.mensaje);
    }
  };

  const enviarCodigo = async (evento: FormEvent) => {
    evento.preventDefault();
    setAlerta(null);
    setAviso(null);
    const validacion = validarCodigo(codigo);
    if (!validacion.ok) {
      setErrorCodigo(validacion.errores);
      return;
    }
    setErrorCodigo(null);
    setEnviando(true);
    const resultado = await servicio.verificarCorreo({ correo, codigo: validacion.datos, contrasena: datos.contrasena });
    if (resultado.ok) {
      await guardarConsentimiento();
    } else {
      setAlerta(resultado.mensaje);
    }
    setEnviando(false);
  };

  const reintentarConsentimiento = async () => {
    setAlerta(null);
    setEnviando(true);
    await guardarConsentimiento();
    setEnviando(false);
  };

  const reenviar = async () => {
    setAlerta(null);
    setAviso(null);
    setEnviando(true);
    const resultado = await servicio.reenviarCodigo(correo);
    setEnviando(false);
    if (resultado.ok) {
      setAviso(`Te enviamos un código nuevo a ${correo}.`);
    } else {
      setAlerta(resultado.mensaje);
    }
  };

  const alertaVisible = alerta && (
    <p role="alert" className="alerta">
      {alerta}
    </p>
  );

  if (paso === 'listo') {
    return (
      <section className="tarjeta" aria-labelledby="titulo-registro">
        <h1 id="titulo-registro" ref={titulo} tabIndex={-1}>
          Tu cuenta está lista
        </h1>
        <p>Verificamos tu correo y guardamos tu aceptación de la política de datos.</p>
        <Enlace className="boton" href="/">
          Ir al inicio
        </Enlace>
      </section>
    );
  }

  if (paso === 'consentimiento') {
    return (
      <section className="tarjeta" aria-labelledby="titulo-registro">
        <h1 id="titulo-registro" ref={titulo} tabIndex={-1}>
          Falta guardar tu aceptación
        </h1>
        <p>Tu correo ya está verificado, pero no pudimos guardar la aceptación de la política de datos.</p>
        {alertaVisible}
        <button type="button" className="boton" onClick={reintentarConsentimiento} disabled={enviando}>
          {enviando ? 'Guardando…' : 'Intentar de nuevo'}
        </button>
      </section>
    );
  }

  if (paso === 'codigo') {
    return (
      <section className="tarjeta" aria-labelledby="titulo-registro">
        <h1 id="titulo-registro" ref={titulo} tabIndex={-1}>
          Revisa tu correo
        </h1>
        <p>
          Enviamos un código a <strong>{correo}</strong>. Escríbelo aquí para confirmar que el correo es tuyo. El código
          vence en 15 minutos.
        </p>
        <form className="formulario" onSubmit={enviarCodigo} noValidate>
          <div className="campo">
            <label htmlFor="codigo">Código de verificación</label>
            <input
              id="codigo"
              name="codigo"
              className="mono"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={8}
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              aria-invalid={errorCodigo ? true : undefined}
              aria-describedby={errorCodigo ? 'codigo-error' : undefined}
            />
            {errorCodigo && (
              <p id="codigo-error" className="campo__error">
                {errorCodigo}
              </p>
            )}
          </div>
          {alertaVisible}
          {aviso && (
            <p role="status" className="aviso">
              {aviso}
            </p>
          )}
          <div className="acciones">
            <button type="submit" className="boton" disabled={enviando}>
              {enviando ? 'Verificando…' : 'Verificar correo'}
            </button>
            <button type="button" className="boton boton--secundario" onClick={reenviar} disabled={enviando}>
              Enviar otro código
            </button>
          </div>
        </form>
      </section>
    );
  }

  const describir = (campo: CampoRegistro, ayuda?: string) =>
    [ayuda, errores[campo] ? `${campo}-error` : undefined].filter(Boolean).join(' ') || undefined;

  const error = (campo: CampoRegistro) =>
    errores[campo] && (
      <p id={`${campo}-error`} className="campo__error">
        {errores[campo]}
      </p>
    );

  return (
    <section className="tarjeta" aria-labelledby="titulo-registro">
      <h1 id="titulo-registro">Crear cuenta</h1>
      <p className="tarjeta__texto">Con una cuenta guardas tus simulaciones. Sin cuenta puedes calcular y exportar igual.</p>
      <form ref={formulario} className="formulario" onSubmit={enviarFormulario} noValidate>
        <div className="campo">
          <label htmlFor="nombre">Nombre</label>
          <input
            id="nombre"
            name="nombre"
            autoComplete="name"
            value={datos.nombre}
            onChange={(e) => cambiar('nombre', e.target.value)}
            aria-invalid={errores.nombre ? true : undefined}
            aria-describedby={describir('nombre')}
          />
          {error('nombre')}
        </div>

        <div className="campo">
          <label htmlFor="correo">Correo electrónico</label>
          <input
            id="correo"
            name="correo"
            type="email"
            autoComplete="email"
            value={datos.correo}
            onChange={(e) => cambiar('correo', e.target.value)}
            aria-invalid={errores.correo ? true : undefined}
            aria-describedby={describir('correo')}
          />
          {error('correo')}
        </div>

        <div className="campo">
          <label htmlFor="contrasena">Contraseña</label>
          <input
            id="contrasena"
            name="contrasena"
            type="password"
            autoComplete="new-password"
            value={datos.contrasena}
            onChange={(e) => cambiar('contrasena', e.target.value)}
            aria-invalid={errores.contrasena ? true : undefined}
            aria-describedby={describir('contrasena', 'contrasena-ayuda')}
          />
          <p id="contrasena-ayuda" className="campo__ayuda">
            Mínimo {LONGITUD_MINIMA_CONTRASENA} caracteres. Una frase larga es más segura que una palabra con símbolos.
          </p>
          {error('contrasena')}
        </div>

        <div className="campo">
          <label htmlFor="confirmacion">Repite la contraseña</label>
          <input
            id="confirmacion"
            name="confirmacion"
            type="password"
            autoComplete="new-password"
            value={datos.confirmacion}
            onChange={(e) => cambiar('confirmacion', e.target.value)}
            aria-invalid={errores.confirmacion ? true : undefined}
            aria-describedby={describir('confirmacion')}
          />
          {error('confirmacion')}
        </div>

        <div className="campo campo--casilla">
          <input
            id="aceptaPolitica"
            name="aceptaPolitica"
            type="checkbox"
            checked={datos.aceptaPolitica}
            onChange={(e) => cambiar('aceptaPolitica', e.target.checked)}
            aria-invalid={errores.aceptaPolitica ? true : undefined}
            aria-describedby={describir('aceptaPolitica')}
          />
          <label htmlFor="aceptaPolitica">
            Autorizo el tratamiento de mis datos según la{' '}
            <a href="/politica-de-datos" target="_blank" rel="noopener">
              política de tratamiento de datos
            </a>{' '}
            (versión {VERSION_POLITICA}).
          </label>
          {error('aceptaPolitica')}
        </div>

        {alertaVisible}

        <button type="submit" className="boton" disabled={enviando}>
          {enviando ? 'Creando cuenta…' : 'Crear cuenta'}
        </button>
      </form>
    </section>
  );
}
