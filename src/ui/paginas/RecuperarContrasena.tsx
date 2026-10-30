import { useState, type FormEvent } from 'react';
import { LONGITUD_MINIMA_CONTRASENA, validarCorreo, validarRestablecimiento, type ErroresRestablecimiento } from '../../core';
import type { ServicioCuenta } from '../../adapters/auth/ServicioCuenta';
import { Campo } from '../Campo';
import { Enlace } from '../navegacion';

type Paso = 'correo' | 'codigo' | 'listo';

interface Props {
  servicio: ServicioCuenta | null;
}

/**
 * HU-03: recuperar la contraseña con un código enviado al correo.
 * Se usa código y no enlace porque el correo compartido de Neon solo envía códigos (igual que en HU-01).
 */
export function PaginaRecuperar({ servicio }: Props) {
  const [paso, setPaso] = useState<Paso>('correo');
  const [correo, setCorreo] = useState('');
  const [errorCorreo, setErrorCorreo] = useState<string | undefined>();
  const [codigo, setCodigo] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [errores, setErrores] = useState<ErroresRestablecimiento>({});
  const [alerta, setAlerta] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  if (!servicio) {
    return (
      <section className="tarjeta" aria-labelledby="titulo-recuperar">
        <h1 id="titulo-recuperar">Recuperar contraseña</h1>
        <p role="alert" className="alerta">
          La recuperación de contraseña no está disponible en este momento.
        </p>
      </section>
    );
  }

  const correoLimpio = correo.trim().toLowerCase();

  const pedirCodigo = async () => {
    setAlerta(null);
    setEnviando(true);
    const resultado = await servicio.pedirCodigoRecuperacion(correoLimpio);
    setEnviando(false);
    if (!resultado.ok) {
      setAlerta(resultado.mensaje);
      return false;
    }
    return true;
  };

  const enviarCorreo = async (evento: FormEvent) => {
    evento.preventDefault();
    const validacion = validarCorreo(correo);
    if (!validacion.ok) {
      setErrorCorreo(validacion.errores);
      return;
    }
    setErrorCorreo(undefined);
    if (await pedirCodigo()) {
      setPaso('codigo');
    }
  };

  const reenviar = async () => {
    setAviso(null);
    if (await pedirCodigo()) {
      setAviso(`Te enviamos un código nuevo a ${correoLimpio}.`);
    }
  };

  const enviarNueva = async (evento: FormEvent) => {
    evento.preventDefault();
    setAlerta(null);
    setAviso(null);
    const validacion = validarRestablecimiento({ codigo, contrasena, confirmacion });
    if (!validacion.ok) {
      setErrores(validacion.errores);
      return;
    }
    setErrores({});
    setEnviando(true);
    const resultado = await servicio.restablecerContrasena({
      correo: correoLimpio,
      codigo: validacion.datos.codigo,
      contrasena: validacion.datos.contrasena,
    });
    setEnviando(false);
    if (resultado.ok) {
      setContrasena('');
      setConfirmacion('');
      setPaso('listo');
    } else {
      setAlerta(resultado.mensaje);
    }
  };

  if (paso === 'listo') {
    return (
      <section className="tarjeta" aria-labelledby="titulo-recuperar">
        <h1 id="titulo-recuperar">Contraseña actualizada</h1>
        <p>Ya puedes entrar con tu nueva contraseña.</p>
        <Enlace className="boton" href="/iniciar-sesion">
          Iniciar sesión
        </Enlace>
      </section>
    );
  }

  const alertaVisible = alerta && (
    <p role="alert" className="alerta">
      {alerta}
    </p>
  );

  if (paso === 'codigo') {
    return (
      <section className="tarjeta" aria-labelledby="titulo-recuperar">
        <h1 id="titulo-recuperar">Escribe el código y tu nueva contraseña</h1>
        <p>
          Si <strong>{correoLimpio}</strong> tiene una cuenta, le enviamos un código. Vence en 15 minutos.
        </p>
        <form className="formulario" onSubmit={enviarNueva} noValidate>
          <Campo
            nombre="codigo"
            etiqueta="Código"
            className="mono"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={8}
            valor={codigo}
            alCambiar={setCodigo}
            error={errores.codigo}
          />
          <Campo
            nombre="contrasena"
            etiqueta="Nueva contraseña"
            type="password"
            autoComplete="new-password"
            valor={contrasena}
            alCambiar={setContrasena}
            error={errores.contrasena}
            ayuda={`Mínimo ${LONGITUD_MINIMA_CONTRASENA} caracteres.`}
          />
          <Campo
            nombre="confirmacion"
            etiqueta="Repite la nueva contraseña"
            type="password"
            autoComplete="new-password"
            valor={confirmacion}
            alCambiar={setConfirmacion}
            error={errores.confirmacion}
          />
          {alertaVisible}
          {aviso && (
            <p role="status" className="aviso">
              {aviso}
            </p>
          )}
          <div className="acciones">
            <button type="submit" className="boton" disabled={enviando}>
              {enviando ? 'Guardando…' : 'Cambiar contraseña'}
            </button>
            <button type="button" className="boton boton--secundario" onClick={reenviar} disabled={enviando}>
              Enviar otro código
            </button>
          </div>
        </form>
      </section>
    );
  }

  return (
    <section className="tarjeta" aria-labelledby="titulo-recuperar">
      <h1 id="titulo-recuperar">Recuperar contraseña</h1>
      <p className="tarjeta__texto">Te enviaremos un código al correo para que definas una nueva contraseña.</p>
      <form className="formulario" onSubmit={enviarCorreo} noValidate>
        <Campo
          nombre="correo"
          etiqueta="Correo electrónico"
          type="email"
          autoComplete="email"
          valor={correo}
          alCambiar={setCorreo}
          error={errorCorreo}
        />
        {alertaVisible}
        <button type="submit" className="boton" disabled={enviando}>
          {enviando ? 'Enviando…' : 'Enviar código'}
        </button>
      </form>
    </section>
  );
}
