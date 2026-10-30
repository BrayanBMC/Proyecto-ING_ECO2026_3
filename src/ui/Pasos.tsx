import type { Paso } from '../core';

/**
 * HU-16: lista de pasos de un cálculo. Cada paso es enfocable con Tab y se lee completo
 * en un lector de pantalla: qué se calcula, la fórmula, los valores y el resultado.
 */
export function Pasos({ titulo, pasos }: { titulo: string; pasos: readonly Paso[] }) {
  return (
    <details>
      <summary>{titulo}</summary>
      <ol className="pasos">
        {pasos.map((paso) => (
          <li key={paso.titulo} tabIndex={0} className="paso">
            <span className="paso__titulo">{paso.titulo}</span>
            {paso.formula && <span className="mono">{paso.formula}</span>}
            <span className="mono">= {paso.sustitucion}</span>
            <strong className="mono">= {paso.resultado}</strong>
          </li>
        ))}
      </ol>
    </details>
  );
}
