import { useEffect, useMemo, useState, type FormEvent } from 'react';
import type { ServicioCuenta, Usuario } from '../../adapters/auth/ServicioCuenta';
import { repoDeCuenta } from '../../adapters/repo/RepoSimulaciones';
import { codificarEnlace } from '../../adapters/share/url';
import {
  MAX_COMPARAR,
  calcularCredito,
  cuatroDecimales,
  indiceMenorCosto,
  resumirCredito,
  validarNombreSimulacion,
  type EscalaMonetaria,
  type ResumenCredito,
  type SimulacionGuardada,
} from '../../core';
import { Campo } from '../Campo';
import { pesos, porcentaje } from '../formato';
import { Enlace } from '../navegacion';
import { repoDelInvitado } from '../sesionInvitado';

interface Props {
  servicio: ServicioCuenta | null;
  usuario: Usuario | null;
}

interface Fila {
  simulacion: SimulacionGuardada;
  /** null si los parámetros guardados ya no pasan la validación. */
  resumen: ResumenCredito | null;
  error: string | null;
}

type Formateador = (r: ResumenCredito, escala: EscalaMonetaria) => string;

/** Filas del comparador (HU-23): cuota, EA, total de intereses, total pagado y ρ. */
const CONCEPTOS: readonly (readonly [string, Formateador])[] = [
  ['Primera cuota', (r, e) => pesos(r.cuota, e)],
  ['Efectiva anual (EA)', (r) => porcentaje(r.ea, 4)],
  ['Total de intereses', (r, e) => pesos(r.totalIntereses, e)],
  ['Total pagado', (r, e) => pesos(r.totalPagado, e)],
  ['Intereses por cada peso prestado (ρ)', (r) => cuatroDecimales(r.rho)],
];

const fechaLarga = (iso: string) => new Date(iso).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' });

/**
 * HU-21 (guardar, abrir, renombrar y borrar) y HU-23 (comparar hasta 3).
 * Con sesión usa la cuenta; sin sesión usa la lista en memoria de esta pestaña.
 */
export function PaginaMisSimulaciones({ servicio, usuario }: Props) {
  const repo = useMemo(() => (usuario && servicio ? repoDeCuenta(servicio) : repoDelInvitado), [usuario, servicio]);
  const [simulaciones, setSimulaciones] = useState<SimulacionGuardada[] | null>(null);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  const [seleccionadas, setSeleccionadas] = useState<string[]>([]);
  const [comparando, setComparando] = useState(false);
  const [editando, setEditando] = useState<{ id: string; nombre: string; error?: string } | null>(null);
  const [borrando, setBorrando] = useState<string | null>(null);

  // Cada cambio (renombrar, borrar) sube el contador y eso vuelve a cargar la lista.
  const [version, setVersion] = useState(0);
  const recargar = () => setVersion((v) => v + 1);

  useEffect(() => {
    let vigente = true;
    void repo.listar().then((r) => {
      if (!vigente) {
        return; // llegó una respuesta vieja: ya hay otra carga en curso o se salió de la página
      }
      if (r.ok) {
        setSimulaciones(r.datos);
        setErrorCarga(null);
      } else {
        setErrorCarga(r.mensaje);
      }
    });
    return () => {
      vigente = false;
    };
  }, [repo, version]);

  const filas: Fila[] = useMemo(
    () =>
      (simulaciones ?? []).map((simulacion) => {
        const p = simulacion.parametros;
        const calculo = calcularCredito(p, (monto) => pesos(monto, p.escala));
        return calculo.ok
          ? { simulacion, resumen: resumirCredito(calculo.datos), error: null }
          : { simulacion, resumen: null, error: calculo.errores };
      }),
    [simulaciones],
  );

  const alternar = (id: string) => {
    setSeleccionadas((previas) => (previas.includes(id) ? previas.filter((x) => x !== id) : [...previas, id]));
    setComparando(false);
  };

  const renombrar = async (evento: FormEvent) => {
    evento.preventDefault();
    if (!editando) {
      return;
    }
    const validacion = validarNombreSimulacion(editando.nombre);
    if (!validacion.ok) {
      setEditando({ ...editando, error: validacion.errores });
      return;
    }
    const r = await repo.renombrar(editando.id, validacion.datos);
    if (r.ok) {
      setEditando(null);
      setAviso({ ok: true, texto: 'Nombre actualizado.' });
      recargar();
    } else {
      setAviso({ ok: false, texto: r.mensaje });
    }
  };

  const borrar = async (id: string) => {
    const r = await repo.borrar(id);
    setBorrando(null);
    if (r.ok) {
      setSeleccionadas((previas) => previas.filter((x) => x !== id));
      setComparando(false);
      setAviso({ ok: true, texto: 'Simulación borrada.' });
      recargar();
    } else {
      setAviso({ ok: false, texto: r.mensaje });
    }
  };

  const aComparar = filas.filter((f) => seleccionadas.includes(f.simulacion.id) && f.resumen);
  const mejor = aComparar.length > 0 ? indiceMenorCosto(aComparar.map((f) => f.resumen as ResumenCredito)) : -1;

  return (
    <div className="pila">
      <section className="tarjeta tarjeta--ancha" aria-labelledby="titulo-simulaciones">
        <h1 id="titulo-simulaciones">Mis simulaciones</h1>
        {usuario ? (
          <p className="tarjeta__texto">Guardadas en tu cuenta, de la más reciente a la más antigua.</p>
        ) : (
          <p className="tarjeta__texto">
            Modo invitado: estas simulaciones viven solo en esta pestaña y se pierden al cerrarla.{' '}
            <Enlace href="/iniciar-sesion">Inicia sesión</Enlace> para conservarlas.
          </p>
        )}

        {aviso &&
          (aviso.ok ? (
            <p role="status" className="aviso">
              {aviso.texto}
            </p>
          ) : (
            <p role="alert" className="alerta">
              {aviso.texto}
            </p>
          ))}
        {errorCarga && (
          <p role="alert" className="alerta">
            {errorCarga}
          </p>
        )}
        {!errorCarga && simulaciones === null && <p role="status">Cargando tus simulaciones…</p>}
        {simulaciones?.length === 0 && (
          <p>
            Aún no hay simulaciones guardadas. Haz una en el <Enlace href="/simulador">simulador</Enlace> y pulsa «Guardar simulación».
          </p>
        )}

        {filas.length > 0 && (
          <>
            <ul className="lista-simulaciones">
              {filas.map(({ simulacion: s, resumen, error }) => {
                const escala = s.parametros.escala;
                const marcada = seleccionadas.includes(s.id);
                return (
                  <li key={s.id} className="parte">
                    {editando?.id === s.id ? (
                      <form className="formulario formulario--rejilla" onSubmit={renombrar} noValidate>
                        <Campo
                          nombre={`renombrar-${s.id}`}
                          etiqueta="Nuevo nombre"
                          valor={editando.nombre}
                          alCambiar={(v) => setEditando({ id: s.id, nombre: v })}
                          error={editando.error}
                        />
                        <div className="acciones">
                          <button type="submit" className="boton boton--pequeno">
                            Guardar nombre
                          </button>
                          <button type="button" className="boton boton--pequeno boton--secundario" onClick={() => setEditando(null)}>
                            Cancelar
                          </button>
                        </div>
                      </form>
                    ) : (
                      <h2 className="titulo-simulacion">{s.nombre}</h2>
                    )}
                    <p className="tarjeta__texto">Actualizada el {fechaLarga(s.actualizadoEn)}</p>
                    {resumen ? (
                      <dl className="cifras">
                        <div>
                          <dt>Primera cuota</dt>
                          <dd>{pesos(resumen.cuota, escala)}</dd>
                        </div>
                        <div>
                          <dt>Efectiva anual (EA)</dt>
                          <dd>{porcentaje(resumen.ea, 2)}</dd>
                        </div>
                        <div>
                          <dt>Total de intereses</dt>
                          <dd>{pesos(resumen.totalIntereses, escala)}</dd>
                        </div>
                      </dl>
                    ) : (
                      <p className="alerta">No se puede abrir: {error}</p>
                    )}
                    <div className="acciones">
                      {resumen && (
                        <Enlace className="boton boton--pequeno" href={`/simulador${codificarEnlace(s.parametros)}`} aria-label={`Abrir ${s.nombre}`}>
                          Abrir
                        </Enlace>
                      )}
                      <button
                        type="button"
                        className="boton boton--pequeno boton--secundario"
                        aria-label={`Renombrar ${s.nombre}`}
                        onClick={() => setEditando({ id: s.id, nombre: s.nombre })}
                      >
                        Renombrar
                      </button>
                      <button
                        type="button"
                        className="boton boton--pequeno boton--secundario"
                        aria-label={`Borrar ${s.nombre}`}
                        onClick={() => setBorrando(s.id)}
                      >
                        Borrar
                      </button>
                      {resumen && (
                        <label>
                          <input
                            type="checkbox"
                            checked={marcada}
                            disabled={!marcada && seleccionadas.length >= MAX_COMPARAR}
                            onChange={() => alternar(s.id)}
                          />{' '}
                          Comparar «{s.nombre}»
                        </label>
                      )}
                    </div>
                    {borrando === s.id && (
                      <div role="alert" className="alerta">
                        <p>¿Borrar «{s.nombre}»? No se puede deshacer.</p>
                        <div className="acciones">
                          <button type="button" className="boton boton--pequeno" onClick={() => void borrar(s.id)}>
                            Sí, borrar «{s.nombre}»
                          </button>
                          <button type="button" className="boton boton--pequeno boton--secundario" onClick={() => setBorrando(null)}>
                            No, conservar
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
            <div className="acciones">
              <button
                type="button"
                className="boton"
                disabled={aComparar.length < 2}
                onClick={() => setComparando(true)}
              >
                Comparar seleccionadas
              </button>
              <span className="tarjeta__texto">
                Elige entre 2 y {MAX_COMPARAR} simulaciones ({aComparar.length} elegidas).
              </span>
            </div>
          </>
        )}
      </section>

      {comparando && aComparar.length >= 2 && (
        <section className="tarjeta tarjeta--ancha" aria-labelledby="titulo-comparador">
          <h2 id="titulo-comparador">Comparador</h2>
          <div className="tabla-contenedor" tabIndex={0} role="region" aria-label="Comparación de simulaciones">
            <table className="tabla">
              <caption className="sr-solo">Cuota, EA, intereses y ρ de cada simulación elegida</caption>
              <thead>
                <tr>
                  <th scope="col">Concepto</th>
                  {aComparar.map((f, k) => (
                    <th key={f.simulacion.id} scope="col" className={k === mejor ? 'celda-mejor' : undefined}>
                      {f.simulacion.nombre}
                      {k === mejor && <span className="etiqueta-fila"> ✓ Menor costo</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {CONCEPTOS.map(([concepto, formatear]) => (
                  <tr key={concepto}>
                    <th scope="row">{concepto}</th>
                    {aComparar.map((f, k) => (
                      <td key={f.simulacion.id} className={k === mejor ? 'celda-mejor' : undefined}>
                        {formatear(f.resumen as ResumenCredito, f.simulacion.parametros.escala)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
