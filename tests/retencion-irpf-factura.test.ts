import { describe, it, expect } from 'vitest';
import {
  RETENCIONES,
  IVA_GENERAL,
  TIPOS_IVA,
  calcularFactura,
} from '../src/retencion-irpf-factura.js';

/**
 * Casos verificados contra fuente oficial:
 *  - Tipos de retención IRPF actividades profesionales: 15 % general y 7 %
 *    profesionales de nuevo inicio (año de alta + 2 siguientes). Art. 101.5.a)
 *    Ley 35/2006 del IRPF (BOE-A-2006-20764) + art. 95 RD 439/2007 (Reglamento
 *    IRPF). AEAT, "Cuadro de tipos de retención IRPF 2026" y Manual práctico de
 *    Actividades Económicas (apartado 7.1).
 *  - Tipo general de IVA 21 %: art. 90.Uno Ley 37/1992 del IVA (BOE-A-1992-28740).
 * Fórmula (cálculo propio): Total a cobrar = base + cuota IVA − retención IRPF.
 */

describe('constantes normativas 2026', () => {
  it('tipos de retención de actividades profesionales (art. 101.5.a LIRPF)', () => {
    expect(RETENCIONES.general).toBeCloseTo(0.15, 4);
    expect(RETENCIONES.nuevo).toBeCloseTo(0.07, 4);
  });

  it('tipo general de IVA (art. 90.Uno Ley 37/1992)', () => {
    expect(IVA_GENERAL).toBeCloseTo(0.21, 4);
  });
});

describe('ejemplo resuelto de la página (Marta, diseñadora freelance)', () => {
  // Base 1.000 €, retención general 15 %, IVA general 21 %.
  it('base 1.000 €, IVA 21 %, retención 15 % → 1.060,00 € a cobrar', () => {
    const r = calcularFactura({ base: 1000, tipoIva: IVA_GENERAL, tipoRetencion: RETENCIONES.general });
    expect(r.cuotaIva).toBeCloseTo(210, 2);
    expect(r.retencion).toBeCloseTo(150, 2);
    expect(r.totalACobrar).toBeCloseTo(1060, 2);
  });
});

describe('tipo reducido para nuevos autónomos (7 %)', () => {
  it('base 1.000 €, IVA 21 %, retención 7 % → 1.140,00 € a cobrar', () => {
    const r = calcularFactura({ base: 1000, tipoIva: IVA_GENERAL, tipoRetencion: RETENCIONES.nuevo });
    expect(r.cuotaIva).toBeCloseTo(210, 2);
    expect(r.retencion).toBeCloseTo(70, 2);
    expect(r.totalACobrar).toBeCloseTo(1140, 2);
  });
});

describe('factura exenta de IVA (arts. 20 y ss. Ley 37/1992)', () => {
  it('base 1.000 €, IVA 0 %, retención 15 % → 850,00 € a cobrar', () => {
    const r = calcularFactura({ base: 1000, tipoIva: 0, tipoRetencion: RETENCIONES.general });
    expect(r.cuotaIva).toBeCloseTo(0, 2);
    expect(r.retencion).toBeCloseTo(150, 2);
    expect(r.totalACobrar).toBeCloseTo(850, 2);
  });

  it('base 2.000 €, IVA 0 %, retención 7 % → 1.860,00 € a cobrar', () => {
    const r = calcularFactura({ base: 2000, tipoIva: 0, tipoRetencion: RETENCIONES.nuevo });
    expect(r.cuotaIva).toBeCloseTo(0, 2);
    expect(r.retencion).toBeCloseTo(140, 2);
    expect(r.totalACobrar).toBeCloseTo(1860, 2);
  });
});

describe('casos frontera y coherencia', () => {
  it('base 0 → todo 0', () => {
    const r = calcularFactura({ base: 0, tipoIva: IVA_GENERAL, tipoRetencion: RETENCIONES.general });
    expect(r.cuotaIva).toBe(0);
    expect(r.retencion).toBe(0);
    expect(r.totalACobrar).toBe(0);
  });

  it('total = base × (1 + tipoIva − tipoRetencion)', () => {
    const base = 3450.5;
    const r = calcularFactura({ base, tipoIva: IVA_GENERAL, tipoRetencion: RETENCIONES.general });
    expect(r.totalACobrar).toBeCloseTo(base * (1 + 0.21 - 0.15), 2);
  });
});

describe('entradas inválidas', () => {
  it('rechaza base negativa, NaN e Infinity', () => {
    expect(() => calcularFactura({ base: -1, tipoIva: 0.21, tipoRetencion: 0.15 })).toThrow(RangeError);
    expect(() => calcularFactura({ base: NaN, tipoIva: 0.21, tipoRetencion: 0.15 })).toThrow(RangeError);
    expect(() => calcularFactura({ base: Infinity, tipoIva: 0.21, tipoRetencion: 0.15 })).toThrow(RangeError);
  });

  it('rechaza tipos negativos o no finitos', () => {
    expect(() => calcularFactura({ base: 1000, tipoIva: -0.1, tipoRetencion: 0.15 })).toThrow(RangeError);
    expect(() => calcularFactura({ base: 1000, tipoIva: 0.21, tipoRetencion: NaN })).toThrow(RangeError);
  });
});

/**
 * Tipos de IVA y facturas SIN retención (añadidos el 3-ago).
 *
 * Por qué: la interfaz solo ofrecía IVA 21 % / exento y retención 15 % / 7 %, así
 * que a quien facturaba al 10 % o sin retención le daba un total equivocado. El motor ya
 * admitía cualquier tipo; lo que faltaba era ofrecerlos y cubrirlos con tests.
 *
 * Fuente: Ley 37/1992 del IVA (BOE-A-1992-28740), art. 90.Uno (21 %),
 * art. 91.Uno (10 %) y art. 91.Dos (4 %). Ausencia de retención: art. 76.1
 * RD 439/2007 — solo retiene quien actúa como retenedor.
 */
describe('tipos de IVA reducidos (Ley 37/1992)', () => {
  it('IVA reducido del 10 % (art. 91.Uno): 1.000 € → 100 € de cuota', () => {
    const r = calcularFactura({ base: 1000, tipoIva: TIPOS_IVA.reducido, tipoRetencion: 0 });
    expect(r.cuotaIva).toBeCloseTo(100, 2);
    expect(r.totalACobrar).toBeCloseTo(1100, 2);
  });

  it('IVA superreducido del 4 % (art. 91.Dos): 1.000 € → 40 € de cuota', () => {
    const r = calcularFactura({ base: 1000, tipoIva: TIPOS_IVA.superreducido, tipoRetencion: 0 });
    expect(r.cuotaIva).toBeCloseTo(40, 2);
    expect(r.totalACobrar).toBeCloseTo(1040, 2);
  });

  it('los cuatro tipos coinciden con el texto legal, y el general con IVA_GENERAL', () => {
    expect(TIPOS_IVA.general).toBe(0.21);
    expect(TIPOS_IVA.reducido).toBe(0.10);
    expect(TIPOS_IVA.superreducido).toBe(0.04);
    expect(TIPOS_IVA.exento).toBe(0);
    expect(TIPOS_IVA.general).toBe(IVA_GENERAL);
  });
});

describe('factura SIN retención de IRPF (art. 76.1 RD 439/2007)', () => {
  it('a un particular: 1.000 € + 21 % = 1.210 €, sin restar nada', () => {
    const r = calcularFactura({ base: 1000, tipoIva: TIPOS_IVA.general, tipoRetencion: 0 });
    expect(r.retencion).toBe(0);
    expect(r.totalACobrar).toBeCloseTo(1210, 2);
  });

  it('el caso que la interfaz hacía imposible: forzar el 15 % erraba 150 € en 1.000 €', () => {
    const sin = calcularFactura({ base: 1000, tipoIva: TIPOS_IVA.general, tipoRetencion: 0 });
    const con = calcularFactura({ base: 1000, tipoIva: TIPOS_IVA.general, tipoRetencion: RETENCIONES.general });
    expect(sin.totalACobrar - con.totalACobrar).toBeCloseTo(150, 2);
  });

  it('reforma de vivienda al 10 % y sin retención (entrega con instalación)', () => {
    const r = calcularFactura({ base: 4500, tipoIva: TIPOS_IVA.reducido, tipoRetencion: 0 });
    expect(r.cuotaIva).toBeCloseTo(450, 2);
    expect(r.totalACobrar).toBeCloseTo(4950, 2);
  });
});
