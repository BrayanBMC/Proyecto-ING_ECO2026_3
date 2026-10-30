import { VERSION_POLITICA } from '../../core';

/** Contacto del responsable del tratamiento (Ley 1581 de 2012, art. 17 y Decreto 1377 de 2013, art. 13). */
export const CORREO_RESPONSABLE = 'bacostap@udistrital.edu.co';

export function PaginaPolitica() {
  return (
    <article className="documento" aria-labelledby="titulo-politica">
      <h1 id="titulo-politica">Política de tratamiento de datos personales</h1>
      <p className="documento__meta">
        Versión <span className="mono">{VERSION_POLITICA}</span>. Aplica la Ley 1581 de 2012 y el Decreto 1377 de 2013
        (compilado en el Decreto 1074 de 2015).
      </p>

      <h2>1. Responsable del tratamiento</h2>
      <p>
        Brayan Parrado, autor de Amortiza, proyecto académico de Ingeniería Económica. Contacto:{' '}
        <a href={`mailto:${CORREO_RESPONSABLE}`}>{CORREO_RESPONSABLE}</a>.
      </p>

      <h2>2. Datos que recogemos</h2>
      <ul>
        <li>Nombre y correo electrónico, al crear la cuenta.</li>
        <li>Contraseña, que el proveedor de autenticación guarda cifrada con un algoritmo de un solo sentido. Nadie puede leerla.</li>
        <li>Fecha, hora y versión de esta política cuando la aceptas.</li>
        <li>Más adelante, las simulaciones y preferencias que decidas guardar.</li>
      </ul>
      <p>No recogemos datos sensibles ni datos de menores de edad. El modo invitado no guarda ningún dato.</p>

      <h2>3. Finalidades</h2>
      <ul>
        <li>Crear y proteger tu cuenta, y verificar que el correo es tuyo.</li>
        <li>Guardar tu trabajo para que lo abras desde cualquier equipo.</li>
        <li>Enviarte solo los correos necesarios para la cuenta: códigos de verificación y recuperación de contraseña.</li>
      </ul>
      <p>No vendemos ni cedemos tus datos, y no los usamos para publicidad.</p>

      <h2>4. Encargado y transferencia internacional</h2>
      <p>
        Los datos se guardan en Neon (Neon Inc., Estados Unidos), en servidores de la región de São Paulo, Brasil. Neon
        actúa como encargado del tratamiento. Al aceptar esta política autorizas esa transmisión de datos fuera de
        Colombia.
      </p>

      <h2>5. Tus derechos</h2>
      <p>Como titular puedes:</p>
      <ul>
        <li>Conocer, actualizar y rectificar tus datos.</li>
        <li>Pedir prueba de la autorización que diste.</li>
        <li>Saber qué uso se ha dado a tus datos.</li>
        <li>Revocar la autorización y pedir que se borren tus datos.</li>
        <li>Presentar quejas ante la Superintendencia de Industria y Comercio.</li>
        <li>Acceder gratis a tus datos.</li>
      </ul>

      <h2>6. Cómo ejercerlos</h2>
      <p>
        Escribe a <a href={`mailto:${CORREO_RESPONSABLE}`}>{CORREO_RESPONSABLE}</a> desde el correo de tu cuenta.
        Respondemos consultas en máximo 10 días hábiles y reclamos en máximo 15 días hábiles, como indican los
        artículos 14 y 15 de la Ley 1581.
      </p>

      <h2>7. Vigencia</h2>
      <p>
        Esta versión rige desde el {VERSION_POLITICA}. Guardamos tus datos mientras tengas la cuenta. Si cambiamos esta
        política, te pediremos aceptar la nueva versión.
      </p>
    </article>
  );
}
