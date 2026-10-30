import { armarExportacion, perfilInicial, validarPerfil, type FormularioPerfil } from '../../src/core';

const VALIDO: FormularioPerfil = {
  nombre: ' Ana Pérez ',
  institucion: ' Universidad Distrital ',
  programa: '',
  escala: 2,
  baseDiaria: 365,
};

describe('core/perfil (HU-04)', () => {
  it('perfilInicial usa el nombre de la cuenta, sin decimales y base 360', () => {
    expect(perfilInicial('Ana')).toEqual({ nombre: 'Ana', institucion: null, programa: null, escala: 0, baseDiaria: 360 });
  });

  it('recorta los textos y guarda los opcionales vacíos como null', () => {
    const r = validarPerfil(VALIDO);
    expect(r.ok && r.datos).toEqual({
      nombre: 'Ana Pérez',
      institucion: 'Universidad Distrital',
      programa: null,
      escala: 2,
      baseDiaria: 365,
    });
  });

  it('rechaza nombre vacío e institución o programa de más de 80 caracteres', () => {
    const r = validarPerfil({ ...VALIDO, nombre: ' ', institucion: 'x'.repeat(81), programa: 'y'.repeat(81) });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errores).toEqual({
        nombre: 'Escribe tu nombre.',
        institucion: 'La institución admite hasta 80 caracteres.',
        programa: 'El programa admite hasta 80 caracteres.',
      });
    }
  });

  it('rechaza escalas y bases que no existen', () => {
    const r = validarPerfil({ ...VALIDO, escala: 1 as 0, baseDiaria: 300 as 360 });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(Object.keys(r.errores).sort()).toEqual(['baseDiaria', 'escala']);
    }
  });
});

describe('core/perfil: armarExportacion (HU-05)', () => {
  it('incluye cuenta, perfil, consentimientos y la fecha de generación', () => {
    const datos = armarExportacion({
      correo: 'ana@correo.co',
      perfil: perfilInicial('Ana'),
      consentimientos: [{ version: '2026-10-30', aceptadoEn: '2026-10-30T15:00:00Z' }],
      generadoEn: new Date('2026-10-31T12:00:00Z'),
    });
    expect(datos).toEqual({
      aplicacion: 'Amortiza',
      generado_en: '2026-10-31T12:00:00.000Z',
      cuenta: { correo: 'ana@correo.co' },
      perfil: perfilInicial('Ana'),
      consentimientos: [{ version: '2026-10-30', aceptadoEn: '2026-10-30T15:00:00Z' }],
      simulaciones: [],
      escenarios: [],
    });
  });

  it('funciona sin perfil guardado', () => {
    const datos = armarExportacion({ correo: 'a@b.co', perfil: null, consentimientos: [], generadoEn: new Date(0) });
    expect(datos.perfil).toBeNull();
  });
});
