import type { InputHTMLAttributes } from 'react';
import { EtiquetaAyuda } from './ayuda/Ayuda';
import type { TerminoId } from './ayuda/glosario';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'name' | 'onChange'> & {
  nombre: string;
  etiqueta: string;
  valor: string;
  alCambiar: (valor: string) => void;
  error?: string | undefined;
  ayuda?: string | undefined;
  /** Término del glosario que explica este campo (muestra el botón «?»). */
  termino?: TerminoId | undefined;
};

/** Campo de texto con etiqueta, ayuda y error enlazados para lectores de pantalla. */
export function Campo({ nombre, etiqueta, valor, alCambiar, error, ayuda, termino, ...resto }: Props) {
  const describe = [ayuda && `${nombre}-ayuda`, error && `${nombre}-error`].filter(Boolean).join(' ');
  return (
    <div className="campo">
      {termino ? (
        <EtiquetaAyuda htmlFor={nombre} termino={termino}>
          {etiqueta}
        </EtiquetaAyuda>
      ) : (
        <label htmlFor={nombre}>{etiqueta}</label>
      )}
      <input
        {...resto}
        id={nombre}
        name={nombre}
        value={valor}
        onChange={(e) => alCambiar(e.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={describe || undefined}
      />
      {ayuda && (
        <p id={`${nombre}-ayuda`} className="campo__ayuda">
          {ayuda}
        </p>
      )}
      {error && (
        <p id={`${nombre}-error`} className="campo__error">
          {error}
        </p>
      )}
    </div>
  );
}
