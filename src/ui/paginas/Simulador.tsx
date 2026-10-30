import { useEffect, useState, type FormEvent } from 'react';
import {
  FRECUENCIAS,
  calcularTasa,
  compararGracias,
  compararSistemas,
  explicarAmortizacion,
  generarTabla,
  numero,
  nombreFrecuencia,
  validarMonto,
  validarPlazo,
  validarSimulacion,
  validarTasa,
  validarGracia,
  type AbonoExtra,
  type Comparacion,
  type Gracia,
  type TipoGracia,
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
import { Pasos } from '../Pasos';
import { FormularioAbono } from './Abono';
import { TarjetaUsura } from './Usura';

interface Props {
  servicio?: ServicioCuenta | null;
  usuario?: Usuario | null;
  /** Fecha para la vigencia de la usura; se puede fijar en las pruebas. */
  hoy?: Date;
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
  gracia: Gracia;
  /** Tabla sin abono extraordinario. */
  base: Tabla;
  comparacion: Comparacion;
}

/** HU-13: costo de la gracia muerta frente a la gracia con pago de intereses. */
function ComparacionGracias({ r, escala }: { r: Resultado; escala: EscalaMonetaria }) {
  const { muerta, conIntereses, diferencia } = compararGracias({
    capital: r.simulacion.monto,
    tasa: r.tasa.periodica,
    plazo: r.simulacion.plazo,
    sistema: r.simulacion.sistema,
    escala,
    periodos: r.gracia.periodos,
  });
  return (
    <section className="tarjeta tarjeta--ancha" aria-labelledby="titulo-gracias">
      <h2 id="titulo-gracias">Costo de la gracia ({r.gracia.periodos} periodos)</h2>
      <dl className="cifras">
        <div>
          <dt>Intereses con gracia muerta</dt>
          <dd>{pesos(muerta, escala)}</dd>
        </div>
        <div>
          <dt>Intereses pagando intereses en la gracia</dt>
          <dd>{pesos(conIntereses, escala)}</dd>
        </div>
        <div>
          <dt>Diferencia</dt>
          <dd>{pesos(diferencia, escala)}</dd>
        </div>
      </dl>
      <p className="tarjeta__texto">
        En la gracia muerta no pagas nada y el interés se suma a la deuda, así que después pagas intereses sobre un
        saldo mayor.
      </p>
    </section>
  );
}

/** HU-11: Francés frente a Alemán para el mismo crédito. */
function ComparacionSistemas({ comparacion, escala }: { comparacion: Comparacion; escala: EscalaMonetaria }) {
  const { frances, aleman, sobrecosto } = comparacion;
  const filas = [
    { nombre: 'Cuota inicial', f: frances.cuotaInicial, a: aleman.cuotaInicial },
    { nombre: 'Total de intereses', f: frances.totalIntereses, a: aleman.totalIntereses },
    { nombre: 'Total pagado', f: frances.totalPagado, a: aleman.totalPagado },
  ];
  const [abierto, setAbierto] = useState(false);
  return (
    <section className="tarjeta tarjeta--ancha" aria-label="Comparación de sistemas">
      <button
        type="button"
        className="boton boton--secundario"
        aria-expanded={abierto}
        onClick={() => setAbierto((a) => !a)}
      >
        {abierto ? 'Ocultar comparación' : 'Comparar sistemas'}
      </button>
      {abierto && (
        <>
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
        </>
      )}
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
export function PaginaSimulador({ servicio = null, usuario = null, hoy }: Props) {
  const [f, setF] = useState<FormularioSimulacion>(INICIAL);
  const [errores, setErrores] = useState<ErroresSimulacion>({});
  const [escala, setEscala] = useState<EscalaMonetaria>(0);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [graciaTexto, setGraciaTexto] = useState('');
  const [tipoGracia, setTipoGracia] = useState<TipoGracia>('muerta');
  const [errorGracia, setErrorGracia] = useState<string | undefined>();
  const [abono, setAbono] = useState<AbonoExtra | null>(null);

  const limpiarResultado = () => {
    setResultado(null);
    setAbono(null);
  };

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
    limpiarResultado();
  };

  const cambiarEscala = (nueva: EscalaMonetaria) => {
    setEscala(nueva);
    limpiarResultado();
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
    const validacionGracia = validarGracia(graciaTexto);
    setErrorGracia(validacionGracia.ok ? undefined : validacionGracia.errores);
    if (!validacion.ok || !validacionGracia.ok) {
      setErrores(validacion.ok ? {} : validacion.errores);
      limpiarResultado();
      return;
    }
    setErrores({});
    setAbono(null);
    const s = validacion.datos;
    const gracia: Gracia = { tipo: tipoGracia, periodos: validacionGracia.datos };
    const tasa = calcularTasa({
      valor: s.tasa,
      tipo: s.tipoTasa,
      frecuenciaTasa: s.frecuenciaTasa,
      frecuenciaPago: s.frecuenciaPago,
    });
    const credito = { capital: s.monto, tasa: tasa.periodica, plazo: s.plazo, escala, gracia };
    const base = generarTabla({ ...credito, sistema: s.sistema });
    const comparacion = compararSistemas(credito);
    setResultado({ simulacion: s, tasa, gracia, base, comparacion });
  };

  const tabla =
    resultado && abono
      ? generarTabla({
          capital: resultado.simulacion.monto,
          tasa: resultado.tasa.periodica,
          plazo: resultado.simulacion.plazo,
          sistema: resultado.simulacion.sistema,
          escala,
          gracia: resultado.gracia,
          abono,
        })
      : resultado?.base;
  const hayExtra = tabla?.filas.some((fila) => !fila.extra.isZero()) ?? false;
  const primeraCuota = tabla?.filas.find((fila) => fila.periodo > 0 && !fila.gracia)?.cuota;

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
          <Campo
            nombre="gracia"
            etiqueta="Periodos de gracia"
            inputMode="numeric"
            placeholder="0"
            valor={graciaTexto}
            alCambiar={(v) => {
              setGraciaTexto(v);
              limpiarResultado();
            }}
            onBlur={() => {
              const v = validarGracia(graciaTexto);
              setErrorGracia(v.ok ? undefined : v.errores);
            }}
            error={errorGracia}
            ayuda="Entre 0 y 60. Se suman a las cuotas."
          />
          <div className="campo">
            <label htmlFor="tipoGracia">Tipo de gracia</label>
            <select
              id="tipoGracia"
              value={tipoGracia}
              onChange={(e) => {
                setTipoGracia(e.target.value as TipoGracia);
                limpiarResultado();
              }}
            >
              <option value="muerta">Muerta (no se paga nada)</option>
              <option value="intereses">Con pago de intereses</option>
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
            <Pasos
              titulo="¿Cómo se calculó?"
              pasos={resultado.tasa.pasos.map((paso) => ({
                titulo: paso.descripcion,
                formula: '',
                sustitucion: paso.sustitucion,
                resultado: `${numero(paso.valor)} (${porcentaje(paso.valor, 6)})`,
              }))}
            />
          </section>

          <TarjetaUsura eaCredito={resultado.tasa.ea} {...(hoy ? { hoy } : {})} />

          {resultado.gracia.periodos > 0 && <ComparacionGracias r={resultado} escala={escala} />}

          <ComparacionSistemas comparacion={resultado.comparacion} escala={escala} />

          <FormularioAbono
            base={resultado.base}
            gracia={resultado.gracia.periodos}
            plazo={resultado.simulacion.plazo}
            escala={escala}
            abono={abono}
            alCambiar={setAbono}
          />

          <section className="tarjeta tarjeta--ancha" aria-labelledby="titulo-tabla">
            <h2 id="titulo-tabla">
              Tabla de amortización · {resultado.simulacion.sistema === 'frances' ? 'Francés' : 'Alemán'}
            </h2>
            <dl className="cifras">
              <div>
                <dt>Primera cuota</dt>
                <dd>{pesos(primeraCuota!, escala)}</dd>
              </div>
              <div>
                <dt>Total de intereses</dt>
                <dd>{pesos(tabla!.totalIntereses, escala)}</dd>
              </div>
              <div>
                <dt>Total pagado</dt>
                <dd>{pesos(tabla!.totalPagado, escala)}</dd>
              </div>
            </dl>
            <Pasos
              titulo="¿Cómo se calculó la cuota?"
              pasos={explicarAmortizacion(
                {
                  capital: resultado.simulacion.monto,
                  tasa: resultado.tasa.periodica,
                  plazo: resultado.simulacion.plazo,
                  sistema: resultado.simulacion.sistema,
                  gracia: resultado.gracia,
                  tabla: tabla!,
                },
                (monto) => pesos(monto, escala),
              )}
            />
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
                    {hayExtra && <th scope="col">Abono extra</th>}
                    <th scope="col">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {tabla!.filas.map((fila) => (
                    <tr key={fila.periodo} className={fila.gracia ? 'fila-gracia' : undefined}>
                      <th scope="row">
                        {fila.periodo}
                        {fila.gracia && <span className="etiqueta-fila"> gracia</span>}
                      </th>
                      <td>{pesos(fila.cuota, escala)}</td>
                      <td>{pesos(fila.interes, escala)}</td>
                      <td>{pesos(fila.abono, escala)}</td>
                      {hayExtra && <td>{pesos(fila.extra, escala)}</td>}
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
