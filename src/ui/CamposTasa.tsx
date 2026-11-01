import { FRECUENCIAS, type EscalaMonetaria, type Frecuencia, type TipoTasa } from '../core';
import { Campo } from './Campo';

const TIPOS: { valor: TipoTasa; nombre: string }[] = [
  { valor: 'nominal-vencida', nombre: 'Nominal vencida' },
  { valor: 'nominal-anticipada', nombre: 'Nominal anticipada' },
  { valor: 'efectiva', nombre: 'Efectiva' },
];

interface PropsTasa {
  tasa: string;
  tipo: TipoTasa;
  frecuencia: Frecuencia;
  error?: string | undefined;
  alCambiarTasa: (valor: string) => void;
  alCambiarTipo: (valor: TipoTasa) => void;
  alCambiarFrecuencia: (valor: Frecuencia) => void;
}

/** Tasa, tipo y capitalización: los mismos tres campos que el simulador, para convertir igual en todos los módulos. */
export function CamposTasa({ tasa, tipo, frecuencia, error, alCambiarTasa, alCambiarTipo, alCambiarFrecuencia }: PropsTasa) {
  return (
    <>
      <Campo
        nombre="tasa"
        etiqueta="Tasa de interés (%)"
        inputMode="decimal"
        placeholder="2"
        valor={tasa}
        alCambiar={alCambiarTasa}
        error={error}
        ayuda="Usa coma para decimales, por ejemplo 1,5."
      />
      <div className="campo">
        <label htmlFor="tipoTasa">Tipo de tasa</label>
        <select id="tipoTasa" value={tipo} onChange={(e) => alCambiarTipo(e.target.value as TipoTasa)}>
          {TIPOS.map((t) => (
            <option key={t.valor} value={t.valor}>
              {t.nombre}
            </option>
          ))}
        </select>
      </div>
      <SelectorFrecuencia
        id="frecuenciaTasa"
        etiqueta={tipo === 'efectiva' ? 'Periodo de la tasa' : 'Capitalización de la tasa'}
        valor={frecuencia}
        alCambiar={alCambiarFrecuencia}
      />
    </>
  );
}

export function SelectorFrecuencia({
  id,
  etiqueta,
  valor,
  alCambiar,
}: {
  id: string;
  etiqueta: string;
  valor: Frecuencia;
  alCambiar: (valor: Frecuencia) => void;
}) {
  return (
    <div className="campo">
      <label htmlFor={id}>{etiqueta}</label>
      <select id={id} value={valor} onChange={(e) => alCambiar(Number(e.target.value) as Frecuencia)}>
        {FRECUENCIAS.map((fr) => (
          <option key={fr.valor} value={fr.valor}>
            {fr.nombre}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Decimales en los montos: 0 (pesos) o 2 (para contrastar con Excel), como en el simulador. */
export function SelectorEscala({ escala, alCambiar }: { escala: EscalaMonetaria; alCambiar: (valor: EscalaMonetaria) => void }) {
  return (
    <fieldset className="opciones">
      <legend>Decimales en los montos</legend>
      <label>
        <input type="radio" name="escala" checked={escala === 0} onChange={() => alCambiar(0)} /> Sin decimales
      </label>
      <label>
        <input type="radio" name="escala" checked={escala === 2} onChange={() => alCambiar(2)} /> 2 decimales
      </label>
    </fieldset>
  );
}
