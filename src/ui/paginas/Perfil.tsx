import { useEffect, useState, type FormEvent } from 'react';
import {
  armarExportacion,
  perfilInicial,
  validarPerfil,
  type ErroresPerfil,
  type FormularioPerfil,
  type Perfil,
} from '../../core';
import type { ServicioCuenta, Usuario } from '../../adapters/auth/ServicioCuenta';
import { Campo } from '../Campo';
import { descargarJson } from '../descargar';
import { Enlace, navegar } from '../navegacion';

interface Props {
  servicio: ServicioCuenta | null;
  usuario: Usuario | null;
  alCambiarSesion: () => Promise<void>;
  /** Se puede reemplazar en las pruebas. */
  descargar?: (nombreArchivo: string, datos: unknown) => void;
}

const aFormulario = (perfil: Perfil): FormularioPerfil => ({
  ...perfil,
  institucion: perfil.institucion ?? '',
  programa: perfil.programa ?? '',
});

/** HU-04 (perfil) y HU-05 (descargar mis datos, eliminar mi cuenta). */
export function PaginaPerfil({ servicio, usuario, alCambiarSesion, descargar = descargarJson }: Props) {
  const [formulario, setFormulario] = useState<FormularioPerfil | null>(null);
  const [errores, setErrores] = useState<ErroresPerfil>({});
  const [alerta, setAlerta] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [contrasena, setContrasena] = useState('');
  const [alertaEliminar, setAlertaEliminar] = useState<string | null>(null);

  useEffect(() => {
    if (!servicio || !usuario) {
      return;
    }
    void servicio.leerPerfil().then((resultado) => {
      if (resultado.ok) {
        setFormulario(aFormulario(resultado.perfil ?? perfilInicial(usuario.nombre)));
      } else {
        setAlerta(resultado.mensaje);
      }
    });
  }, [servicio, usuario]);

  if (!servicio || !usuario) {
    return (
      <section className="tarjeta" aria-labelledby="titulo-perfil">
        <h1 id="titulo-perfil">Mi perfil</h1>
        <p>Inicia sesión para ver tu perfil. Sin cuenta puedes seguir usando Amortiza como invitado.</p>
        <Enlace className="boton" href="/iniciar-sesion">
          Iniciar sesión
        </Enlace>
      </section>
    );
  }

  const cambiar = <K extends keyof FormularioPerfil>(campo: K, valor: FormularioPerfil[K]) =>
    setFormulario((previo) => (previo ? { ...previo, [campo]: valor } : previo));

  const guardar = async (evento: FormEvent) => {
    evento.preventDefault();
    if (!formulario) {
      return;
    }
    setAlerta(null);
    setAviso(null);
    const validacion = validarPerfil(formulario);
    if (!validacion.ok) {
      setErrores(validacion.errores);
      return;
    }
    setErrores({});
    setEnviando(true);
    const resultado = await servicio.guardarPerfil(validacion.datos);
    setEnviando(false);
    if (resultado.ok) {
      setAviso('Perfil guardado.');
      await alCambiarSesion();
    } else {
      setAlerta(resultado.mensaje);
    }
  };

  const descargarDatos = async () => {
    setAlerta(null);
    const [perfil, consentimientos] = await Promise.all([servicio.leerPerfil(), servicio.leerConsentimientos()]);
    if (!perfil.ok) {
      setAlerta(perfil.mensaje);
      return;
    }
    if (!consentimientos.ok) {
      setAlerta(consentimientos.mensaje);
      return;
    }
    const generadoEn = new Date();
    descargar(
      `amortiza-mis-datos-${generadoEn.toISOString().slice(0, 10)}.json`,
      armarExportacion({ correo: usuario.correo, perfil: perfil.perfil, consentimientos: consentimientos.consentimientos, generadoEn }),
    );
  };

  const eliminar = async (evento: FormEvent) => {
    evento.preventDefault();
    setAlertaEliminar(null);
    if (!contrasena) {
      setAlertaEliminar('Escribe tu contraseña para confirmar.');
      return;
    }
    setEnviando(true);
    const resultado = await servicio.eliminarCuenta(usuario.correo, contrasena);
    setEnviando(false);
    if (resultado.ok) {
      await alCambiarSesion();
      navegar('/cuenta-eliminada');
    } else {
      setAlertaEliminar(resultado.mensaje);
    }
  };

  return (
    <div className="pila">
      <section className="tarjeta" aria-labelledby="titulo-perfil">
        <h1 id="titulo-perfil">Mi perfil</h1>
        <p className="tarjeta__texto">Correo: {usuario.correo}</p>
        {alerta && (
          <p role="alert" className="alerta">
            {alerta}
          </p>
        )}
        {!formulario ? (
          !alerta && <p>Cargando tu perfil…</p>
        ) : (
          <form className="formulario" onSubmit={guardar} noValidate>
            <Campo
              nombre="nombre"
              etiqueta="Nombre"
              autoComplete="name"
              valor={formulario.nombre}
              alCambiar={(v) => cambiar('nombre', v)}
              error={errores.nombre}
            />
            <Campo
              nombre="institucion"
              etiqueta="Institución (opcional)"
              autoComplete="organization"
              valor={formulario.institucion}
              alCambiar={(v) => cambiar('institucion', v)}
              error={errores.institucion}
            />
            <Campo
              nombre="programa"
              etiqueta="Programa (opcional)"
              valor={formulario.programa}
              alCambiar={(v) => cambiar('programa', v)}
              error={errores.programa}
            />
            <fieldset className="opciones">
              <legend>Decimales en los montos</legend>
              <label>
                <input
                  type="radio"
                  name="escala"
                  checked={formulario.escala === 0}
                  onChange={() => cambiar('escala', 0)}
                />{' '}
                Sin decimales ($ 916.800)
              </label>
              <label>
                <input
                  type="radio"
                  name="escala"
                  checked={formulario.escala === 2}
                  onChange={() => cambiar('escala', 2)}
                />{' '}
                2 decimales ($ 916.799,92)
              </label>
            </fieldset>
            <fieldset className="opciones">
              <legend>Días del año para tasas diarias</legend>
              <label>
                <input
                  type="radio"
                  name="baseDiaria"
                  checked={formulario.baseDiaria === 360}
                  onChange={() => cambiar('baseDiaria', 360)}
                />{' '}
                360 (comercial)
              </label>
              <label>
                <input
                  type="radio"
                  name="baseDiaria"
                  checked={formulario.baseDiaria === 365}
                  onChange={() => cambiar('baseDiaria', 365)}
                />{' '}
                365 (calendario)
              </label>
            </fieldset>
            {aviso && (
              <p role="status" className="aviso">
                {aviso}
              </p>
            )}
            <button type="submit" className="boton" disabled={enviando}>
              {enviando ? 'Guardando…' : 'Guardar perfil'}
            </button>
          </form>
        )}
      </section>

      <section className="tarjeta" aria-labelledby="titulo-datos">
        <h2 id="titulo-datos">Tus datos personales</h2>
        <p className="tarjeta__texto">
          Puedes descargar todo lo que guardamos de ti o borrar tu cuenta. Ver la{' '}
          <Enlace href="/politica-de-datos">política de datos</Enlace>.
        </p>
        <button type="button" className="boton boton--secundario" onClick={descargarDatos}>
          Descargar mis datos
        </button>

        <form className="formulario zona-peligro" onSubmit={eliminar} noValidate>
          <h3>Eliminar mi cuenta</h3>
          <p>Se borran tu cuenta, tu perfil y tus consentimientos. No se puede deshacer.</p>
          <Campo
            nombre="contrasena-eliminar"
            etiqueta="Tu contraseña, para confirmar"
            type="password"
            autoComplete="current-password"
            valor={contrasena}
            alCambiar={setContrasena}
          />
          {alertaEliminar && (
            <p role="alert" className="alerta">
              {alertaEliminar}
            </p>
          )}
          <button type="submit" className="boton boton--peligro" disabled={enviando}>
            Eliminar mi cuenta
          </button>
        </form>
      </section>
    </div>
  );
}
