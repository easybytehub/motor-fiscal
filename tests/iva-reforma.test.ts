import { describe, it, expect } from 'vitest';
import {
  calcularIvaReforma,
  IVA_REDUCIDO,
  IVA_GENERAL,
} from '../src/iva-reforma.js';

/**
 * Cifra normativa (fuente oficial): los tipos y los requisitos están fijados por la Ley 37/1992
 * del IVA (LIVA):
 *  - Tipo reducido 10 % a renovación/reparación de vivienda: art. 91.Uno.2.10º LIVA.
 *  - Límite del 40 % de materiales aportados por el ejecutor: art. 91.Uno.3 LIVA.
 *  - Tipo general 21 %: art. 90.Uno LIVA.
 * Se contrasta el ejemplo resuelto de la página (base 3.500 € cumpliendo los 3 requisitos) y el
 * fallo de cada requisito, que empuja toda la operación al 21 %.
 */

describe('tipos oficiales (Ley 37/1992 del IVA)', () => {
  it('reducido 10 % (art. 91.Uno.2.10º) y general 21 % (art. 90.Uno)', () => {
    expect(IVA_REDUCIDO).toBe(0.1);
    expect(IVA_GENERAL).toBe(0.21);
  });
});

describe('ejemplo resuelto de la página (Marta, baño de vivienda de 15 años)', () => {
  // Base 3.500 €, vivienda particular, >2 años, materiales 34,3 % (≤ 40 %) → 10 %, cuota 350 €, total 3.850 €.
  it('cumple los 3 requisitos → 10 %, cuota 350 €, total 3.850 €', () => {
    const r = calcularIvaReforma({
      base: 3500,
      esViviendaParticular: true,
      masDeDosAnios: true,
      materialesHasta40: true,
    });
    expect(r.aplicaReducido).toBe(true);
    expect(r.tipo).toBe(0.1);
    expect(r.cuota).toBeCloseTo(350, 6); // 10 % de 3.500 €
    expect(r.total).toBeCloseTo(3850, 6);
  });

  // Mismos datos pero materiales > 40 % → toda la factura al 21 %, total 4.235 € (no solo el exceso).
  it('materiales > 40 % → 21 %, total 4.235 €', () => {
    const r = calcularIvaReforma({
      base: 3500,
      esViviendaParticular: true,
      masDeDosAnios: true,
      materialesHasta40: false,
    });
    expect(r.aplicaReducido).toBe(false);
    expect(r.tipo).toBe(0.21);
    expect(r.cuota).toBeCloseTo(735, 6); // 21 % de 3.500 €
    expect(r.total).toBeCloseTo(4235, 6);
  });
});

describe('cada requisito es necesario: si falla uno, se aplica el 21 %', () => {
  const base = 1000;

  it('no es vivienda de particular (local/empresa) → 21 %', () => {
    const r = calcularIvaReforma({
      base,
      esViviendaParticular: false,
      masDeDosAnios: true,
      materialesHasta40: true,
    });
    expect(r.tipo).toBe(0.21);
  });

  it('vivienda de 2 años o menos → 21 %', () => {
    const r = calcularIvaReforma({
      base,
      esViviendaParticular: true,
      masDeDosAnios: false,
      materialesHasta40: true,
    });
    expect(r.tipo).toBe(0.21);
  });

  it('los 3 requisitos a la vez → 10 %', () => {
    const r = calcularIvaReforma({
      base,
      esViviendaParticular: true,
      masDeDosAnios: true,
      materialesHasta40: true,
    });
    expect(r.tipo).toBe(0.1);
    expect(r.cuota).toBeCloseTo(100, 6);
    expect(r.total).toBeCloseTo(1100, 6);
  });
});

describe('entradas inválidas', () => {
  it('rechaza base no positiva o no finita', () => {
    expect(() => calcularIvaReforma({
      base: 0, esViviendaParticular: true, masDeDosAnios: true, materialesHasta40: true,
    })).toThrow(RangeError);
    expect(() => calcularIvaReforma({
      base: -100, esViviendaParticular: true, masDeDosAnios: true, materialesHasta40: true,
    })).toThrow(RangeError);
    expect(() => calcularIvaReforma({
      base: NaN, esViviendaParticular: true, masDeDosAnios: true, materialesHasta40: true,
    })).toThrow(RangeError);
  });
});
