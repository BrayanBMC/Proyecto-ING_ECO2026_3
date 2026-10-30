import { useState, type FormEvent } from 'react';
import { validarAbono, type AbonoExtra, type ErroresAbono, type EscalaMonetaria, type ModoAbono, type Tabla } from '../../core';
import { Campo } from '../Campo';
import { pesos } from '../formato';

interface Props {
  /** Tabla sin abono: de aquí salen los saldos para validar. */
  base: Tabla;
  gracia: number;
  plazo: number;
  escala: EscalaMonetaria;
  abono: AbonoExtra | null;
  alCambiar: (abono: AbonoExtra | null) => void;
}

/** HU-14: abono extraordinario en un periodo, reduciendo la cuota o el plazo. */
export function FormularioAbono({ base, gracia, plazo, escala, abono, alCambiar }: Props) {
  const [periodo, setPeriodo] = useState('');
  const [valor, setValor] = useState('');
  const [modo, setModo] = useState<ModoAbono>('reducir-plazo');
  const [errores, setErrores] = useState<ErroresAbono>({});

  const aplicar = (evento: FormEvent) => {
    evento.preventDefault();
    const validacion = validarAbono({
      periodo,
      valor,
      saldos: base.filas.map((f) => f.saldo),
      gracia,
      plazo,
      formatear: (monto) => pesos(monto, escala),
    });
    if (!validacion.ok) {
      setErrores(validacion.errores);
      return; // la tabla no cambia
    }
    setErrores({});
    alCambiar({ ...validacion.datos, modo });
  };

  return (
    <section className="tarjeta tarjeta--ancha" aria-labelledby="titulo-abono">
      <h2 id="titulo-abono">Abono extraordinario</h2>
      <p className="tarjeta__texto">Se paga al final del periodo elegido, después de su cuota.</p>
      <form className="formulario formulario--rejilla" onSubmit={aplicar} noValidate>
        <Campo
          nombre="abono-periodo"
          etiqueta="Periodo del abono"
          inputMode="numeric"
          valor={periodo}
          alCambiar={setPeriodo}
          error={errores.periodo}
        />
        <Campo
          nombre="abono-valor"
          etiqueta="Valor del abono ($)"
          inputMode="numeric"
          valor={valor}
          alCambiar={setValor}
          error={errores.valor}
        />
        <fieldset className="opciones">
          <legend>¿Qué quieres reducir?</legend>
          <label>
            <input type="radio" name="modo-abono" checked={modo === 'reducir-plazo'} onChange={() => setModo('reducir-plazo')} />{' '}
            Reducir el plazo (misma cuota)
          </label>
          <label>
            <input
              type="radio"
              name="modo-abono"
              checked={modo === 'recalcular-cuota'}
              onChange={() => setModo('recalcular-cuota')}
            />{' '}
            Reducir la cuota (mismo plazo)
          </label>
        </fieldset>
        <div className="acciones">
          <button type="submit" className="boton">
            Aplicar abono
          </button>
          {abono && (
            <button type="button" className="boton boton--secundario" onClick={() => alCambiar(null)}>
              Quitar abono
            </button>
          )}
        </div>
      </form>
    </section>
  );
}
