import { Ayuda } from './ayuda/Ayuda';
import { TEMAS, type Tema } from './tema';

interface Props {
  tema: Tema;
  alElegir: (tema: Tema) => void;
}

/**
 * Botones «Sistema / Claro / Oscuro» de la cabecera. Cada uno es un botón con aria-pressed,
 * así que se maneja con teclado y lector de pantalla. El activo se marca con ✓ y negrita, no solo con color.
 */
export function SelectorTema({ tema, alElegir }: Props) {
  return (
    <div className="selector-tema">
      <div role="group" aria-label="Tema de color" className="selector-tema__grupo">
        {TEMAS.map((opcion) => (
          <button
            key={opcion.valor}
            type="button"
            className="selector-tema__opcion"
            aria-pressed={tema === opcion.valor}
            onClick={() => alElegir(opcion.valor)}
          >
            {opcion.nombre}
          </button>
        ))}
      </div>
      <Ayuda id="tema" />
    </div>
  );
}
