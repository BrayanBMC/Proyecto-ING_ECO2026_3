import { Enlace } from '../navegacion';

const MODULOS = [
  {
    id: 'simulador',
    titulo: 'Simulador de créditos',
    detalle: 'Francés y Alemán, gracia, abonos extra y alerta de usura.',
    destacado: true,
    ruta: '/simulador',
    accion: 'Abrir simulador',
  },
  {
    id: 'compuesto',
    titulo: 'Interés compuesto',
    detalle: 'Despeja valor futuro, presente, tasa o periodos.',
    ruta: '/interes-compuesto',
    accion: 'Abrir calculadora',
  },
  {
    id: 'anualidades',
    titulo: 'Anualidades',
    detalle: 'Vencidas y anticipadas: S, P y cuota.',
    ruta: '/anualidades',
    accion: 'Abrir calculadora',
  },
  {
    id: 'reparto',
    titulo: 'Reparto proporcional',
    detalle: 'Directo, inverso y compuesto, con suma exacta.',
    ruta: '/reparto',
    accion: 'Abrir calculadora',
  },
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
              <Enlace className="boton" href={modulo.ruta}>
                {modulo.accion}
              </Enlace>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
