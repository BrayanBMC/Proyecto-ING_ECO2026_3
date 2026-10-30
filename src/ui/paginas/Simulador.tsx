import { useEffect, useState, type FormEvent } from 'react';
import {
  FRECUENCIAS,
  calcularTasa,
  compararSistemas,
  generarTabla,
  nombreFrecuencia,
  validarMonto,
  validarPlazo,
  validarSimulacion,
  validarTasa,
  type Comparacion,
  type ErroresSimulacion,
  type EscalaMonetaria,
  type Frecuencia,
  type FormularioSimulacion,
  type ResultadoTasa,
  type Simulacion,
  type Tabla,
  type TipoTasa,
} from '../../core';
import type { ServicioCuenta, Usuario } from '../../adapters/auth/ServicioCuenta';
import { Campo } from '../Campo';
import { pesos, porcentaje } from '../formato';

interface Props {
  servicio?: ServicioCuenta | null;
  usuario?: Usuario | null;
}

const INICIAL: FormularioSimulacion = {
  monto: '',
  plazo: '',
  frecuenciaPago: 12,
  tasa: '',
  tipoTasa: 'nominal-vencida',
  frecuenciaTasa: 12,
  sistema: 'frances',
};

const TIPOS: { valor: TipoTasa; nombre: string }[] = [
  { valor: 'nominal-vencida', nombre: 'Nominal vencida' },
  { valor: 'nominal-anticipada', nombre: 'Nominal anticipada' },
  { valor: 'efectiva', nombre: 'Efectiva' },
];

interface Resultado {
  simulacion: Simulacion;
  tasa: ResultadoTasa;
  tabla: Tabla;
  comparacion: Comparacion;
}

/** HU-11: Francés frente a Alemán para el mismo crédito. */
function ComparacionSistemas({ comparacion, escala }: { comparacion: Comparacion; escala: EscalaMonetaria }) {
  const { frances, aleman, sobrecosto } = comparacion;
  const filas = [
    { nombre: 'Cuota inicial', f: frances.cuotaInicial, a: aleman.cuotaInicial },
    { nombre: 'Total de intereses', f: frances.totalIntereses, a: aleman.totalIntereses },
    { nombre: 'Total pagado', f: frances.totalPagado, a: aleman.totalPagado },
  ];
  return (
    <section className="tarjeta tarjeta--ancha" aria-labelledby="titulo-comparar">
      <details>
        <summary>
          <h2 id="titulo-comparar" className="resumen-titulo">
            Comparar sistemas
          </h2>
        </summary>
        <div className="tabla-contenedor">
          <table className="tabla">
            <caption className="sr-solo">Francés frente a Alemán</caption>
            <thead>
              <tr>
                <th scope="col">Concepto</th>
                <th scope="col">Francés</th>
                <th scope="col">Alemán</th>
              </tr>
            </thead>
            <tbody>
              {filas.map((fila) => (
                <tr key={fila.nombre}>
                  <th scope="row">{fila.nombre}</th>
                  <td>{pesos(fila.f, escala)}</td>
                  <td>{pesos(fila.a, escala)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="comparar-delta">
          Sobrecosto del Francés (Δ):{' '}
          <strong>
            {sobrecosto
              ? `${porcentaje(sobrecosto, 2)} más de intereses que el Alemán`
              : 'no aplica (sin intereses)'}
          </strong>
        </p>
        <p className="tarjeta__texto">
          El Alemán abona más capital al comienzo, así que el saldo baja más rápido y se pagan menos intereses. El
          Francés tiene una cuota fija y más baja al inicio.
        </p>
      </details>
    </section>
  );
}

function sigla(tipo: TipoTasa, m: Frecuencia): string {
  const s = nombreFrecuencia(m).sigla;
  if (tipo === 'efectiva') {
    return m === 1 ? 'EA' : `E${s}`;
  }
  return `N${s}${tipo === 'nominal-anticipada' ? 'A' : 'V'}`;
}

/** HU-07 a HU-10: datos del crédito, tasa equivalente y tabla de amortización. Funciona sin cuenta (HU-06). */
export function PaginaSimulador({ servicio = null, usuario = null }: Props) {
  const [f, setF] = useState<FormularioSimulacion>(INICIAL);
  const [errores, setErrores] = useState<ErroresSimulacion>({});
  const [escala, setEscala] = useState<EscalaMonetaria>(0);
  const [resultado, setResultado] = useState<Resultado | null>(null);

  // HU-04: con sesión, la escala de decimales del perfil se aplica sola.
  useEffect(() => {
    if (!servicio || !usuario) {
      return;
    }
    void servicio.leerPerfil().then((r) => {
      if (r.ok && r.perfil) {
        setEscala(r.perfil.escala);
      }
    });
  }, [servicio, usuario]);

  const cambiar = <K extends keyof FormularioSimulacion>(campo: K, valor: FormularioSimulacion[K]) => {
    setF((previo) => ({ ...previo, [campo]: valor }));
    setResultado(null);
  };

  const cambiarEscala = (nueva: EscalaMonetaria) => {
    setEscala(nueva);
    setResultado(null);
  };

  // HU-07: validación al salir de cada campo.
  const revisar = (campo: keyof ErroresSimulacion) => {
    const error =
      campo === 'monto' ? validarMonto(f.monto) : campo === 'plazo' ? validarPlazo(f.plazo) : validarTasa(f.tasa, f.tipoTasa, f.frecuenciaTasa);
    setErrores((previo) => {
      const siguiente = { ...previo };
      if (error) {
        siguiente[campo] = error;
      } else {
        delete siguiente[campo];
      }
      return siguiente;
    });
  };

  const simular = (evento: FormEvent) => {
    evento.preventDefault();
    const validacion = validarSimulacion(f);
    if (!validacion.ok) {
      setErrores(validacion.errores);
      setResultado(null);
      return;
    }
    setErrores({});
    const s = validacion.datos;
    const tasa = calcularTasa({
      valor: s.tasa,
      tipo: s.tipoTasa,
      frecuenciaTasa: s.frecuenciaTasa,
      frecuenciaPago: s.frecuenciaPago,
    });
    const tabla = generarTabla({ capital: s.monto, tasa: tasa.periodica, plazo: s.plazo, sistema: s.sistema, escala });
    const comparacion = compararSistemas({ capital: s.monto, tasa: tasa.periodica, plazo: s.plazo, escala });
    setResultado({ simulacion: s, tasa, tabla, comparacion });
  };

  const periodoPago = nombreFrecuencia(f.frecuenciaPago).periodo;

  return (
    <div className="pila">
      <section className="tarjeta tarjeta--ancha" aria-labelledby="titulo-simulador">
        <h1 id="titulo-simulador">Simulador de créditos</h1>
        <form className="formulario formulario--rejilla" onSubmit={simular} noValidate>
          <Campo
            nombre="monto"
            etiqueta="Monto del crédito ($)"
            inputMode="numeric"
            placeholder="10.000.000"
            valor={f.monto}
            alCambiar={(v) => cambiar('monto', v)}
            onBlur={() => revisar('monto')}
            error={errores.monto}
          />
          <Campo
            nombre="plazo"
            etiqueta="Número de cuotas"
            inputMode="numeric"
            placeholder="12"
            valor={f.plazo}
            alCambiar={(v) => cambiar('plazo', v)}
            onBlur={() => revisar('plazo')}
            error={errores.plazo}
            ayuda="Entre 1 y 360."
          />
          <div className="campo">
            <label htmlFor="frecuenciaPago">Frecuencia de pago</label>
            <select
              id="frecuenciaPago"
              value={f.frecuenciaPago}
              onChange={(e) => cambiar('frecuenciaPago', Number(e.target.value) as Frecuencia)}
            >
              {FRECUENCIAS.map((fr) => (
                <option key={fr.valor} value={fr.valor}>
                  {fr.nombre}
                </option>
              ))}
            </select>
          </div>
          <Campo
            nombre="tasa"
            etiqueta="Tasa de interés (%)"
            inputMode="decimal"
            placeholder="24"
            valor={f.tasa}
            alCambiar={(v) => cambiar('tasa', v)}
            onBlur={() => revisar('tasa')}
            error={errores.tasa}
            ayuda="Usa coma para decimales, por ejemplo 1,5."
          />
          <div className="campo">
            <label htmlFor="tipoTasa">Tipo de tasa</label>
            <select id="tipoTasa" value={f.tipoTasa} onChange={(e) => cambiar('tipoTasa', e.target.value as TipoTasa)}>
              {TIPOS.map((t) => (
                <option key={t.valor} value={t.valor}>
                  {t.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="campo">
            <label htmlFor="frecuenciaTasa">
              {f.tipoTasa === 'efectiva' ? 'Periodo de la tasa' : 'Capitalización de la tasa'}
            </label>
            <select
              id="frecuenciaTasa"
              value={f.frecuenciaTasa}
              onChange={(e) => cambiar('frecuenciaTasa', Number(e.target.value) as Frecuencia)}
            >
              {FRECUENCIAS.map((fr) => (
                <option key={fr.valor} value={fr.valor}>
                  {fr.nombre}
                </option>
              ))}
            </select>
          </div>
          <fieldset className="opciones">
            <legend>Sistema de amortización</legend>
            <label>
              <input
                type="radio"
                name="sistema"
                checked={f.sistema === 'frances'}
                onChange={() => cambiar('sistema', 'frances')}
              />{' '}
              Francés (cuota fija)
            </label>
            <label>
              <input
                type="radio"
                name="sistema"
                checked={f.sistema === 'aleman'}
                onChange={() => cambiar('sistema', 'aleman')}
              />{' '}
              Alemán (abono fijo)
            </label>
          </fieldset>
          <fieldset className="opciones">
            <legend>Decimales en los montos</legend>
            <label>
              <input type="radio" name="escala" checked={escala === 0} onChange={() => cambiarEscala(0)} /> Sin
              decimales
            </label>
            <label>
              <input type="radio" name="escala" checked={escala === 2} onChange={() => cambiarEscala(2)} /> 2
              decimales
            </label>
          </fieldset>
          <button type="submit" className="boton">
            Simular
          </button>
        </form>
      </section>

      {resultado && (
        <>
          <section className="tarjeta tarjeta--ancha" aria-labelledby="titulo-tasa">
            <h2 id="titulo-tasa">Tasa que se aplica</h2>
            <dl className="cifras">
              <div>
                <dt>Tasa ingresada</dt>
                <dd>
                  {porcentaje(resultado.simulacion.tasa)} {sigla(resultado.simulacion.tipoTasa, resultado.simulacion.frecuenciaTasa)}
                </dd>
              </div>
              <div>
                <dt>Efectiva anual (EA)</dt>
                <dd>{porcentaje(resultado.tasa.ea)}</dd>
              </div>
              <div>
                <dt>Tasa por {nombreFrecuencia(resultado.simulacion.frecuenciaPago).periodo}</dt>
                <dd>{porcentaje(resultado.tasa.periodica)}</dd>
              </div>
            </dl>
            <details>
              <summary>¿Cómo se calculó?</summary>
              <ol className="pasos">
                {resultado.tasa.pasos.map((paso) => (
                  <li key={paso.descripcion}>
                    <span>{paso.descripcion}</span> = <span className="mono">{porcentaje(paso.valor, 6)}</span>
                  </li>
                ))}
              </ol>
            </details>
          </section>

          <ComparacionSistemas comparacion={resultado.comparacion} escala={escala} />

          <section className="tarjeta tarjeta--ancha" aria-labelledby="titulo-tabla">
            <h2 id="titulo-tabla">
              Tabla de amortización · {resultado.simulacion.sistema === 'frances' ? 'Francés' : 'Alemán'}
            </h2>
            <dl className="cifras">
              <div>
                <dt>Primera cuota</dt>
                <dd>{pesos(resultado.tabla.filas[1]?.cuota ?? resultado.tabla.totalPagado, escala)}</dd>
              </div>
              <div>
                <dt>Total de intereses</dt>
                <dd>{pesos(resultado.tabla.totalIntereses, escala)}</dd>
              </div>
              <div>
                <dt>Total pagado</dt>
                <dd>{pesos(resultado.tabla.totalPagado, escala)}</dd>
              </div>
            </dl>
            <div className="tabla-contenedor" tabIndex={0} role="region" aria-label="Tabla de amortización">
              <table className="tabla">
                <caption className="sr-solo">
                  Cuotas por {periodoPago}: cuota, interés, abono a capital y saldo
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Periodo</th>
                    <th scope="col">Cuota</th>
                    <th scope="col">Interés</th>
                    <th scope="col">Abono a capital</th>
                    <th scope="col">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {resultado.tabla.filas.map((fila) => (
                    <tr key={fila.periodo}>
                      <th scope="row">{fila.periodo}</th>
                      <td>{pesos(fila.cuota, escala)}</td>
                      <td>{pesos(fila.interes, escala)}</td>
                      <td>{pesos(fila.abono, escala)}</td>
                      <td>{pesos(fila.saldo, escala)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
