import { useState, type FormEvent } from 'react';
import {
  calcularAnualidad,
  nombreFrecuencia,
  type ErroresAnualidad,
  type EscalaMonetaria,
  type FormularioAnualidad,
  type ObjetivoAnualidad,
  type ResultadoAnualidad,
} from '../../core';
import { Campo } from '../Campo';
import { Ayuda } from '../ayuda/Ayuda';
import { CamposTasa, SelectorEscala, SelectorFrecuencia } from '../CamposTasa';
import { pesos, porcentaje } from '../formato';
import { Pasos } from '../Pasos';

const INICIAL: FormularioAnualidad = {
  objetivo: 'valores',
  valor: '',
  n: '',
  tasa: '',
  tipoTasa: 'efectiva',
  frecuenciaTasa: 12,
  frecuenciaPago: 12,
};

const OBJETIVOS: { valor: ObjetivoAnualidad; nombre: string; campo: string }[] = [
  { valor: 'valores', nombre: 'Calcular S y P a partir de la cuota (A)', campo: 'Cuota periódica A ($)' },
  { valor: 'cuota-desde-s', nombre: 'Calcular la cuota (A) para una meta S', campo: 'Valor futuro meta S ($)' },
  { valor: 'cuota-desde-p', nombre: 'Calcular la cuota (A) para un valor presente P', campo: 'Valor presente P ($)' },
];

/** HU-19: anualidades vencidas y anticipadas, lado a lado. */
export function PaginaAnualidades() {
  const [f, setF] = useState<FormularioAnualidad>(INICIAL);
  const [escala, setEscala] = useState<EscalaMonetaria>(0);
  const [errores, setErrores] = useState<ErroresAnualidad>({});
  const [resultado, setResultado] = useState<ResultadoAnualidad | null>(null);

  const cambiar = <K extends keyof FormularioAnualidad>(campo: K, valor: FormularioAnualidad[K]) => {
    setF((previo) => ({ ...previo, [campo]: valor }));
    setResultado(null);
  };

  const calcular = (evento: FormEvent) => {
    evento.preventDefault();
    const r = calcularAnualidad(f, (monto) => pesos(monto, escala));
    if (r.ok) {
      setErrores({});
      setResultado(r.datos);
    } else {
      setErrores(r.errores);
      setResultado(null);
    }
  };

  const periodo = nombreFrecuencia(f.frecuenciaPago).periodo;
  const campoValor = OBJETIVOS.find((o) => o.valor === f.objetivo)!.campo;

  return (
    <div className="pila">
      <section className="tarjeta tarjeta--ancha" aria-labelledby="titulo-anualidades">
        <h1 id="titulo-anualidades">Anualidades</h1>
        <p className="tarjeta__texto">
          Pagos iguales al final de cada periodo (vencida) o al inicio (anticipada). Verás las dos al mismo tiempo para compararlas.
        </p>
        <form className="formulario formulario--rejilla" onSubmit={calcular} noValidate>
          <fieldset className="opciones">
            <legend>
              ¿Qué quieres calcular? <Ayuda id="objetivoAnualidad" />
            </legend>
            {OBJETIVOS.map((o) => (
              <label key={o.valor}>
                <input
                  type="radio"
                  name="objetivo"
                  checked={f.objetivo === o.valor}
                  onChange={() => {
                    cambiar('objetivo', o.valor);
                    setErrores({});
                  }}
                />{' '}
                {o.nombre}
              </label>
            ))}
          </fieldset>
          <Campo
            nombre="valor"
            etiqueta={campoValor}
            inputMode="numeric"
            placeholder="500.000"
            valor={f.valor}
            alCambiar={(v) => cambiar('valor', v)}
            error={errores.valor}
            termino={f.objetivo === 'valores' ? 'cuotaA' : f.objetivo === 'cuota-desde-s' ? 'metaS' : 'valorPresenteP'}
          />
          <Campo
            nombre="n"
            etiqueta="Número de pagos (n)"
            inputMode="numeric"
            placeholder="12"
            valor={f.n}
            alCambiar={(v) => cambiar('n', v)}
            error={errores.n}
            ayuda="Entero entre 1 y 360."
            termino="numPagos"
          />
          <SelectorFrecuencia
            id="frecuenciaPago"
            etiqueta="Frecuencia de pago"
            valor={f.frecuenciaPago}
            alCambiar={(v) => cambiar('frecuenciaPago', v)}
            termino="frecuenciaPago"
          />
          <CamposTasa
            tasa={f.tasa}
            tipo={f.tipoTasa}
            frecuencia={f.frecuenciaTasa}
            error={errores.tasa}
            alCambiarTasa={(v) => cambiar('tasa', v)}
            alCambiarTipo={(v) => cambiar('tipoTasa', v)}
            alCambiarFrecuencia={(v) => cambiar('frecuenciaTasa', v)}
          />
          <SelectorEscala
            escala={escala}
            alCambiar={(nueva) => {
              setEscala(nueva);
              setResultado(null);
            }}
          />
          <button type="submit" className="boton">
            Calcular
          </button>
        </form>
        {errores.general && (
          <p role="alert" className="alerta">
            {errores.general}
          </p>
        )}
      </section>

      {resultado && (
        <section className="tarjeta tarjeta--ancha" aria-labelledby="titulo-resultado-anualidades">
          <div className="titulo-ayuda">
            <h2 id="titulo-resultado-anualidades">Vencida frente a anticipada</h2>
            <Ayuda id="anualidadVencidaAnticipada" />
          </div>
          <dl className="cifras">
            <div>
              <dt>
                Tasa por {periodo} <Ayuda id="tasaPeriodica" />
              </dt>
              <dd>{porcentaje(resultado.tasaPeriodica, 4)}</dd>
            </div>
            <div>
              <dt>
                Efectiva anual (EA) <Ayuda id="ea" />
              </dt>
              <dd>{porcentaje(resultado.ea, 4)}</dd>
            </div>
          </dl>
          <div className="tabla-contenedor" tabIndex={0} role="region" aria-label="Resultados de las anualidades">
            <table className="tabla">
              <caption className="sr-solo">Cuota, valor futuro y valor presente con pagos vencidos y anticipados</caption>
              <thead>
                <tr>
                  <th scope="col">Concepto</th>
                  <th scope="col">Pagos vencidos</th>
                  <th scope="col">Pagos anticipados</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">Cuota (A)</th>
                  <td>{pesos(resultado.filas[0].cuota, escala)}</td>
                  <td>{pesos(resultado.filas[1].cuota, escala)}</td>
                </tr>
                <tr>
                  <th scope="row">Valor futuro (S)</th>
                  <td>{pesos(resultado.filas[0].futuro, escala)}</td>
                  <td>{pesos(resultado.filas[1].futuro, escala)}</td>
                </tr>
                <tr>
                  <th scope="row">Valor presente (P)</th>
                  <td>{pesos(resultado.filas[0].presente, escala)}</td>
                  <td>{pesos(resultado.filas[1].presente, escala)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <Pasos titulo="¿Cómo se calculó?" pasos={resultado.pasos} />
        </section>
      )}
    </div>
  );
}
