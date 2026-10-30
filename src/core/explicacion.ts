import type { Gracia, Sistema, Tabla } from './amortizacion';
import type { Dec } from './decimal';
import { numero } from './tasas';

/**
 * HU-16: pasos de "¿Cómo se calculó?" para la cuota y el primer periodo de pago.
 * Cada paso trae la fórmula, la fórmula con los valores del usuario y el resultado.
 * Los montos se formatean con la función que pasa la UI (formato es-CO).
 */

export interface Paso {
  titulo: string;
  formula: string;
  sustitucion: string;
  resultado: string;
}

const SUBINDICES = '₀₁₂₃₄₅₆₇₈₉';
const sub = (n: number) => [...String(n)].map((d) => SUBINDICES[Number(d)]).join('');

export function explicarAmortizacion(
  entrada: { capital: Dec; tasa: Dec; plazo: number; sistema: Sistema; gracia: Gracia; tabla: Tabla },
  pesos: (monto: Dec) => string,
): Paso[] {
  const { capital, tasa: i, plazo: n, sistema, gracia, tabla } = entrada;
  const g = gracia.periodos;
  const pasos: Paso[] = [];
  const iTxt = numero(i);

  if (g > 0 && gracia.tipo === 'muerta') {
    pasos.push({
      titulo: `Saldo al terminar la gracia (${g} periodos sin pagar)`,
      formula: `S${sub(g)} = P · (1 + i)^${g}`,
      sustitucion: `${pesos(capital)} · (1 + ${iTxt})^${g}`,
      resultado: `${pesos(tabla.filas[g]!.saldo)} (redondeando el interés de cada periodo)`,
    });
  } else if (g > 0) {
    pasos.push({
      titulo: `Cuota durante la gracia (${g} periodos, solo intereses)`,
      formula: 'R = P · i',
      sustitucion: `${pesos(capital)} · ${iTxt}`,
      resultado: pesos(tabla.filas[1]!.cuota),
    });
  }

  const s0 = tabla.filas[g]!.saldo; // saldo con el que empieza la amortización
  const k = g + 1;
  const primera = tabla.filas[k]!;
  const P = g > 0 && gracia.tipo === 'muerta' ? `S${sub(g)}` : 'P';

  if (sistema === 'frances') {
    pasos.push(
      i.isZero()
        ? { titulo: 'Cuota fija (tasa 0)', formula: `R = ${P} / n`, sustitucion: `${pesos(s0)} / ${n}`, resultado: pesos(primera.cuota) }
        : {
            titulo: 'Cuota fija (sistema Francés)',
            formula: `R = ${P} · i / (1 − (1 + i)^−n)`,
            sustitucion: `${pesos(s0)} · ${iTxt} / (1 − (1 + ${iTxt})^−${n})`,
            resultado: pesos(primera.cuota),
          },
    );
  } else {
    pasos.push({
      titulo: 'Abono fijo a capital (sistema Alemán)',
      formula: `A = ${P} / n`,
      sustitucion: `${pesos(s0)} / ${n}`,
      resultado: pesos(primera.abono),
    });
  }

  pasos.push({
    titulo: `Interés del periodo ${k}`,
    formula: `I${sub(k)} = S${sub(g)} · i`,
    sustitucion: `${pesos(s0)} · ${iTxt}`,
    resultado: pesos(primera.interes),
  });

  pasos.push(
    sistema === 'frances'
      ? {
          titulo: `Abono a capital del periodo ${k}`,
          formula: `A${sub(k)} = R − I${sub(k)}`,
          sustitucion: `${pesos(primera.cuota)} − ${pesos(primera.interes)}`,
          resultado: pesos(primera.abono),
        }
      : {
          titulo: `Cuota del periodo ${k}`,
          formula: `R${sub(k)} = A + I${sub(k)}`,
          sustitucion: `${pesos(primera.abono)} + ${pesos(primera.interes)}`,
          resultado: pesos(primera.cuota),
        },
  );

  pasos.push({
    titulo: `Saldo al final del periodo ${k}`,
    formula: `S${sub(k)} = S${sub(g)} − A${sub(k)}${primera.extra.isZero() ? '' : ' − abono extra'}`,
    sustitucion: `${pesos(s0)} − ${pesos(primera.abono)}${primera.extra.isZero() ? '' : ` − ${pesos(primera.extra)}`}`,
    resultado: pesos(primera.saldo),
  });

  return pasos;
}
