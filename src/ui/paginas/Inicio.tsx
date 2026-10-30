import { Enlace } from '../navegacion';

const MODULOS = [
  {
    id: 'simulador',
    titulo: 'Simulador de créditos',
    detalle: 'Francés y Alemán, gracia, abonos extra y alerta de usura.',
    destacado: true,
    ruta: '/simulador',
  },
  { id: 'compuesto', titulo: 'Interés compuesto', detalle: 'Despeja valor futuro, presente, tasa o periodos.' },
  { id: 'anualidades', titulo: 'Anualidades', detalle: 'Vencidas y anticipadas: S, P y cuota.' },
  { id: 'reparto', titulo: 'Reparto proporcional', detalle: 'Directo, inverso y compuesto, con suma exacta.' },
] as const;

export function PaginaInicio() {
  return (
    <>
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
              {'ruta' in modulo ? (
                <Enlace className="boton" href={modulo.ruta}>
                  Abrir simulador
                </Enlace>
              ) : (
                <span className="bento__estado">En construcción</span>
              )}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
