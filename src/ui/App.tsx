export const NOMBRE_APP = 'Amortiza';

const MODULOS = [
  {
    id: 'simulador',
    titulo: 'Simulador de créditos',
    detalle: 'Francés y Alemán, gracia, abonos extra y alerta de usura.',
    destacado: true,
  },
  { id: 'compuesto', titulo: 'Interés compuesto', detalle: 'Despeja valor futuro, presente, tasa o periodos.' },
  { id: 'anualidades', titulo: 'Anualidades', detalle: 'Vencidas y anticipadas: S, P y cuota.' },
  { id: 'reparto', titulo: 'Reparto proporcional', detalle: 'Directo, inverso y compuesto, con suma exacta.' },
] as const;

export function App() {
  return (
    <>
      <a className="saltar" href="#contenido">
        Saltar al contenido
      </a>
      <header className="cabecera">
        <div className="marca">
          <span className="marca__logo" aria-hidden="true" />
          <span className="marca__nombre">{NOMBRE_APP}</span>
        </div>
        <span className="etiqueta-modo" role="status">
          Invitado: no se guarda nada
        </span>
      </header>

      <main id="contenido" className="contenido">
        <section className="presentacion" aria-labelledby="titulo-principal">
          <h1 id="titulo-principal">Simula tu crédito y entiende cada cuota</h1>
          <p className="presentacion__texto">
            Calcula tablas de amortización, tasas e intereses en pesos colombianos, y mira la fórmula detrás de cada
            resultado.
          </p>
        </section>

        <section aria-labelledby="titulo-modulos">
          <h2 id="titulo-modulos" className="titulo-seccion">
            Módulos
          </h2>
          <ul className="bento">
            {MODULOS.map((modulo) => (
              <li key={modulo.id} className={'destacado' in modulo ? 'bento__celda bento__celda--grande' : 'bento__celda'}>
                <h3 className="bento__titulo">{modulo.titulo}</h3>
                <p className="bento__detalle">{modulo.detalle}</p>
                <span className="bento__estado">En construcción</span>
              </li>
            ))}
          </ul>
        </section>
      </main>

      <footer className="pie">
        <p>
          Proyecto académico de Ingeniería Económica.
        </p>
      </footer>
    </>
  );
}
