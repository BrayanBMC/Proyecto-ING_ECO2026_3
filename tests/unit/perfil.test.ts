import { armarExportacion, perfilInicial, validarPerfil, type FormularioPerfil, type SimulacionGuardada } from '../../src/core';

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
      simulaciones: [],
      generadoEn: new Date('2026-10-31T12:00:00Z'),
    });
    expect(datos).toEqual({
      aplicacion: 'Amortiza',
      generado_en: '2026-10-31T12:00:00.000Z',
      cuenta: { correo: 'ana@correo.co' },
      perfil: perfilInicial('Ana'),
      consentimientos: [{ version: '2026-10-30', aceptadoEn: '2026-10-30T15:00:00Z' }],
      simulaciones: [],
    });
  });

  it('incluye las simulaciones guardadas con su nombre, parámetros y fecha', () => {
    const guardada: SimulacionGuardada = {
      id: 'a',
      nombre: 'Casa',
      parametros: {
        monto: '10.000.000',
        plazo: '12',
        frecuenciaPago: 12,
        tasa: '1,5',
        tipoTasa: 'efectiva',
        frecuenciaTasa: 12,
        sistema: 'frances',
        graciaPeriodos: '',
        graciaTipo: 'muerta',
        escala: 0,
        abono: null,
      },
      actualizadoEn: '2026-11-01T15:00:00.000Z',
    };
    const datos = armarExportacion({
      correo: 'a@b.co',
      perfil: null,
      consentimientos: [],
      simulaciones: [guardada],
      generadoEn: new Date(0),
    });
    expect(datos.simulaciones).toEqual([guardada]);
    expect(datos).not.toHaveProperty('escenarios');
  });

  it('funciona sin perfil guardado', () => {
    const datos = armarExportacion({ correo: 'a@b.co', perfil: null, consentimientos: [], simulaciones: [], generadoEn: new Date(0) });
    expect(datos.perfil).toBeNull();
  });
});
