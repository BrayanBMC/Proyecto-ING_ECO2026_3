import type { ServicioCuenta } from '../adapters/auth/ServicioCuenta';
import { Enlace, useRuta } from './navegacion';
import { PaginaInicio } from './paginas/Inicio';
import { PaginaPolitica } from './paginas/PoliticaDatos';
import { PaginaRegistro } from './paginas/Registro';

export const NOMBRE_APP = 'Amortiza';

interface Props {
  /** Servicio de cuentas. Es null si el build no trae las URL de Neon. */
  servicioCuenta?: ServicioCuenta | null;
}

function Pagina({ ruta, servicioCuenta }: { ruta: string; servicioCuenta: ServicioCuenta | null }) {
  switch (ruta.replace(/\/+$/, '') || '/') {
    case '/':
      return <PaginaInicio />;
    case '/registro':
      return <PaginaRegistro servicio={servicioCuenta} />;
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
          <span className="etiqueta-modo" role="status">
            Invitado: no se guarda nada
          </span>
          {ruta !== '/registro' && (
            <Enlace className="boton boton--pequeno" href="/registro">
              Crear cuenta
            </Enlace>
          )}
        </nav>
      </header>

      <main id="contenido" className="contenido" tabIndex={-1}>
        <Pagina ruta={ruta} servicioCuenta={servicioCuenta} />
      </main>

      <footer className="pie">
        <p>Proyecto académico de Ingeniería Económica.</p>
      </footer>
    </>
  );
}
