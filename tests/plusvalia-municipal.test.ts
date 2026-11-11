import { describe, it, expect } from 'vitest';
import {
  COEFICIENTES,
  COEFICIENTE_20_ANIOS_O_MAS,
  TIPO_GRAVAMEN_MAXIMO_LEGAL,
  coeficientePorAnios,
  calcularPlusvalia,
} from '../src/plusvalia-municipal.js';

/**
 * Casos verificados contra fuente oficial:
 *  - Doble método (objetivo y real) y elección del más favorable: art. 107 TRLHL
 *    (Real Decreto Legislativo 2/2004, BOE-A-2004-4214) en la redacción del
 *    Real Decreto-ley 26/2021, de 8 de noviembre (BOE-A-2021-18276), tras la STC 182/2021.
 *  - Método real (art. 107.5 TRLHL): base = (precio de transmisión − precio de adquisición)
 *    × (valor catastral del suelo / valor catastral total del inmueble). Sin el valor
 *    catastral total no se calcula el real (no se aproxima con el precio de compra).
 *  - Tipo de gravamen máximo legal 30 %: art. 108.1 TRLHL.
 *  - Coeficientes máximos del método objetivo (art. 107.4 TRLHL): tabla del RDL 8/2023
 *    (BOE-A-2023-26452), VIGENTE en 2026 tras derogarse el RDL 16/2025 el 27-01-2026
 *    (no convalidado; Resolución de 27-01-2026, BOE de 28-01-2026) y no convalidarse
 *    tampoco el RDL 9/2024. Tabla oficial 2026 por años de tenencia:
 *    <1 año→0,15 prorrateado por meses completos (0,15 × meses/12) · 1→0,15 · 2/3→0,14 · 4→0,16 · 5→0,18 · 6→0,19 · 7→0,20 · 8→0,19 · 9→0,15 ·
 *    10→0,12 · 11→0,10 · 12-15→0,09 · 16→0,10 · 17→0,13 · 18→0,17 · 19→0,23 · 20+→0,40.
 */

describe('coeficientes del método objetivo (art. 107.4 TRLHL, tabla 2026)', () => {
  // Tabla oficial completa: [años, coeficiente esperado]
  const tabla: Array<[number, number]> = [
    [0, 0.15],
    [1, 0.15],
    [2, 0.14],
    [3, 0.14],
    [4, 0.16],
    [5, 0.18],
    [6, 0.19],
    [7, 0.2],
    [8, 0.19],
    [9, 0.15],
    [10, 0.12],
    [11, 0.1],
    [12, 0.09],
    [13, 0.09],
    [14, 0.09],
    [15, 0.09],
    [16, 0.1],
    [17, 0.13],
    [18, 0.17],
    [19, 0.23],
    [20, 0.4],
  ];

  it.each(tabla.slice(1))('%s años → coeficiente %s', (anios, coef) => {
    expect(coeficientePorAnios(anios)).toBeCloseTo(coef, 4);
  });

  it('20 años o más usa el coeficiente del último tramo (0,40)', () => {
    expect(coeficientePorAnios(20)).toBe(COEFICIENTE_20_ANIOS_O_MAS);
    expect(coeficientePorAnios(25)).toBe(0.4);
    expect(coeficientePorAnios(50)).toBe(0.4);
  });

  it('toma los años completos (parte entera) a partir de 1 año', () => {
    expect(coeficientePorAnios(7.9)).toBe(COEFICIENTES[7]); // 0,20, no 0,19
    expect(coeficientePorAnios(1.5)).toBe(COEFICIENTES[1]); // 0,15 entero, sin prorrateo
  });

  it('rechaza años inválidos', () => {
    expect(() => coeficientePorAnios(-1)).toThrow(RangeError);
    expect(() => coeficientePorAnios(NaN)).toThrow(RangeError);
    expect(() => coeficientePorAnios(Infinity)).toThrow(RangeError);
  });

  it('el máximo legal del tipo de gravamen es 30 % (art. 108.1 TRLHL)', () => {
    expect(TIPO_GRAVAMEN_MAXIMO_LEGAL).toBe(30);
  });
});

describe('ejemplo resuelto de la página (Javier, 8 años)', () => {
  // Suelo 60.000 €, catastral total 150.000 € (recibo del IBI), 8 años (coef 0,19), tipo 30 %,
  // compra 180.000 €, venta 240.000 €.
  const r = calcularPlusvalia({
    valorCatastralSuelo: 60000,
    valorCatastralTotal: 150000,
    aniosTenencia: 8,
    tipoGravamen: 30,
    precioCompra: 180000,
    precioVenta: 240000,
  });

  it('método objetivo: base 11.400 €, cuota 3.420 €', () => {
    expect(r.coeficiente).toBeCloseTo(0.19, 4);
    expect(r.baseObjetivo).toBeCloseTo(11400, 2); // 60.000 × 0,19
    expect(r.cuotaObjetivo).toBeCloseTo(3420, 2); // 11.400 × 30 %
  });

  it('método real (art. 107.5): proporción 40 %, base 24.000 €, cuota 7.200 €', () => {
    expect(r.hayDatosReal).toBe(true);
    expect(r.faltaCatastralTotal).toBe(false);
    expect(r.proporcionSuelo).toBeCloseTo(0.4, 6); // 60.000 / 150.000 (catastral total)
    expect(r.baseReal).toBeCloseTo(24000, 2); // 60.000 (ganancia) × 40 %
    expect(r.cuotaReal).toBeCloseTo(7200, 2); // 24.000 × 30 %
  });

  it('elige el método objetivo por ser el menos gravoso → 3.420 €', () => {
    expect(r.metodo).toBe('objetivo');
    expect(r.cuotaFinal).toBeCloseTo(3420, 2);
  });
});

describe('variantes de la página («Cuál elegir»), art. 107.5 TRLHL', () => {
  const base = { valorCatastralSuelo: 60000, valorCatastralTotal: 150000, aniosTenencia: 8, tipoGravamen: 30 };

  it('ganancia pequeña (200.000 → 210.000): real 1.200 € (antes 900 € con el proxy), gana el real', () => {
    const r = calcularPlusvalia({ ...base, precioCompra: 200000, precioVenta: 210000 });
    expect(r.proporcionSuelo).toBeCloseTo(0.4, 6);
    expect(r.baseReal).toBeCloseTo(4000, 2); // 10.000 × 40 %
    expect(r.cuotaReal).toBeCloseTo(1200, 2);
    expect(r.cuotaObjetivo).toBeCloseTo(3420, 2);
    expect(r.metodo).toBe('real');
    expect(r.cuotaFinal).toBeCloseTo(1200, 2); // ahorro 2.220 €
  });

  it('la proporción NO depende del precio de compra', () => {
    const a = calcularPlusvalia({ ...base, precioCompra: 180000, precioVenta: 240000 });
    const b = calcularPlusvalia({ ...base, precioCompra: 200000, precioVenta: 210000 });
    expect(a.proporcionSuelo).toBe(b.proporcionSuelo);
  });
});

describe('sin valor catastral total → solo método objetivo (art. 107.5 TRLHL)', () => {
  it('con compraventa con ganancia pero sin catastral total, no calcula el real', () => {
    const r = calcularPlusvalia({
      valorCatastralSuelo: 60000,
      aniosTenencia: 8,
      tipoGravamen: 30,
      precioCompra: 200000,
      precioVenta: 210000,
    });
    expect(r.hayDatosReal).toBe(false);
    expect(r.faltaCatastralTotal).toBe(true);
    expect(r.proporcionSuelo).toBe(0);
    expect(r.cuotaReal).toBe(0);
    expect(r.metodo).toBe('objetivo');
    expect(r.cuotaFinal).toBeCloseTo(3420, 2);
  });

  it('catastral total 0, negativo o NaN cuenta como ausente', () => {
    for (const t of [0, -1, NaN]) {
      const r = calcularPlusvalia({
        valorCatastralSuelo: 60000,
        valorCatastralTotal: t,
        aniosTenencia: 8,
        tipoGravamen: 30,
        precioCompra: 200000,
        precioVenta: 210000,
      });
      expect(r.faltaCatastralTotal).toBe(true);
      expect(r.metodo).toBe('objetivo');
    }
  });

  it('la no sujeción (venta ≤ compra) no necesita el catastral total', () => {
    const r = calcularPlusvalia({
      valorCatastralSuelo: 60000,
      aniosTenencia: 8,
      tipoGravamen: 30,
      precioCompra: 210000,
      precioVenta: 200000,
    });
    expect(r.faltaCatastralTotal).toBe(false);
    expect(r.metodo).toBe('no-sujeto');
    expect(r.cuotaFinal).toBe(0);
  });
});

describe('elección del método menos gravoso', () => {
  it('elige el método real cuando su cuota es menor', () => {
    // Suelo alto pero ganancia pequeña: el real sale más barato que el objetivo.
    const r = calcularPlusvalia({
      valorCatastralSuelo: 100000,
      valorCatastralTotal: 300000,
      aniosTenencia: 20, // coef 0,40 → base objetivo 40.000
      tipoGravamen: 30,
      precioCompra: 300000,
      precioVenta: 310000, // ganancia 10.000
    });
    // objetivo: 100.000 × 0,40 = 40.000 → 12.000 €
    // real: proporción 100.000 / 300.000 (catastral total) = 1/3; base 10.000×1/3=3.333,33; cuota 1.000 €
    expect(r.cuotaObjetivo).toBeCloseTo(12000, 2);
    expect(r.cuotaReal).toBeCloseTo(1000, 2);
    expect(r.metodo).toBe('real');
    expect(r.cuotaFinal).toBeCloseTo(1000, 2);
  });

  it('empate: si la cuota real iguala a la objetiva, aplica el real', () => {
    // Ajustado para que cuotaReal == cuotaObjetivo.
    // objetivo: suelo 50.000 × coef(1 año)=0,15 = 7.500 → tipo 30 % → 2.250
    // real: proporción 50.000 / 50.000 (catastral total) = 1; ganancia = base objetivo => base real 7.500
    const r = calcularPlusvalia({
      valorCatastralSuelo: 50000,
      valorCatastralTotal: 50000,
      aniosTenencia: 1,
      tipoGravamen: 30,
      precioCompra: 50000,
      precioVenta: 57500, // ganancia 7.500, proporción 1 → base real 7.500 = base objetivo
    });
    expect(r.cuotaReal).toBeCloseTo(r.cuotaObjetivo, 6);
    expect(r.metodo).toBe('real');
  });
});

describe('no sujeción por inexistencia de incremento de valor', () => {
  it('venta igual o inferior a compra → no sujeto, cuota 0', () => {
    const r = calcularPlusvalia({
      valorCatastralSuelo: 60000,
      aniosTenencia: 8,
      tipoGravamen: 30,
      precioCompra: 240000,
      precioVenta: 200000, // pérdida
    });
    expect(r.sinIncrementoReal).toBe(true);
    expect(r.metodo).toBe('no-sujeto');
    expect(r.cuotaFinal).toBe(0);
  });

  it('venta exactamente igual a compra → no sujeto (ganancia 0)', () => {
    const r = calcularPlusvalia({
      valorCatastralSuelo: 60000,
      aniosTenencia: 8,
      tipoGravamen: 30,
      precioCompra: 200000,
      precioVenta: 200000,
    });
    expect(r.sinIncrementoReal).toBe(true);
    expect(r.cuotaFinal).toBe(0);
  });
});

describe('sin datos de compraventa → solo método objetivo', () => {
  it('aplica el objetivo cuando faltan precio de compra/venta', () => {
    const r = calcularPlusvalia({
      valorCatastralSuelo: 60000,
      aniosTenencia: 8,
      tipoGravamen: 30,
    });
    expect(r.hayDatosReal).toBe(false);
    expect(r.sinIncrementoReal).toBe(false);
    expect(r.metodo).toBe('objetivo');
    expect(r.cuotaFinal).toBeCloseTo(3420, 2);
    expect(r.cuotaReal).toBe(0);
  });

  it('precio de compra 0 o negativo no habilita el método real', () => {
    const r = calcularPlusvalia({
      valorCatastralSuelo: 60000,
      aniosTenencia: 8,
      tipoGravamen: 30,
      precioCompra: 0,
      precioVenta: 240000,
    });
    expect(r.hayDatosReal).toBe(false);
    expect(r.metodo).toBe('objetivo');
  });
});

describe('proporción del suelo acotada a 1 (art. 107.5 TRLHL)', () => {
  it('si el catastral del suelo supera el total (dato incoherente), la proporción es 1', () => {
    const r = calcularPlusvalia({
      valorCatastralSuelo: 250000,
      valorCatastralTotal: 200000, // < suelo
      aniosTenencia: 5,
      tipoGravamen: 30,
      precioCompra: 200000,
      precioVenta: 260000, // ganancia 60.000
    });
    expect(r.proporcionSuelo).toBe(1);
    expect(r.baseReal).toBeCloseTo(60000, 2); // toda la ganancia
  });
});

describe('entradas inválidas', () => {
  it('rechaza valor catastral del suelo negativo, NaN o Infinity', () => {
    const base = { aniosTenencia: 8, tipoGravamen: 30 };
    expect(() => calcularPlusvalia({ ...base, valorCatastralSuelo: -1 })).toThrow(RangeError);
    expect(() => calcularPlusvalia({ ...base, valorCatastralSuelo: NaN })).toThrow(RangeError);
    expect(() => calcularPlusvalia({ ...base, valorCatastralSuelo: Infinity })).toThrow(RangeError);
  });

  it('rechaza tipo de gravamen negativo, NaN o Infinity', () => {
    const base = { valorCatastralSuelo: 60000, aniosTenencia: 8 };
    expect(() => calcularPlusvalia({ ...base, tipoGravamen: -1 })).toThrow(RangeError);
    expect(() => calcularPlusvalia({ ...base, tipoGravamen: NaN })).toThrow(RangeError);
  });

  it('rechaza años de tenencia inválidos', () => {
    const base = { valorCatastralSuelo: 60000, tipoGravamen: 30 };
    expect(() => calcularPlusvalia({ ...base, aniosTenencia: -1 })).toThrow(RangeError);
    expect(() => calcularPlusvalia({ ...base, aniosTenencia: NaN })).toThrow(RangeError);
  });
});

describe('menos de 1 año: prorrateo por meses completos (art. 107.4 TRLHL)', () => {
  // Art. 107.4 TRLHL (BOE-A-2004-4214), redacción RDL 26/2021: «En el caso de que el periodo
  // de generación sea inferior a un año, se prorrateará el coeficiente anual teniendo en cuenta
  // el número de meses completos». Coeficiente anual (<1 año) = 0,15 → 0,15 × meses / 12.
  it('6 meses → 0,15 × 6/12 = 0,075 (antes la calculadora aplicaba 0,15 entero)', () => {
    expect(coeficientePorAnios(0, 6)).toBeCloseTo(0.075, 6);
  });

  it.each([
    [1, 0.0125],
    [3, 0.0375],
    [9, 0.1125],
    [11, 0.1375],
  ])('%s meses completos → %s', (meses, coef) => {
    expect(coeficientePorAnios(0, meses)).toBeCloseTo(coef, 6);
  });

  it('solo cuentan los meses COMPLETOS: 6,9 meses → 6', () => {
    expect(coeficientePorAnios(0, 6.9)).toBeCloseTo(0.075, 6);
  });

  it('0 meses completos → coeficiente 0 (sin incremento gravable)', () => {
    expect(coeficientePorAnios(0, 0)).toBe(0);
    expect(coeficientePorAnios(0)).toBe(0);
    expect(coeficientePorAnios(0.05)).toBe(0); // 0,6 meses → 0 completos
  });

  it('sin meses explícitos, la fracción de año se convierte a meses completos', () => {
    expect(coeficientePorAnios(0.5)).toBeCloseTo(0.075, 6); // 6 meses
    expect(coeficientePorAnios(0.25)).toBeCloseTo(0.0375, 6); // 3 meses
  });

  it('con 1 año o más los meses se ignoran (años completos, sin prorrateo)', () => {
    expect(coeficientePorAnios(1, 6)).toBe(0.15);
    expect(coeficientePorAnios(8, 11)).toBe(0.19);
  });

  it('rechaza meses inválidos', () => {
    expect(() => coeficientePorAnios(0, -1)).toThrow(RangeError);
    expect(() => coeficientePorAnios(0, NaN)).toThrow(RangeError);
  });

  it('cuota con 6 meses: suelo 60.000 €, tipo 30 % → 1.350 € (antes 2.700 €)', () => {
    const r = calcularPlusvalia({
      valorCatastralSuelo: 60000,
      aniosTenencia: 0,
      mesesTenencia: 6,
      tipoGravamen: 30,
    });
    expect(r.coeficiente).toBeCloseTo(0.075, 6);
    expect(r.baseObjetivo).toBeCloseTo(4500, 2); // 60.000 × 0,075
    expect(r.cuotaObjetivo).toBeCloseTo(1350, 2); // 4.500 × 30 %
    expect(r.cuotaFinal).toBeCloseTo(1350, 2);
  });

  it('el prorrateo también decide la comparación con el método real', () => {
    // 6 meses, suelo 60.000, catastral total 150.000, compra 180.000, venta 195.000 (ganancia 15.000).
    // objetivo: 60.000 × 0,075 = 4.500 → 1.350 €; real (art. 107.5): 15.000 × 40 % = 6.000 → 1.800 €.
    // Con el 0,15 entero el objetivo daba 2.700 € y ganaba el real (1.800 €).
    const r = calcularPlusvalia({
      valorCatastralSuelo: 60000,
      valorCatastralTotal: 150000,
      aniosTenencia: 0,
      mesesTenencia: 6,
      tipoGravamen: 30,
      precioCompra: 180000,
      precioVenta: 195000,
    });
    expect(r.cuotaObjetivo).toBeCloseTo(1350, 2);
    expect(r.cuotaReal).toBeCloseTo(1800, 2);
    expect(r.metodo).toBe('objetivo');
    expect(r.cuotaFinal).toBeCloseTo(1350, 2);
  });
});
