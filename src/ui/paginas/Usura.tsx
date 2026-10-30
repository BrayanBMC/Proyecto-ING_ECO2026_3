import { useState, type FormEvent } from 'react';
import { dec, evaluarUsura, ultimaVigencia, validarIbc, vigenciaActual, type Dec } from '../../core';
import { Campo } from '../Campo';
import { porcentaje } from '../formato';
import { Pasos } from '../Pasos';

/** "2026-10-31" → "31/10/2026" */
const fechaCo = (iso: string) => iso.split('-').reverse().join('/');

/**
 * HU-15: compara la EA del crédito con la usura vigente (1,5 × IBC, sección 7.4).
 * Si el dato publicado venció, avisa y deja ingresar el IBC a mano (solo en memoria).
 */
export function TarjetaUsura({ eaCredito, hoy = new Date() }: { eaCredito: Dec; hoy?: Date }) {
  const vigente = vigenciaActual(hoy);
  const [manual, setManual] = useState<{ ibc: Dec; fecha: string } | null>(null);
  const [ibcTexto, setIbcTexto] = useState('');
  const [fecha, setFecha] = useState('');
  const [errorIbc, setErrorIbc] = useState<string | undefined>();
  const [errorFecha, setErrorFecha] = useState<string | undefined>();

  const ibc = vigente
    ? {
        valor: dec(vigente.ibcEA),
        origen: `IBC certificado por la Superintendencia Financiera, vigente del ${fechaCo(vigente.desde)} al ${fechaCo(vigente.hasta)}`,
      }
    : manual
      ? { valor: manual.ibc, origen: `Ingresado por el usuario, vigencia ${fechaCo(manual.fecha)}` }
      : null;

  const guardar = (evento: FormEvent) => {
    evento.preventDefault();
    const validacion = validarIbc(ibcTexto);
    setErrorIbc(validacion.ok ? undefined : validacion.errores);
    setErrorFecha(fecha ? undefined : 'Escribe la fecha de vigencia del IBC.');
    if (validacion.ok && fecha) {
      setManual({ ibc: validacion.datos, fecha });
    }
  };

  const estado = ibc ? evaluarUsura(eaCredito, ibc.valor) : null;

  return (
    <section className="tarjeta tarjeta--ancha" aria-labelledby="titulo-usura">
      <h2 id="titulo-usura">Tasa de usura</h2>
      {!vigente && (
        <p role="status" className="aviso-advertencia">
          Dato de usura vencido (vigente hasta {fechaCo(ultimaVigencia().hasta)}). Ingresa el IBC del mes para comparar.
        </p>
      )}
      {estado && ibc && (
        <>
          <p className={estado.supera ? 'estado estado--mal' : 'estado estado--bien'}>
            <span aria-hidden="true">{estado.supera ? '⚠' : '✓'}</span>{' '}
            {estado.supera ? 'Supera la usura' : 'Dentro del límite de usura'} ({porcentaje(estado.usuraEA, 2)} EA)
          </p>
          <p className="tarjeta__texto">
            La EA del crédito ({porcentaje(eaCredito, 2)}) está {estado.margenPb.abs().toFixed(0)} puntos básicos{' '}
            {estado.supera ? 'por encima' : 'por debajo'} del límite. {ibc.origen}.
          </p>
          <Pasos
            titulo="¿Cómo se calculó?"
            pasos={[
              {
                titulo: 'Tasa de usura (artículo 884 del Código de Comercio)',
                formula: 'Usura = 1,5 · IBC',
                sustitucion: `1,5 · ${porcentaje(ibc.valor, 2)}`,
                resultado: `${porcentaje(estado.usuraEA, 2)} EA`,
              },
              {
                titulo: 'Comparación en efectiva anual',
                formula: 'EA del crédito − usura',
                sustitucion: `${porcentaje(eaCredito, 2)} − ${porcentaje(estado.usuraEA, 2)}`,
                resultado: `${estado.margenPb.toFixed(0)} puntos básicos`,
              },
            ]}
          />
        </>
      )}
      {!vigente && (
        <form className="formulario formulario--rejilla" onSubmit={guardar} noValidate>
          <Campo
            nombre="ibc"
            etiqueta="IBC efectivo anual (%)"
            inputMode="decimal"
            valor={ibcTexto}
            alCambiar={setIbcTexto}
            error={errorIbc}
          />
          <Campo nombre="ibc-fecha" etiqueta="Vigente hasta" type="date" valor={fecha} alCambiar={setFecha} error={errorFecha} />
          <button type="submit" className="boton boton--secundario">
            Usar este IBC
          </button>
        </form>
      )}
    </section>
  );
}
