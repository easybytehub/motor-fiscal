import { describe, it, expect } from 'vitest';
import {
  porcentajePorAnios,
  calcularPension,
  PENSION_MAXIMA_MENSUAL_2026,
  PAGAS_ANUALES,
} from '../src/pension-jubilacion.js';

/**
 * Casos verificados contra fuente oficial 2026:
 *   - Art. 210.1 LGSS (RDLeg 8/2015, BOE-A-2015-11724): 50 % por los primeros
 *     15 años; el porcentaje sube por cada mes adicional hasta el 100 %.
 *   - Disposición Transitoria Novena LGSS, escala vigente para jubilaciones
 *     causadas en 2026: +0,21 % por cada uno de los 49 primeros meses
 *     adicionales y +0,19 % por cada uno de los 209 siguientes → 100 % a los
 *     36 años y 6 meses (258 meses adicionales). 49×0,21 + 209×0,19 = 50 puntos.
 *   - Límite máximo pensión pública 2026: 3.359,60 €/mes (14 pagas),
 *     47.034,40 €/año. Real Decreto 241/2026, de 25 de marzo (BOE-A-2026-6977).
 */

describe('porcentajePorAnios — escala DT Novena LGSS (jubilaciones 2026)', () => {
  it('menos de 15 años cotizados no da derecho a pensión contributiva (0 %)', () => {
    expect(porcentajePorAnios(0)).toBe(0);
    expect(porcentajePorAnios(14)).toBe(0);
    // 14 años y 11 meses (179 meses) → aún 0
    expect(porcentajePorAnios(179 / 12)).toBe(0);
  });

  it('justo a los 15 años (180 meses) → 50 %', () => {
    expect(porcentajePorAnios(15)).toBeCloseTo(50, 6);
    // primer mes por encima del mínimo aplica ya el 0,21 %
    expect(porcentajePorAnios(181 / 12)).toBeCloseTo(50.21, 6);
  });

  it('frontera del primer tramo (49 meses adicionales, 19 años y 1 mes)', () => {
    // 15 años + 49 meses = 229 meses = 19a 1m → 50 + 49×0,21 = 60,29 %
    expect(porcentajePorAnios(229 / 12)).toBeCloseTo(60.29, 6);
    // un mes más entra ya en el tramo del 0,19 %
    expect(porcentajePorAnios(230 / 12)).toBeCloseTo(60.48, 6);
  });

  it('ejemplo resuelto de la página: 30 años → 85,18 %', () => {
    // 30 años = 360 meses; 180 adicionales = 49×0,21 (10,29) + 131×0,19 (24,89)
    expect(porcentajePorAnios(30)).toBeCloseTo(85.18, 6);
  });

  it('100 % exacto a los 36 años y 6 meses (258 meses adicionales)', () => {
    // 15 años + 258 meses = 438 meses = 36,5 años
    expect(porcentajePorAnios(36.5)).toBeCloseTo(100, 6);
  });

  it('no supera el 100 % por muchos años que se coticen', () => {
    expect(porcentajePorAnios(37)).toBe(100);
    expect(porcentajePorAnios(45)).toBe(100);
    expect(porcentajePorAnios(50)).toBe(100);
  });

  it('rechaza entradas inválidas', () => {
    expect(() => porcentajePorAnios(-1)).toThrow(RangeError);
    expect(() => porcentajePorAnios(NaN)).toThrow(RangeError);
    expect(() => porcentajePorAnios(Infinity)).toThrow(RangeError);
  });
});

describe('calcularPension — ejemplo resuelto de la página (Marta)', () => {
  // Mismos datos que trae el formulario (28-sep): antes Marta cotizaba 2.000 € y la calculadora
  // venía con 2.200 €, así que el ejemplo y la cifra grande de la misma página no coincidían.
  it('base 2.200 €/mes, 30 años → 85,18 %, 1.873,96 €/mes, 26.235,44 €/año', () => {
    const r = calcularPension(2200, 30);
    expect(r.porcentaje).toBeCloseTo(85.18, 6);
    expect(r.pensionSinTope).toBeCloseTo(1873.96, 2);
    expect(r.topeAplicado).toBe(false);
    expect(r.pensionMensual).toBeCloseTo(1873.96, 2);
    expect(r.pensionAnual).toBeCloseTo(26235.44, 2);
  });
});

describe('calcularPension — tope máximo 2026 (RD 241/2026)', () => {
  it('el tope mensual es 3.359,60 € en 14 pagas (47.034,40 €/año)', () => {
    expect(PENSION_MAXIMA_MENSUAL_2026).toBe(3359.6);
    expect(PAGAS_ANUALES).toBe(14);
    expect(PENSION_MAXIMA_MENSUAL_2026 * PAGAS_ANUALES).toBeCloseTo(47034.4, 2);
  });

  it('una base alta con carrera completa queda limitada al tope', () => {
    // 40 años → 100 %; base 5.000 € daría 5.000 € > tope → se aplica el tope
    const r = calcularPension(5000, 40);
    expect(r.porcentaje).toBe(100);
    expect(r.pensionSinTope).toBeCloseTo(5000, 2);
    expect(r.topeAplicado).toBe(true);
    expect(r.pensionMensual).toBeCloseTo(3359.6, 2);
    expect(r.pensionAnual).toBeCloseTo(47034.4, 2);
  });

  it('justo por debajo del tope NO se limita', () => {
    // base 3.359,60 € × 100 % = tope exacto → no se considera "aplicado" (no lo supera)
    const r = calcularPension(3359.6, 40);
    expect(r.topeAplicado).toBe(false);
    expect(r.pensionMensual).toBeCloseTo(3359.6, 2);
  });
});

describe('calcularPension — validación de entradas', () => {
  it('rechaza base reguladora ≤ 0 o no finita', () => {
    expect(() => calcularPension(0, 30)).toThrow(RangeError);
    expect(() => calcularPension(-100, 30)).toThrow(RangeError);
    expect(() => calcularPension(NaN, 30)).toThrow(RangeError);
  });
});
