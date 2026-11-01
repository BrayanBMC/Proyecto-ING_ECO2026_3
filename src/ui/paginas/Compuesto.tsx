import { useState, type FormEvent } from 'react';
import {
  calcularCompuesto,
  cuatroDecimales,
  nombreFrecuencia,
  type EscalaMonetaria,
  type ErroresCompuesto,
  type FormularioCompuesto,
  type Incognita,
  type ResultadoCompuesto,
} from '../../core';
import { Campo } from '../Campo';
import { Ayuda } from '../ayuda/Ayuda';
import { CamposTasa, SelectorEscala, SelectorFrecuencia } from '../CamposTasa';
import { pesos, porcentaje } from '../formato';
import { Pasos } from '../Pasos';

const INICIAL: FormularioCompuesto = {
  incognita: 'S',
  p: '',
  s: '',
  n: '',
  tasa: '',
  tipoTasa: 'efectiva',
  frecuenciaTasa: 12,
  frecuenciaPeriodo: 12,
};

const OPCIONES: { valor: Incognita; nombre: string }[] = [
  { valor: 'S', nombre: 'Calcular el valor futuro (S)' },
  { valor: 'P', nombre: 'Calcular el valor presente (P)' },
  { valor: 'i', nombre: 'Calcular la tasa (i)' },
  { valor: 'n', nombre: 'Calcular los periodos (n)' },
];

/** HU-18: interés compuesto. Despeja S, P, i o n y muestra cómo se calculó. */
export function PaginaCompuesto() {
  const [f, setF] = useState<FormularioCompuesto>(INICIAL);
  const [escala, setEscala] = useState<EscalaMonetaria>(0);
  const [errores, setErrores] = useState<ErroresCompuesto>({});
  const [resultado, setResultado] = useState<ResultadoCompuesto | null>(null);

  const cambiar = <K extends keyof FormularioCompuesto>(campo: K, valor: FormularioCompuesto[K]) => {
    setF((previo) => ({ ...previo, [campo]: valor }));
    setResultado(null);
  };

  const calcular = (evento: FormEvent) => {
    evento.preventDefault();
    const r = calcularCompuesto(f, (monto) => pesos(monto, escala));
    if (r.ok) {
      setErrores({});
      setResultado(r.datos);
    } else {
      setErrores(r.errores);
      setResultado(null);
    }
  };

  const periodo = nombreFrecuencia(f.frecuenciaPeriodo).periodo;

  return (
    <div className="pila">
      <section className="tarjeta tarjeta--ancha" aria-labelledby="titulo-compuesto">
        <h1 id="titulo-compuesto">Interés compuesto</h1>
        <p className="tarjeta__texto">Elige qué quieres despejar y escribe los demás datos. Usa S = P · (1 + i)^n.</p>
        <form className="formulario formulario--rejilla" onSubmit={calcular} noValidate>
          <fieldset className="opciones">
            <legend>
              ¿Qué quieres calcular? <Ayuda id="incognita" />
            </legend>
            {OPCIONES.map((o) => (
              <label key={o.valor}>
                <input
                  type="radio"
                  name="incognita"
                  checked={f.incognita === o.valor}
                  onChange={() => {
                    cambiar('incognita', o.valor);
                    setErrores({});
                  }}
                />{' '}
                {o.nombre}
              </label>
            ))}
          </fieldset>
          {f.incognita !== 'P' && (
            <Campo
              nombre="p"
              etiqueta="Capital inicial P ($)"
              inputMode="numeric"
              placeholder="1.000.000"
              valor={f.p}
              alCambiar={(v) => cambiar('p', v)}
              error={errores.p}
              termino="capitalInicial"
            />
          )}
          {f.incognita !== 'S' && (
            <Campo
              nombre="s"
              etiqueta="Monto final S ($)"
              inputMode="numeric"
              placeholder="2.000.000"
              valor={f.s}
              alCambiar={(v) => cambiar('s', v)}
              error={errores.s}
              termino="montoFinal"
            />
          )}
          {f.incognita !== 'n' && (
            <Campo
              nombre="n"
              etiqueta="Número de periodos (n)"
              inputMode="decimal"
              placeholder="12"
              valor={f.n}
              alCambiar={(v) => cambiar('n', v)}
              error={errores.n}
              ayuda="Puede tener decimales, por ejemplo 2,5."
              termino="periodos"
            />
          )}
          <SelectorFrecuencia
            id="frecuenciaPeriodo"
            etiqueta="Duración de cada periodo"
            valor={f.frecuenciaPeriodo}
            alCambiar={(v) => cambiar('frecuenciaPeriodo', v)}
            termino="duracionPeriodo"
          />
          {f.incognita !== 'i' && (
            <CamposTasa
              tasa={f.tasa}
              tipo={f.tipoTasa}
              frecuencia={f.frecuenciaTasa}
              error={errores.tasa}
              alCambiarTasa={(v) => cambiar('tasa', v)}
              alCambiarTipo={(v) => cambiar('tipoTasa', v)}
              alCambiarFrecuencia={(v) => cambiar('frecuenciaTasa', v)}
            />
          )}
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
        <section className="tarjeta tarjeta--ancha" aria-labelledby="titulo-resultado-compuesto">
          <h2 id="titulo-resultado-compuesto">Resultado</h2>
          <dl className="cifras">
            {resultado.incognita === 'S' && (
              <div>
                <dt>
                  Valor futuro (S) <Ayuda id="valorFuturo" />
                </dt>
                <dd>{pesos(resultado.valor, escala)}</dd>
              </div>
            )}
            {resultado.incognita === 'P' && (
              <div>
                <dt>
                  Valor presente (P) <Ayuda id="valorPresente" />
                </dt>
                <dd>{pesos(resultado.valor, escala)}</dd>
              </div>
            )}
            {resultado.incognita === 'n' && (
              <div>
                <dt>
                  Periodos necesarios <Ayuda id="periodosNecesarios" />
                </dt>
                <dd>{cuatroDecimales(resultado.valor)} periodos</dd>
              </div>
            )}
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
            {resultado.incognita === 'i' && (
              <div>
                <dt>
                  Nominal anual <Ayuda id="nominalAnual" />
                </dt>
                <dd>{porcentaje(resultado.nominal, 4)}</dd>
              </div>
            )}
          </dl>
          <Pasos titulo="¿Cómo se calculó?" pasos={resultado.pasos} />
        </section>
      )}
    </div>
  );
}
