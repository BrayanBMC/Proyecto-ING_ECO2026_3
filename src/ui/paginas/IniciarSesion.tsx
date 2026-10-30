import { useState, type FormEvent } from 'react';
import { validarInicioSesion, type ErroresInicioSesion } from '../../core';
import type { ServicioCuenta } from '../../adapters/auth/ServicioCuenta';
import { Campo } from '../Campo';
import { Enlace, navegar } from '../navegacion';

interface Props {
  servicio: ServicioCuenta | null;
  alCambiarSesion: () => Promise<void>;
}

/** HU-02: iniciar sesión con correo y contraseña. */
export function PaginaIniciarSesion({ servicio, alCambiarSesion }: Props) {
  const [correo, setCorreo] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [errores, setErrores] = useState<ErroresInicioSesion>({});
  const [alerta, setAlerta] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  if (!servicio) {
    return (
      <section className="tarjeta" aria-labelledby="titulo-sesion">
        <h1 id="titulo-sesion">Iniciar sesión</h1>
        <p role="alert" className="alerta">
          El inicio de sesión no está disponible en este momento. Puedes seguir usando Amortiza como invitado.
        </p>
      </section>
    );
  }

  const enviar = async (evento: FormEvent) => {
    evento.preventDefault();
    setAlerta(null);
    const validacion = validarInicioSesion({ correo, contrasena });
    if (!validacion.ok) {
      setErrores(validacion.errores);
      return;
    }
    setErrores({});
    setEnviando(true);
    const resultado = await servicio.iniciarSesion(validacion.datos.correo, validacion.datos.contrasena);
    if (resultado.ok) {
      await alCambiarSesion();
      navegar('/');
      return;
    }
    setEnviando(false);
    setAlerta(resultado.mensaje);
  };

  return (
    <section className="tarjeta" aria-labelledby="titulo-sesion">
      <h1 id="titulo-sesion">Iniciar sesión</h1>
      <form className="formulario" onSubmit={enviar} noValidate>
        <Campo
          nombre="correo"
          etiqueta="Correo electrónico"
          type="email"
          autoComplete="email"
          valor={correo}
          alCambiar={setCorreo}
          error={errores.correo}
        />
        <Campo
          nombre="contrasena"
          etiqueta="Contraseña"
          type="password"
          autoComplete="current-password"
          valor={contrasena}
          alCambiar={setContrasena}
          error={errores.contrasena}
        />
        {alerta && (
          <p role="alert" className="alerta">
            {alerta}
          </p>
        )}
        <button type="submit" className="boton" disabled={enviando}>
          {enviando ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
      <p>
        <Enlace href="/recuperar-contrasena">¿Olvidaste tu contraseña?</Enlace>
      </p>
      <p>
        ¿No tienes cuenta? <Enlace href="/registro">Crear cuenta</Enlace>
      </p>
    </section>
  );
}
