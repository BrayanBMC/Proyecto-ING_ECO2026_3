import { useState, type FormEvent } from 'react';
import {
  MAX_PARTES,
  MIN_PARTES,
  calcularReparto,
  numero,
  type ErroresReparto,
  type EscalaMonetaria,
  type FilaFormularioReparto,
  type MetodoReparto,
  type ResultadoReparto,
} from '../../core';
import { Campo } from '../Campo';
import { Ayuda } from '../ayuda/Ayuda';
import { SelectorEscala } from '../CamposTasa';
import { pesos } from '../formato';
import { Pasos } from '../Pasos';

const METODOS: { valor: MetodoReparto; nombre: string; ayuda: string }[] = [
  { valor: 'directo', nombre: 'Directo', ayuda: 'A mayor índice, mayor parte.' },
  { valor: 'inverso', nombre: 'Inverso', ayuda: 'A mayor índice, menor parte.' },
  { valor: 'compuesto', nombre: 'Compuesto', ayuda: 'Proporcional al producto de dos índices.' },
];

const nuevaFila = (): FilaFormularioReparto => ({ nombre: '', x: '', y: '' });

/** HU-20: reparto proporcional directo, inverso o compuesto, con suma exacta (mayor residuo). */
export function PaginaReparto() {
  const [monto, setMonto] = useState('');
  const [metodo, setMetodo] = useState<MetodoReparto>('directo');
  const [escala, setEscala] = useState<EscalaMonetaria>(0);
  const [filas, setFilas] = useState<FilaFormularioReparto[]>([nuevaFila(), nuevaFila(), nuevaFila()]);
  const [errores, setErrores] = useState<ErroresReparto | null>(null);
  const [resultado, setResultado] = useState<ResultadoReparto | null>(null);

  const limpiar = () => setResultado(null);

  const cambiarFila = (k: number, campo: keyof FilaFormularioReparto, valor: string) => {
    setFilas((previas) => previas.map((fila, j) => (j === k ? { ...fila, [campo]: valor } : fila)));
    limpiar();
  };

  const repartir = (evento: FormEvent) => {
    evento.preventDefault();
    const r = calcularReparto({ monto, metodo, escala, filas }, (valor) => pesos(valor, escala));
    if (r.ok) {
      setErrores(null);
      setResultado(r.datos);
    } else {
      setErrores(r.errores);
      setResultado(null);
    }
  };

  const unidad = escala === 2 ? '0,01' : '1';

  return (
    <div className="pila">
      <section className="tarjeta tarjeta--ancha" aria-labelledby="titulo-reparto">
        <h1 id="titulo-reparto">Reparto proporcional</h1>
        <p className="tarjeta__texto">
          Reparte un monto entre {MIN_PARTES} y {MAX_PARTES} partes. La suma de las partes siempre da exactamente el monto.
        </p>
        <form className="formulario" onSubmit={repartir} noValidate>
          <div className="formulario formulario--rejilla">
            <Campo
              nombre="monto-reparto"
              etiqueta="Monto a repartir ($)"
              inputMode="decimal"
              placeholder="1.000.000"
              valor={monto}
              alCambiar={(v) => {
                setMonto(v);
                limpiar();
              }}
              error={errores?.monto}
              termino="repartoMonto"
            />
            <fieldset className="opciones">
              <legend>
                Método de reparto <Ayuda id="repartoMetodo" />
              </legend>
              {METODOS.map((m) => (
                <label key={m.valor}>
                  <input
                    type="radio"
                    name="metodo"
                    checked={metodo === m.valor}
                    onChange={() => {
                      setMetodo(m.valor);
                      setErrores(null);
                      limpiar();
                    }}
                  />{' '}
                  {m.nombre}: {m.ayuda}
                </label>
              ))}
            </fieldset>
            <SelectorEscala
              escala={escala}
              alCambiar={(nueva) => {
                setEscala(nueva);
                limpiar();
              }}
            />
          </div>

          {filas.map((fila, k) => (
            <div key={k} className="parte formulario formulario--rejilla">
              <Campo
                nombre={`parte-${k}-nombre`}
                etiqueta={`Nombre de la parte ${k + 1}`}
                placeholder={`Parte ${k + 1}`}
                valor={fila.nombre}
                alCambiar={(v) => cambiarFila(k, 'nombre', v)}
                termino="repartoNombre"
              />
              <Campo
                nombre={`parte-${k}-x`}
                etiqueta={`Índice de la parte ${k + 1}`}
                inputMode="decimal"
                placeholder="1"
                valor={fila.x}
                alCambiar={(v) => cambiarFila(k, 'x', v)}
                error={errores?.filas[k]?.x}
                termino="repartoIndice"
              />
              {metodo === 'compuesto' && (
                <Campo
                  nombre={`parte-${k}-y`}
                  etiqueta={`Segundo índice de la parte ${k + 1}`}
                  inputMode="decimal"
                  placeholder="1"
                  valor={fila.y}
                  alCambiar={(v) => cambiarFila(k, 'y', v)}
                  error={errores?.filas[k]?.y}
                  termino="repartoIndice2"
                />
              )}
              {filas.length > MIN_PARTES && (
                <div className="acciones">
                  <button
                    type="button"
                    className="boton boton--pequeno boton--secundario"
                    onClick={() => {
                      setFilas((previas) => previas.filter((_, j) => j !== k));
                      setErrores(null);
                      limpiar();
                    }}
                  >
                    Quitar la parte {k + 1}
                  </button>
                </div>
              )}
            </div>
          ))}

          {errores?.general && (
            <p role="alert" className="alerta">
              {errores.general}
            </p>
          )}
          <div className="acciones">
            <button
              type="button"
              className="boton boton--secundario"
              disabled={filas.length >= MAX_PARTES}
              onClick={() => {
                setFilas((previas) => [...previas, nuevaFila()]);
                limpiar();
              }}
            >
              Agregar parte
            </button>
            <button type="submit" className="boton">
              Repartir
            </button>
          </div>
        </form>
      </section>

      {resultado && (
        <section className="tarjeta tarjeta--ancha" aria-labelledby="titulo-resultado-reparto">
          <h2 id="titulo-resultado-reparto">Resultado del reparto</h2>
          <p className="estado estado--bien">
            <span aria-hidden="true">✓</span> La suma de las partes es exactamente {pesos(resultado.suma, escala)}
          </p>
          <div className="tabla-contenedor" tabIndex={0} role="region" aria-label="Partes del reparto">
            <table className="tabla">
              <caption className="sr-solo">Parte que recibe cada índice</caption>
              <thead>
                <tr>
                  <th scope="col">Parte</th>
                  <th scope="col">Índice</th>
                  {resultado.metodo === 'compuesto' && <th scope="col">Segundo índice</th>}
                  <th scope="col">Monto</th>
                </tr>
              </thead>
              <tbody>
                {resultado.partes.map((parte, k) => (
                  <tr key={k}>
                    <th scope="row">{parte.nombre}</th>
                    <td>{numero(parte.x)}</td>
                    {resultado.metodo === 'compuesto' && <td>{numero(parte.y!)}</td>}
                    <td>
                      {pesos(parte.monto, escala)}
                      {parte.recibioExtra && <span className="etiqueta-fila"> +{unidad} de ajuste</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row">Total</th>
                  <td />
                  {resultado.metodo === 'compuesto' && <td />}
                  <td>{pesos(resultado.suma, escala)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <Pasos titulo="¿Cómo se calculó?" pasos={resultado.pasos} />
        </section>
      )}
    </div>
  );
}
