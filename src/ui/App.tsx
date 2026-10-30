import { useCallback, useEffect, useState } from 'react';
import type { ServicioCuenta, Usuario } from '../adapters/auth/ServicioCuenta';
import { Enlace, navegar, useRuta } from './navegacion';
import { PaginaIniciarSesion } from './paginas/IniciarSesion';
import { PaginaInicio } from './paginas/Inicio';
import { PaginaPerfil } from './paginas/Perfil';
import { PaginaPolitica } from './paginas/PoliticaDatos';
import { PaginaRecuperar } from './paginas/RecuperarContrasena';
import { PaginaRegistro } from './paginas/Registro';
import { PaginaSimulador } from './paginas/Simulador';

export const NOMBRE_APP = 'Amortiza';

interface Props {
  /** Servicio de cuentas. Es null si el build no trae las URL de Neon. */
  servicioCuenta?: ServicioCuenta | null;
}

interface PropsPagina {
  ruta: string;
  servicioCuenta: ServicioCuenta | null;
  usuario: Usuario | null;
  alCambiarSesion: () => Promise<void>;
}

function Pagina({ ruta, servicioCuenta, usuario, alCambiarSesion }: PropsPagina) {
  switch (ruta.replace(/\/+$/, '') || '/') {
    case '/':
      return <PaginaInicio />;
    case '/registro':
      return <PaginaRegistro servicio={servicioCuenta} alCambiarSesion={alCambiarSesion} />;
    case '/iniciar-sesion':
      return <PaginaIniciarSesion servicio={servicioCuenta} alCambiarSesion={alCambiarSesion} />;
    case '/recuperar-contrasena':
      return <PaginaRecuperar servicio={servicioCuenta} />;
    case '/simulador':
      return <PaginaSimulador servicio={servicioCuenta} usuario={usuario} />;
    case '/perfil':
      return <PaginaPerfil servicio={servicioCuenta} usuario={usuario} alCambiarSesion={alCambiarSesion} />;
    case '/cuenta-eliminada':
      return (
        <section className="tarjeta" aria-labelledby="titulo-eliminada">
          <h1 id="titulo-eliminada">Tu cuenta fue eliminada</h1>
          <p>Borramos tu cuenta, tu perfil y tus consentimientos. Puedes seguir usando Amortiza como invitado.</p>
          <Enlace className="boton" href="/">
            Ir al inicio
          </Enlace>
        </section>
      );
    case '/politica-de-datos':
      return <PaginaPolitica />;
    default:
      return (
        <section className="tarjeta" aria-labelledby="titulo-404">
          <h1 id="titulo-404">Página no encontrada</h1>
          <p>La dirección no existe.</p>
          <Enlace className="boton" href="/">
            Ir al inicio
          </Enlace>
        </section>
      );
  }
}

export function App({ servicioCuenta = null }: Props) {
  const ruta = useRuta();
  const [usuario, setUsuario] = useState<Usuario | null>(null);

  const actualizarSesion = useCallback(async () => {
    setUsuario(servicioCuenta ? await servicioCuenta.sesionActual() : null);
  }, [servicioCuenta]);

  // HU-02: al abrir la app se consulta si hay sesión; si no, se entra como invitado.
  useEffect(() => {
    void servicioCuenta?.sesionActual().then(setUsuario);
  }, [servicioCuenta]);

  const cerrarSesion = async () => {
    await servicioCuenta?.cerrarSesion();
    setUsuario(null);
    navegar('/');
  };

  return (
    <>
      <a className="saltar" href="#contenido">
        Saltar al contenido
      </a>
      <header className="cabecera">
        <Enlace className="marca" href="/" aria-label={`${NOMBRE_APP}, ir al inicio`}>
          <span className="marca__logo" aria-hidden="true" />
          <span className="marca__nombre">{NOMBRE_APP}</span>
        </Enlace>
        <nav className="cabecera__acciones" aria-label="Cuenta">
          {usuario ? (
            <>
              <span className="etiqueta-modo">Hola, {usuario.nombre}</span>
              <Enlace className="boton boton--pequeno boton--secundario" href="/perfil">
                Mi perfil
              </Enlace>
              <button type="button" className="boton boton--pequeno boton--secundario" onClick={cerrarSesion}>
                Cerrar sesión
              </button>
            </>
          ) : (
            <>
              <span className="etiqueta-modo" role="status">
                Invitado: no se guarda nada
              </span>
              {ruta !== '/iniciar-sesion' && (
                <Enlace className="boton boton--pequeno boton--secundario" href="/iniciar-sesion">
                  Iniciar sesión
                </Enlace>
              )}
              {ruta !== '/registro' && (
                <Enlace className="boton boton--pequeno" href="/registro">
                  Crear cuenta
                </Enlace>
              )}
            </>
          )}
        </nav>
      </header>

      <main id="contenido" className="contenido" tabIndex={-1}>
        <Pagina ruta={ruta} servicioCuenta={servicioCuenta} usuario={usuario} alCambiarSesion={actualizarSesion} />
      </main>

      <footer className="pie">
        <p>Proyecto académico de Ingeniería Económica.</p>
      </footer>
    </>
  );
}
