import {
  dec,
  GRACIA_MAXIMA,
  LIMITE_GUARDADAS,
  LONGITUD_MAXIMA_INSTITUCION,
  LONGITUD_MAXIMA_NOMBRE,
  LONGITUD_MAXIMA_NOMBRE_SIMULACION,
  MAX_PARTES,
  MIN_PARTES,
  MONTO_MAXIMO,
  PERIODOS_MAXIMOS,
  PLAZO_MAXIMO,
  TASA_MAXIMA,
  TASA_MINIMA,
  type Dec,
} from '../../core';
import { pesos } from '../formato';

/**
 * Glosario de la ayuda contextual (el botón «?»).
 *
 * Es la ÚNICA fuente de los textos de ayuda. Cada campo, resultado o término técnico de la interfaz
 * apunta a una entrada por su id; si el id no existe, TypeScript no compila.
 * Los rangos permitidos salen de las mismas constantes que usa la validación del motor, no se copian a mano.
 *
 * Redacción: frases cortas, sin jerga sin definir, tuteo neutro, ejemplos en pesos colombianos.
 * Son explicaciones educativas, no asesoría financiera.
 */

export interface Termino {
  /** Nombre que se muestra y que se lee en la pregunta del botón: «¿Qué es …?». */
  nombre: string;
  /** Explicación breve para el globo (máximo ~40 palabras). */
  corta: string;
  /** Explicación completa (párrafos separados por una línea en blanco). Va en el cuadro «Saber más». */
  larga?: string;
  /** Ejemplo con números reales en COP. */
  ejemplo?: string;
  /** Valores permitidos, tomados de las constantes del motor. */
  rango?: string;
  /** El error que más se comete con este dato. */
  errorComun?: string;
  /** true si el resultado tiene un panel «¿Cómo se calculó?» en pantalla. */
  verPasos?: boolean;
}

const moneda = (valor: Dec) => pesos(valor, 0);
const porcentajeEs = (valor: Dec) => `${valor.toString().replace('.', ',')} %`;

/** Los montos van de $ 1 al máximo del motor. */
const RANGO_MONTO = `De ${moneda(dec(1))} a ${moneda(MONTO_MAXIMO)}.`;
const RANGO_TASA = `De ${porcentajeEs(TASA_MINIMA)} a ${porcentajeEs(TASA_MAXIMA)}.`;

export const GLOSARIO = {
  // ——— Datos del crédito ———
  monto: {
    nombre: 'Monto del crédito',
    corta: 'El dinero que te prestan, sin contar los intereses. Es lo que recibes hoy y lo que luego devuelves poco a poco.',
    larga: 'Escribe solo el valor prestado. Los intereses los calcula la app a partir de la tasa y del número de cuotas.',
    ejemplo: 'Si el banco te desembolsa $ 10.000.000, ese es el monto.',
    rango: RANGO_MONTO,
    errorComun: 'Sumarle los intereses al monto. Aquí va únicamente lo que recibes prestado.',
  },
  plazo: {
    nombre: 'Número de cuotas',
    corta: 'Cuántos pagos harás hasta terminar de pagar la deuda. Si pagas cada mes durante un año, son 12 cuotas.',
    larga: 'Se cuentan en pagos, no en años. El tiempo total depende de cada cuánto pagas (mensual, quincenal…).',
    ejemplo: '24 cuotas mensuales son 2 años. 24 cuotas quincenales son solo 1 año.',
    rango: `Un número entero de 1 a ${PLAZO_MAXIMO}.`,
    errorComun: 'Escribir los años en lugar de las cuotas: 2 años pagando cada mes son 24 cuotas, no 2.',
  },
  frecuenciaPago: {
    nombre: 'Frecuencia de pago',
    corta: 'Cada cuánto haces un pago: cada mes, cada quincena, cada trimestre… Con pagos más seguidos, cada cuota es más pequeña.',
    ejemplo: 'Con 24 cuotas y pago quincenal terminas en 12 meses; con pago mensual, en 24 meses.',
    errorComun: 'Olvidar que el número de cuotas se cuenta con esta frecuencia.',
  },
  tasa: {
    nombre: 'Tasa de interés',
    corta: 'El porcentaje que te cobran por prestarte el dinero. Mientras más alta, más caro es el crédito.',
    larga:
      'La tasa se puede expresar de varias formas (efectiva o nominal, vencida o anticipada). Elige abajo la que dice tu contrato: la app la convierte sola a la tasa real que pagas.',
    ejemplo: 'Una tasa de 24 % nominal anual pagada cada mes equivale a cobrar 2 % cada mes.',
    rango: RANGO_TASA,
    errorComun: 'Poner la tasa mensual cuando el contrato la da anual, o al revés. Mira si dice «mensual» o «anual».',
  },
  tipoTasa: {
    nombre: 'Tipo de tasa',
    corta: 'Efectiva: ya cuenta el interés sobre interés. Nominal: es una tasa «de papel» que se reparte entre los periodos. Vencida se cobra al final del periodo; anticipada, al inicio.',
    larga:
      'Efectiva: es la que realmente pagas en el periodo que indica.\n\nNominal vencida: se divide entre los periodos y el interés se cobra al final de cada uno.\n\nNominal anticipada: el interés se cobra al inicio del periodo, por adelantado. Por eso cuesta más que la vencida con el mismo número.',
    ejemplo: '24 % nominal vencida, pagada cada mes, es 2 % cada mes y 26,82 % efectivo anual. Un 3 % mensual anticipado equivale a cerca de 3,09 % vencido.',
    errorComun: 'Comparar un 24 % nominal con un 24 % efectivo: no cuestan lo mismo.',
  },
  capitalizacion: {
    nombre: 'Capitalización de la tasa',
    corta: 'Cada cuánto se suma el interés a la deuda para que también genere interés. Si es mensual, cada mes el interés pasa a formar parte del saldo.',
    ejemplo: 'Con 12 % nominal capitalizado cada mes, se cobra 1 % cada mes.',
    errorComun: 'Elegir «Anual» cuando el contrato dice que el interés se cobra cada mes.',
  },
  sistema: {
    nombre: 'Sistema de amortización',
    corta: 'La forma de repartir los pagos. Francés: la cuota es siempre igual. Alemán: pagas siempre la misma parte de la deuda, así que la cuota empieza más alta y va bajando.',
    larga:
      'En el Francés al principio pagas más intereses y menos deuda; la cuota no cambia.\n\nEn el Alemán abonas lo mismo a la deuda en cada cuota; como la deuda baja más rápido, los intereses también bajan y en total pagas menos.',
    ejemplo: 'Para $ 12.000.000 a 12 cuotas con 1 % mensual: el Francés cobra unos $ 1.066.185 en cada cuota; el Alemán empieza en $ 1.120.000 y va bajando.',
    errorComun: 'Pensar que la cuota más baja es siempre la más barata: el Francés paga más intereses en total.',
  },
  graciaPeriodos: {
    nombre: 'Periodos de gracia',
    corta: 'Los primeros periodos en los que no pagas abono a la deuda. Después empiezas a pagar las cuotas normales.',
    ejemplo: 'Con 3 periodos de gracia en un crédito mensual, pasan 3 meses antes de la primera cuota normal.',
    rango: `Un número entero de 0 a ${GRACIA_MAXIMA}. Se suman a las cuotas.`,
    errorComun: 'Creer que la gracia es gratis: la deuda sigue generando intereses.',
  },
  graciaTipo: {
    nombre: 'Tipo de gracia',
    corta: 'Muerta: no pagas nada y el interés se suma a la deuda. Con pago de intereses: pagas solo el interés de cada periodo y la deuda no crece.',
    larga:
      'Gracia muerta: durante la gracia no pagas nada, pero los intereses se acumulan. Después pagas más, porque la deuda creció.\n\nGracia con pago de intereses: pagas solo los intereses de cada periodo. La deuda sigue igual y, al terminar, las cuotas se calculan sobre el mismo monto.',
    ejemplo: 'Con $ 10.000.000 al 1,5 % mensual y 3 meses de gracia muerta, la deuda sube a $ 10.456.784. Con pago de intereses, pagas $ 150.000 cada mes y la deuda sigue en $ 10.000.000.',
    errorComun: 'Elegir gracia muerta sin notar que la deuda crece durante ese tiempo.',
  },
  graciaMuerta: {
    nombre: 'Gracia muerta',
    corta: 'Durante la gracia no pagas nada, pero el interés se suma a tu deuda. Después pagas intereses sobre una deuda más grande.',
    ejemplo: '$ 10.000.000 al 1,5 % mensual con 3 meses de gracia muerta: la deuda llega a $ 10.456.784 antes de la primera cuota.',
  },
  graciaIntereses: {
    nombre: 'Gracia con pago de intereses',
    corta: 'Durante la gracia pagas solo los intereses de cada periodo. La deuda no crece, pero tampoco baja.',
    ejemplo: '$ 10.000.000 al 1,5 % mensual: pagas $ 150.000 cada mes de gracia.',
  },
  diferenciaGracia: {
    nombre: 'Diferencia entre las dos gracias',
    corta: 'Cuánto más pagas de intereses en total con gracia muerta que pagando los intereses durante la gracia.',
  },
  // ——— Abono extraordinario ———
  abonoPeriodo: {
    nombre: 'Periodo del abono',
    corta: 'En qué periodo haces el pago extra. Se paga al final de ese periodo, después de su cuota normal.',
    larga: 'Los periodos se numeran desde el inicio del crédito, y los de gracia también cuentan. El primero posible es el siguiente a la gracia y el último, el penúltimo del crédito.',
    ejemplo: 'Con 12 cuotas y sin gracia, puedes abonar entre el periodo 1 y el 11.',
    errorComun: 'No contar los periodos de gracia al elegir el periodo.',
  },
  abonoValor: {
    nombre: 'Valor del abono',
    corta: 'El dinero extra que pagas de una sola vez para deber menos. No puede superar lo que debes en ese momento.',
    ejemplo: 'Un abono de $ 2.000.000 en el periodo 3 baja la deuda en esa cantidad.',
    errorComun: 'Escribir un abono mayor que el saldo de ese periodo. La app te dice cuánto debes ese día.',
  },
  abonoModo: {
    nombre: 'Qué reducir con el abono',
    corta: 'Reducir el plazo: pagas la misma cuota y terminas antes. Reducir la cuota: terminas en la misma fecha pero pagas menos en cada cuota.',
    larga: 'Reducir el plazo suele ahorrar más intereses. Reducir la cuota alivia el pago de cada periodo. Prueba los dos y compara la tabla.',
  },
  // ——— Usura ———
  usura: {
    nombre: 'Tasa de usura',
    corta: 'El máximo de interés que la ley permite cobrar. Se calcula como 1,5 veces el interés bancario corriente (IBC). Cobrar más que eso no está permitido.',
    ejemplo: 'Si el IBC es 19,06 % efectivo anual, la usura es 1,5 × 19,06 % = 28,59 %.',
    errorComun: 'Comparar la usura (que es efectiva anual) con una tasa mensual. La app las compara en la misma medida.',
  },
  ibc: {
    nombre: 'Interés bancario corriente (IBC)',
    corta: 'El promedio de lo que cobran los bancos por créditos. La Superintendencia Financiera lo publica cada mes y con él se calcula la usura.',
    ejemplo: 'En octubre de 2026 el IBC fue 19,06 % efectivo anual.',
    rango: `De ${porcentajeEs(TASA_MINIMA)} a ${porcentajeEs(TASA_MAXIMA)}, efectivo anual.`,
    errorComun: 'Escribir el IBC mensual en vez del efectivo anual.',
  },
  ibcVigencia: {
    nombre: 'Vigente hasta',
    corta: 'El último día del mes en que rige ese IBC. Pasada esa fecha, la Superintendencia publica uno nuevo.',
  },
  // ——— Preferencias ———
  decimales: {
    nombre: 'Decimales en los montos',
    corta: 'Sin decimales muestra pesos enteros. Con 2 decimales muestra centavos, igual que una hoja de cálculo.',
    ejemplo: 'Una cuota se ve como $ 916.800 o, con 2 decimales, como $ 916.799,93.',
    errorComun: 'Comparar con Excel sin decimales y extrañarse por diferencias de centavos.',
  },
  baseDiaria: {
    nombre: 'Días del año para tasas diarias',
    corta: 'Cuántos días se cuentan en un año al convertir una tasa a tasa diaria: 360 (año comercial) o 365 (año calendario).',
    ejemplo: 'Una tasa de 36 % anual son 0,1 % por día con 360 días y cerca de 0,0986 % por día con 365.',
  },
  tema: {
    nombre: 'Tema de color',
    corta: 'Elige cómo se ve la app: Claro, Oscuro, o «Sistema» para que use el mismo que tu dispositivo.',
    larga: 'Con una cuenta, tu elección se guarda en tu perfil y se aplica en otros equipos. Sin cuenta, vale mientras no cierres la página. Los PDF y Excel siempre salen en fondo blanco para imprimirlos.',
  },
  // ——— Resultados del crédito ———
  tasaIngresada: {
    nombre: 'Tasa ingresada',
    corta: 'La tasa tal como la escribiste, con su tipo. Abajo verás a cuánto equivale en tasa efectiva anual y por cada periodo de pago.',
  },
  cuota: {
    nombre: 'Cuota',
    corta: 'Lo que pagas en cada periodo para ir cubriendo la deuda y sus intereses. Con el sistema Francés es siempre igual; con el Alemán va bajando.',
    ejemplo: '$ 10.000.000 a 12 cuotas con 1,5 % mensual: cuota de $ 916.800.',
    verPasos: true,
  },
  ea: {
    nombre: 'Tasa efectiva anual (EA)',
    corta: 'Lo que realmente pagas en un año por cada $ 100 prestados, ya contando el interés sobre interés.',
    larga: 'Sirve para comparar créditos con tasas expresadas de formas distintas (mensual, anual, anticipada…): todas se convierten a esta misma medida.',
    ejemplo: 'Un 1,5 % mensual equivale a 19,56 % EA, porque 1,015 elevado a 12 es 1,1956.',
    verPasos: true,
  },
  tasaPeriodica: {
    nombre: 'Tasa del periodo',
    corta: 'El interés que se cobra en cada periodo de pago: cada mes, cada quincena… Es la tasa que usa la tabla para calcular los intereses de cada cuota.',
    ejemplo: 'Una EA de 19,56 % es un 1,5 % cada mes.',
    verPasos: true,
  },
  interesesTotales: {
    nombre: 'Total de intereses',
    corta: 'Todo lo que pagas de más por haber pedido prestado: la suma de los intereses de todas las cuotas.',
    ejemplo: 'Con $ 10.000.000 a 12 cuotas con 1,5 % mensual, son cerca de $ 1.001.600.',
  },
  totalPagado: {
    nombre: 'Total pagado',
    corta: 'La suma de todo lo que entregas hasta terminar: el dinero prestado más los intereses.',
    ejemplo: '$ 10.000.000 prestados más cerca de $ 1.001.600 de intereses: pagas unos $ 11.001.600.',
  },
  delta: {
    nombre: 'Sobrecosto Δ (delta)',
    corta: 'Cuánto más pagas de intereses con el sistema Francés que con el Alemán, expresado en porcentaje.',
    ejemplo: 'Para $ 12.000.000 a 12 cuotas con 1 % mensual, el Alemán paga $ 780.000 de intereses y el Francés cerca de $ 794.225: Δ ≈ 1,82 %.',
  },
  rho: {
    nombre: 'ρ (ro)',
    corta: 'Cuántos pesos de interés pagas por cada peso prestado. Sirve para comparar créditos de tamaños distintos.',
    ejemplo: 'ρ = 0,10 significa $ 10 de interés por cada $ 100 prestados.',
  },
  tablaAmortizacion: {
    nombre: 'Tabla de amortización',
    corta: 'Cuota a cuota: cuánto pagas, cuánto de eso son intereses, cuánto baja tu deuda y cuánto te queda por pagar (saldo).',
    larga: 'La fila 0 es el desembolso. En cada fila: Cuota = Interés + Abono a capital, y el Saldo es lo que aún debes. Al final el saldo es 0.',
  },
  // ——— Calculadoras: interés compuesto ———
  incognita: {
    nombre: 'Qué quieres calcular',
    corta: 'Elige el dato que quieres averiguar. Los demás los escribes tú.',
  },
  capitalInicial: {
    nombre: 'Capital inicial (P)',
    corta: 'El dinero que tienes o inviertes hoy, al comienzo.',
    ejemplo: 'Si hoy guardas $ 1.000.000, ese es P.',
    rango: RANGO_MONTO,
  },
  montoFinal: {
    nombre: 'Monto final (S)',
    corta: 'El dinero que habrá al final, ya con los intereses.',
    ejemplo: 'Si quieres llegar a $ 2.000.000, ese es S.',
    rango: RANGO_MONTO,
  },
  periodos: {
    nombre: 'Número de periodos (n)',
    corta: 'Cuántos periodos pasan (meses, años…). Puede tener decimales, por ejemplo 2,5.',
    ejemplo: 'Un dinero al 2 % mensual se duplica en cerca de 35 meses.',
    rango: `Mayor que 0 y hasta ${PERIODOS_MAXIMOS}.`,
  },
  duracionPeriodo: {
    nombre: 'Duración de cada periodo',
    corta: 'Lo que dura cada periodo: un mes, un trimestre, un año… La tasa se convierte a esa medida.',
    errorComun: 'Contar los periodos en meses y elegir «Anual» aquí.',
  },
  valorFuturo: {
    nombre: 'Valor futuro (S)',
    corta: 'Cuánto dinero tendrás al final si dejas el capital creciendo con interés compuesto: cada periodo se paga interés también sobre los intereses anteriores.',
    ejemplo: '$ 1.000.000 al 2 % mensual durante 10 meses se convierten en cerca de $ 1.218.994.',
    verPasos: true,
  },
  valorPresente: {
    nombre: 'Valor presente (P)',
    corta: 'Cuánto vale hoy un dinero que recibirás en el futuro. Como el dinero de hoy rinde, recibir $ 2.000.000 más adelante vale menos hoy.',
    ejemplo: '$ 2.000.000 dentro de 35 meses, a 2 % mensual, valen hoy cerca de $ 1.000.000.',
    verPasos: true,
  },
  periodosNecesarios: {
    nombre: 'Periodos necesarios',
    corta: 'Cuántos periodos tarda el capital en llegar al monto final. Puede dar con decimales; en ese caso se necesita el siguiente periodo completo.',
    ejemplo: '$ 1.000.000 llega a $ 2.000.000 al 2 % mensual en 35,0028 meses.',
    verPasos: true,
  },
  nominalAnual: {
    nombre: 'Tasa nominal anual',
    corta: 'La tasa del periodo multiplicada por los periodos que tiene un año. Es la forma «de papel» de expresarla.',
    ejemplo: '2 % mensual × 12 = 24 % nominal anual.',
  },
  // ——— Calculadoras: anualidades ———
  objetivoAnualidad: {
    nombre: 'Qué quieres calcular (anualidades)',
    corta: 'Con la cuota calculas cuánto acumulas y cuánto valen hoy tus pagos. O al revés: con una meta o un valor de hoy, calculas qué cuota necesitas.',
  },
  cuotaA: {
    nombre: 'Cuota periódica (A)',
    corta: 'El pago igual que haces en cada periodo, durante todo el plazo.',
    ejemplo: 'Ahorrar $ 500.000 cada mes: A = $ 500.000.',
  },
  metaS: {
    nombre: 'Valor futuro meta (S)',
    corta: 'La cantidad que quieres tener al final, por ejemplo para una meta de ahorro.',
    ejemplo: 'Juntar $ 6.000.000 en 12 meses.',
  },
  valorPresenteP: {
    nombre: 'Valor presente (P)',
    corta: 'Lo que vale hoy el conjunto de pagos iguales: cuánto equivale a pagar todo hoy.',
    ejemplo: 'Pagar 12 cuotas de $ 500.000 equivale hoy a cerca de $ 5.627.539 con 1 % mensual.',
  },
  numPagos: {
    nombre: 'Número de pagos (n)',
    corta: 'Cuántos pagos iguales haces.',
    rango: `Un número entero de 1 a ${PLAZO_MAXIMO}.`,
  },
  anualidadVencidaAnticipada: {
    nombre: 'Pagos vencidos y anticipados',
    corta: 'Vencidos: pagas al final de cada periodo. Anticipados: pagas al inicio, así que cada pago genera un periodo más de interés.',
    ejemplo: 'Ahorrando $ 500.000 al mes durante 12 meses al 1 % mensual: con pagos al inicio acumulas cerca de $ 6.404.664; con pagos al final, cerca de $ 6.341.252.',
  },
  // ——— Calculadoras: reparto ———
  repartoMonto: {
    nombre: 'Monto a repartir',
    corta: 'La cantidad total de dinero que se divide entre las partes.',
    ejemplo: 'Repartir $ 1.000.000 entre tres socios.',
    rango: RANGO_MONTO,
  },
  repartoMetodo: {
    nombre: 'Método de reparto',
    corta: 'Directo: a mayor índice, mayor parte. Inverso: a mayor índice, menor parte. Compuesto: la parte depende de dos índices multiplicados.',
    larga: 'Directo: por ejemplo, quien aportó más recibe más.\n\nInverso: por ejemplo, quien llegó más tarde recibe menos.\n\nCompuesto: por ejemplo, el aporte multiplicado por el tiempo. En todos, la suma de las partes da exactamente el monto.',
  },
  repartoNombre: {
    nombre: 'Nombre de la parte',
    corta: 'Un nombre para reconocer a quién corresponde la parte. Es opcional.',
    rango: `Se reparte entre ${MIN_PARTES} y ${MAX_PARTES} partes.`,
  },
  repartoIndice: {
    nombre: 'Índice de la parte',
    corta: 'El número con el que se compara cada parte. Puede ser un aporte, los días trabajados, los hijos… Mientras más alto, más pesa en el reparto.',
    ejemplo: 'Tres socios aportaron 1, 2 y 4: el tercero recibe cuatro veces lo del primero.',
    errorComun: 'En el reparto inverso, escribir 0: se divide entre el índice y no se puede.',
  },
  repartoIndice2: {
    nombre: 'Segundo índice de la parte',
    corta: 'En el reparto compuesto, un segundo número que se multiplica por el primero. Por ejemplo, el aporte y el tiempo.',
    ejemplo: 'Un socio que aportó 2 durante 3 meses pesa 2 × 3 = 6.',
  },
  // ——— Cuenta y simulaciones guardadas ———
  perfilNombre: {
    nombre: 'Nombre',
    corta: 'Cómo quieres que te llamemos. Aparece en la cabecera y en el encabezado de los PDF y Excel que descargas.',
    rango: `Hasta ${LONGITUD_MAXIMA_NOMBRE} caracteres.`,
  },
  perfilInstitucion: {
    nombre: 'Institución',
    corta: 'Tu universidad o colegio, si quieres que salga en tus reportes. Es opcional.',
    rango: `Hasta ${LONGITUD_MAXIMA_INSTITUCION} caracteres.`,
  },
  perfilPrograma: {
    nombre: 'Programa',
    corta: 'Tu carrera o curso, si quieres que salga en tus reportes. Es opcional.',
    rango: `Hasta ${LONGITUD_MAXIMA_INSTITUCION} caracteres.`,
  },
  confirmarContrasena: {
    nombre: 'Contraseña para confirmar',
    corta: 'Escribe tu contraseña para confirmar que eres tú antes de borrar la cuenta. Esta acción no se puede deshacer.',
  },
  nombreSimulacion: {
    nombre: 'Nombre de la simulación',
    corta: 'Un nombre para reconocerla después en «Mis simulaciones». Si lo dejas vacío, se usa la fecha de hoy.',
    ejemplo: 'Crédito de vivienda con Banco X.',
    rango: `Hasta ${LONGITUD_MAXIMA_NOMBRE_SIMULACION} caracteres. Puedes guardar hasta ${LIMITE_GUARDADAS}.`,
  },
  enlaceCompartir: {
    nombre: 'Enlace para compartir',
    corta: 'Una dirección que contiene los datos de esta simulación. Quien la abra verá la misma tabla, sin crear cuenta. Los datos van en la dirección y no se envían a ningún servidor.',
  },
} as const satisfies Record<string, Termino>;

export type TerminoId = keyof typeof GLOSARIO;

/** Cantidad de palabras de un texto, para vigilar que la explicación corta no se alargue. */
export function contarPalabras(texto: string): number {
  return texto.trim().split(/\s+/).filter(Boolean).length;
}
