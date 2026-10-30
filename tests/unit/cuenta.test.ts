import fc from 'fast-check';
import {
  LONGITUD_MAXIMA_CONTRASENA,
  LONGITUD_MAXIMA_NOMBRE,
  VERSION_POLITICA,
  validarCodigo,
  validarRegistro,
  type DatosRegistro,
} from '../../src/core';

const VALIDO: DatosRegistro = {
  nombre: 'Ana Pérez',
  correo: 'ana@udistrital.edu.co',
  contrasena: 'una frase larga',
  confirmacion: 'una frase larga',
  aceptaPolitica: true,
};

describe('core/cuenta: validarRegistro (HU-01)', () => {
  it('acepta un registro válido', () => {
    const r = validarRegistro(VALIDO);
    expect(r.ok).toBe(true);
  });

  it('criterio HU-01: sin marcar la política no se crea la cuenta y se explica por qué', () => {
    const r = validarRegistro({ ...VALIDO, aceptaPolitica: false });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errores.aceptaPolitica).toBe('Debes aceptar la política de tratamiento de datos para crear la cuenta.');
    }
  });

  it('normaliza el correo: quita espacios y pasa a minúsculas', () => {
    const r = validarRegistro({ ...VALIDO, correo: '  Ana@UDistrital.EDU.co ' });
    expect(r.ok && r.datos.correo).toBe('ana@udistrital.edu.co');
  });

  it('recorta el nombre', () => {
    const r = validarRegistro({ ...VALIDO, nombre: '  Ana  ' });
    expect(r.ok && r.datos.nombre).toBe('Ana');
  });

  it.each([
    ['nombre vacío', { nombre: '   ' }, 'nombre', 'Escribe tu nombre.'],
    ['nombre largo', { nombre: 'a'.repeat(LONGITUD_MAXIMA_NOMBRE + 1) }, 'nombre', 'El nombre admite hasta 60 caracteres.'],
    ['correo sin arroba', { correo: 'ana.udistrital.edu.co' }, 'correo', 'Escribe un correo válido, por ejemplo nombre@dominio.co.'],
    [
      'contraseña de 9 caracteres',
      { contrasena: '123456789', confirmacion: '123456789' },
      'contrasena',
      'La contraseña debe tener al menos 10 caracteres.',
    ],
    [
      'contraseña de 129 caracteres',
      { contrasena: 'a'.repeat(LONGITUD_MAXIMA_CONTRASENA + 1), confirmacion: 'a'.repeat(LONGITUD_MAXIMA_CONTRASENA + 1) },
      'contrasena',
      'La contraseña admite hasta 128 caracteres.',
    ],
    ['confirmación distinta', { confirmacion: 'otra frase larga' }, 'confirmacion', 'Las contraseñas no coinciden.'],
  ] as const)('rechaza %s', (_caso, cambio, campo, mensaje) => {
    const r = validarRegistro({ ...VALIDO, ...cambio });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errores[campo]).toBe(mensaje);
    }
  });

  it('acepta exactamente 10 y 128 caracteres de contraseña (bordes)', () => {
    for (const largo of [10, 128]) {
      const clave = 'x'.repeat(largo);
      expect(validarRegistro({ ...VALIDO, contrasena: clave, confirmacion: clave }).ok).toBe(true);
    }
  });

  it('reporta un solo mensaje por campo aunque fallen varias reglas', () => {
    const r = validarRegistro({ nombre: '', correo: 'x', contrasena: '1', confirmacion: '2', aceptaPolitica: false });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(Object.keys(r.errores).sort()).toEqual(['aceptaPolitica', 'confirmacion', 'contrasena', 'correo', 'nombre']);
    }
  });

  it('propiedad: sin aceptar la política nunca es válido', () => {
    fc.assert(
      fc.property(fc.string(), fc.string(), fc.string(), (nombre, correo, contrasena) => {
        const r = validarRegistro({ nombre, correo, contrasena, confirmacion: contrasena, aceptaPolitica: false });
        return !r.ok && r.errores.aceptaPolitica !== undefined;
      }),
    );
  });

  it('la versión de la política es una fecha ISO', () => {
    expect(VERSION_POLITICA).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('core/cuenta: validarCodigo', () => {
  it.each(['1234', '123456', '12345678', ' 654321 '])('acepta "%s"', (codigo) => {
    const r = validarCodigo(codigo);
    expect(r.ok && r.datos).toBe(codigo.trim());
  });

  it.each(['', '123', '123456789', '12a456', '12 34'])('rechaza "%s"', (codigo) => {
    const r = validarCodigo(codigo);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errores).toBe('El código tiene solo números. Revísalo en tu correo.');
    }
  });
});
