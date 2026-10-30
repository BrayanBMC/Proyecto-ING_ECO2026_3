import type { InputHTMLAttributes } from 'react';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'name' | 'onChange'> & {
  nombre: string;
  etiqueta: string;
  valor: string;
  alCambiar: (valor: string) => void;
  error?: string | undefined;
  ayuda?: string | undefined;
};

/** Campo de texto con etiqueta, ayuda y error enlazados para lectores de pantalla. */
export function Campo({ nombre, etiqueta, valor, alCambiar, error, ayuda, ...resto }: Props) {
  const describe = [ayuda && `${nombre}-ayuda`, error && `${nombre}-error`].filter(Boolean).join(' ');
  return (
    <div className="campo">
      <label htmlFor={nombre}>{etiqueta}</label>
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
