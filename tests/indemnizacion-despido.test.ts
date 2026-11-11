import { describe, it, expect } from 'vitest';
import {
  PARAMETROS_DESPIDO,
  calcularIndemnizacionDespido,
} from '../src/indemnizacion-despido.js';

/**
 * Casos verificados contra el Estatuto de los Trabajadores (Real Decreto
 * Legislativo 2/2015, de 23 de octubre, BOE-A-2015-11430), texto consolidado:
 *   - Art. 56.1 (despido improcedente): "treinta y tres días de salario por año
 *     de servicio, prorrateándose por meses los periodos de tiempo inferiores a
 *     un año, hasta un máximo de veinticuatro mensualidades".
 *   - Art. 53.1.b (despido objetivo/procedente): "veinte días por año de
 *     servicio, prorrateándose por meses los periodos de tiempo inferiores a un
 *     año y con un máximo de doce mensualidades".
 * Confirmado también por la STS del CGPJ (art. 56.1 no incrementable) e Iberley
 * (texto consolidado del ET). Metodología del salario diario (bruto anual / 365)
 * y de la mensualidad (bruto anual / 12): calzada con los ejemplos resueltos de
 * la página, que a su vez son los que ve el usuario.
 */

describe('parámetros legales por tipo de despido (arts. 56.1 y 53.1.b ET)', () => {
  it('improcedente → 33 días/año, tope 24 mensualidades (art. 56.1)', () => {
    expect(PARAMETROS_DESPIDO.improcedente).toEqual({
      diasPorAnio: 33,
      topeMensualidades: 24,
    });
  });

  it('objetivo → 20 días/año, tope 12 mensualidades (art. 53.1.b)', () => {
    expect(PARAMETROS_DESPIDO.objetivo).toEqual({
      diasPorAnio: 20,
      topeMensualidades: 12,
    });
  });
});

describe('ejemplo resuelto de la página (Marta: 21.000 €, 4 años, improcedente)', () => {
  it('57,53 €/día · 33 · 4 = 7.594,52 € (por debajo del tope de 42.000 €)', () => {
    const r = calcularIndemnizacionDespido({
      salarioBrutoAnual: 21000,
      antiguedadAnios: 4,
      tipoDespido: 'improcedente',
    });
    expect(r.salarioDiario).toBeCloseTo(57.5342, 2);
    expect(r.mensualidad).toBeCloseTo(1750, 2);
    expect(r.topeImporte).toBeCloseTo(42000, 2); // 1.750 € × 24
    expect(r.topeAplicado).toBe(false);
    expect(r.indemnizacionSinTope).toBeCloseTo(7594.52, 2);
    expect(r.indemnizacion).toBeCloseTo(7594.52, 2);
  });
});

describe('tabla de referencia de la página (salario bruto 24.000 €/año)', () => {
  // [antigüedad, tipo, indemnización esperada (€), topeAplicado]
  const casos: Array<[number, 'improcedente' | 'objetivo', number, boolean]> = [
    [2, 'improcedente', 4339.73, false], // 4.340 € redondeado en la tabla
    [2, 'objetivo', 2630.14, false], // 2.630 €
    [5, 'improcedente', 10849.32, false], // 10.849 €
    [5, 'objetivo', 6575.34, false], // 6.575 €
    [10, 'improcedente', 21698.63, false], // 21.699 €
    [10, 'objetivo', 13150.68, false], // 13.151 €
    [20, 'improcedente', 43397.26, false], // 43.397 € (tope 48.000 € no alcanzado)
    [20, 'objetivo', 24000, true], // tope 12 mens. = 24.000 € (la tabla lo marca)
  ];

  it.each(casos)(
    '%s años, %s → %s € (tope aplicado: %s)',
    (antiguedadAnios, tipoDespido, esperado, topeAplicado) => {
      const r = calcularIndemnizacionDespido({
        salarioBrutoAnual: 24000,
        antiguedadAnios,
        tipoDespido,
      });
      expect(r.indemnizacion).toBeCloseTo(esperado, 2);
      expect(r.topeAplicado).toBe(topeAplicado);
    },
  );
});

describe('tope de mensualidades (art. 56.1 / 53.1.b)', () => {
  it('improcedente: 30 años a 24.000 € recorta al tope de 24 mens. = 48.000 €', () => {
    const r = calcularIndemnizacionDespido({
      salarioBrutoAnual: 24000,
      antiguedadAnios: 30,
      tipoDespido: 'improcedente',
    });
    // sin tope: 65,75 · 33 · 30 ≈ 65.095,89 € > 48.000 €
    expect(r.indemnizacionSinTope).toBeGreaterThan(r.topeImporte);
    expect(r.topeAplicado).toBe(true);
    expect(r.topeImporte).toBeCloseTo(48000, 2); // 2.000 € × 24
    expect(r.indemnizacion).toBeCloseTo(48000, 2);
  });

  it('objetivo: el tope de 12 mens. equivale al salario bruto anual', () => {
    const r = calcularIndemnizacionDespido({
      salarioBrutoAnual: 30000,
      antiguedadAnios: 40,
      tipoDespido: 'objetivo',
    });
    expect(r.topeImporte).toBeCloseTo(30000, 2); // (30000/12) × 12
    expect(r.indemnizacion).toBeCloseTo(30000, 2);
    expect(r.topeAplicado).toBe(true);
  });
});

describe('prorrateo lineal de la antigüedad', () => {
  it('antigüedad 0 años → indemnización 0 €', () => {
    const r = calcularIndemnizacionDespido({
      salarioBrutoAnual: 24000,
      antiguedadAnios: 0,
      tipoDespido: 'improcedente',
    });
    expect(r.indemnizacion).toBe(0);
    expect(r.topeAplicado).toBe(false);
  });

  it('5,5 años se prorratea linealmente (improcedente, 24.000 €)', () => {
    const r = calcularIndemnizacionDespido({
      salarioBrutoAnual: 24000,
      antiguedadAnios: 5.5,
      tipoDespido: 'improcedente',
    });
    // 24000/365 · 33 · 5,5 = 11.934,25 €
    expect(r.indemnizacion).toBeCloseTo(11934.25, 2);
  });
});

describe('entradas inválidas', () => {
  it('rechaza salario ≤ 0, NaN o Infinity', () => {
    expect(() =>
      calcularIndemnizacionDespido({
        salarioBrutoAnual: 0,
        antiguedadAnios: 5,
        tipoDespido: 'improcedente',
      }),
    ).toThrow(RangeError);
    expect(() =>
      calcularIndemnizacionDespido({
        salarioBrutoAnual: NaN,
        antiguedadAnios: 5,
        tipoDespido: 'improcedente',
      }),
    ).toThrow(RangeError);
  });

  it('rechaza antigüedad negativa', () => {
    expect(() =>
      calcularIndemnizacionDespido({
        salarioBrutoAnual: 24000,
        antiguedadAnios: -1,
        tipoDespido: 'improcedente',
      }),
    ).toThrow(RangeError);
  });

  it('rechaza un tipo de despido desconocido', () => {
    expect(() =>
      calcularIndemnizacionDespido({
        salarioBrutoAnual: 24000,
        antiguedadAnios: 5,
        // @ts-expect-error tipo no válido a propósito
        tipoDespido: 'colectivo',
      }),
    ).toThrow(RangeError);
  });
});
