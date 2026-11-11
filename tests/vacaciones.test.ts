import { describe, it, expect } from 'vitest';
import {
  DIAS_ANUALES_MINIMO_LEGAL,
  DIAS_ANO,
  calcularVacaciones,
  calcularPagaVacaciones,
  textoDias,
  vacacionesPorMeses,
  diasDesdeAlta,
  mesesCompletosDesdeAlta,
} from '../src/vacaciones.js';

/**
 * Casos verificados contra el art. 38 del texto refundido de la Ley del Estatuto de los
 * Trabajadores (Real Decreto Legislativo 2/2015, de 23 de octubre, BOE-A-2015-11430),
 * texto consolidado:
 *   - Art. 38.1: mínimo de vacaciones anuales = 30 días naturales (no sustituibles por dinero
 *     durante la relación laboral). Verificado vía texto del ET (estatutodelostrabajadores.com,
 *     Iberley) — cita literal: "En ningún caso la duración será inferior a treinta días naturales".
 * El prorrateo lineal sobre 365 días es cálculo propio simplificado (no fijado por ley), el
 * criterio más habitual; la única cifra de ley es el mínimo de 30 días. Sin bug de fórmula
 * respecto a la lógica inline previa (misma situación que finiquito/horas-extra).
 */

describe('constantes normativas', () => {
  it('mínimo legal de 30 días naturales (art. 38.1 ET)', () => {
    expect(DIAS_ANUALES_MINIMO_LEGAL).toBe(30);
  });
  it('base del prorrateo = 365 días naturales', () => {
    expect(DIAS_ANO).toBe(365);
  });
});

describe('ejemplo resuelto de la página (Marta, alta el 1 de julio)', () => {
  it('30 días/año, 184 días trabajados → 15,12 días exactos → 15 días', () => {
    const r = calcularVacaciones({ diasAnuales: 30, diasTrabajados: 184 });
    expect(r.proporcion).toBeCloseTo(184 / 365, 6); // 0,504 (50,4 %)
    expect(r.diasExactos).toBeCloseTo(15.12, 2);
    expect(r.diasCorresponden).toBe(15);
  });
});

describe('prorrateo lineal sobre 365 días', () => {
  it('año completo (365 días) → los días anuales íntegros', () => {
    const r = calcularVacaciones({ diasAnuales: 30, diasTrabajados: 365 });
    expect(r.proporcion).toBe(1);
    expect(r.diasExactos).toBe(30);
    expect(r.diasCorresponden).toBe(30);
  });

  it('medio año exacto (182,5 días) → mitad de los días anuales', () => {
    const r = calcularVacaciones({ diasAnuales: 30, diasTrabajados: 182.5 });
    expect(r.diasExactos).toBeCloseTo(15, 6);
    expect(r.diasCorresponden).toBe(15);
  });

  it('convenio que mejora el mínimo (35 días), año completo', () => {
    const r = calcularVacaciones({ diasAnuales: 35, diasTrabajados: 365 });
    expect(r.diasCorresponden).toBe(35);
  });

  it('convenio mejorado (35 días), medio año (184 días) → 17,64 → 18 días', () => {
    const r = calcularVacaciones({ diasAnuales: 35, diasTrabajados: 184 });
    expect(r.diasExactos).toBeCloseTo(35 * (184 / 365), 6);
    expect(r.diasCorresponden).toBe(18);
  });
});

describe('acotado de días trabajados al máximo del año', () => {
  it('más de 365 días trabajados se acota a 365 (proporción = 1)', () => {
    const r = calcularVacaciones({ diasAnuales: 30, diasTrabajados: 400 });
    expect(r.diasTrabajadosClamped).toBe(365);
    expect(r.proporcion).toBe(1);
    expect(r.diasCorresponden).toBe(30);
  });

  it('exactamente 365 días no se ve afectado por el acotado', () => {
    const r = calcularVacaciones({ diasAnuales: 30, diasTrabajados: 365 });
    expect(r.diasTrabajadosClamped).toBe(365);
  });
});

describe('redondeo al entero de días más próximo', () => {
  it('redondea hacia arriba a partir de ,5', () => {
    // 30 × (x/365) = 15,5  →  x = 188,58...
    const r = calcularVacaciones({ diasAnuales: 30, diasTrabajados: 188.6 });
    expect(r.diasExactos).toBeGreaterThanOrEqual(15.5);
    expect(r.diasCorresponden).toBe(16);
  });

  it('redondea hacia abajo por debajo de ,5', () => {
    const r = calcularVacaciones({ diasAnuales: 30, diasTrabajados: 180 });
    expect(r.diasExactos).toBeCloseTo(30 * (180 / 365), 6); // 14,79
    expect(r.diasCorresponden).toBe(15);
  });
});

describe('entradas inválidas', () => {
  it('rechaza días anuales ≤ 0, NaN e Infinity', () => {
    expect(() => calcularVacaciones({ diasAnuales: 0, diasTrabajados: 100 })).toThrow(RangeError);
    expect(() => calcularVacaciones({ diasAnuales: -5, diasTrabajados: 100 })).toThrow(RangeError);
    expect(() => calcularVacaciones({ diasAnuales: NaN, diasTrabajados: 100 })).toThrow(RangeError);
    expect(() => calcularVacaciones({ diasAnuales: Infinity, diasTrabajados: 100 })).toThrow(RangeError);
  });

  it('rechaza días trabajados ≤ 0, NaN e Infinity', () => {
    expect(() => calcularVacaciones({ diasAnuales: 30, diasTrabajados: 0 })).toThrow(RangeError);
    expect(() => calcularVacaciones({ diasAnuales: 30, diasTrabajados: -1 })).toThrow(RangeError);
    expect(() => calcularVacaciones({ diasAnuales: 30, diasTrabajados: NaN })).toThrow(RangeError);
    expect(() => calcularVacaciones({ diasAnuales: 30, diasTrabajados: Infinity })).toThrow(RangeError);
  });
});

/**
 * calcularPagaVacaciones — casos verificados contra el art. 7.1 del Convenio 132 de la
 * OIT sobre vacaciones anuales pagadas (revisado 1970), ratificado por España
 * (Instrumento de Ratificación de 16-jun-1972, BOE-A-1974-1055): durante las
 * vacaciones se percibe "la retribución normal o media", el salario ORDINARIO —
 * proporcional a la jornada real, pero no reducido una segunda vez por estar de
 * vacaciones. Las pagas extraordinarias (art. 31 ET) no son retribución ordinaria: se
 * cobran aparte y se siguen devengando durante las vacaciones. Por eso, con 14 pagas,
 * el día de vacaciones = (bruto · 12/14) / 365; con 12 pagas prorrateadas, bruto / 365.
 *
 * Corrección del 1-oct-2026: antes era siempre bruto/365, que con 14 pagas metía las
 * extras en el importe (+16,7 %). Ejemplo de vacaciones-media-jornada: 900 € → 771,43 €.
 */
describe('calcularPagaVacaciones — retribución de los días de vacaciones (art. 7.1 Convenio 132 OIT)', () => {
  it('ejemplo resuelto de la página (media jornada, 10.950 €/año en 14 pagas, 30 días) → 771,43 € (antes 900 €)', () => {
    // 10.950 × 12/14 = 9.385,71 € ordinarios; ÷ 365 = 25,71 €/día; × 30 = 771,43 €.
    expect(calcularPagaVacaciones(10_950, 30)).toBeCloseTo(771.43, 2);
    expect(calcularPagaVacaciones(10_950, 30, 14)).toBeCloseTo(771.43, 2);
  });

  it('por defecto se asumen 14 pagas', () => {
    expect(calcularPagaVacaciones(10_950, 30)).toBe(calcularPagaVacaciones(10_950, 30, 14));
  });

  it('con 12 pagas prorrateadas el día lleva las extras dentro: bruto/365 → 900 €', () => {
    expect(calcularPagaVacaciones(10_950, 30, 12)).toBeCloseTo(900, 6);
  });

  it('14 pagas = 12/14 del importe con 12 pagas', () => {
    expect(calcularPagaVacaciones(21_900, 30, 14) / calcularPagaVacaciones(21_900, 30, 12)).toBeCloseTo(12 / 14, 12);
  });

  it('a jornada completa con el doble de salario, mismos días → el doble de importe (1.542,86 €)', () => {
    const parcial = calcularPagaVacaciones(10_950, 30);
    const completa = calcularPagaVacaciones(21_900, 30);
    expect(completa).toBeCloseTo(parcial * 2, 6);
    expect(completa).toBeCloseTo(1542.86, 2);
  });

  it('importe proporcional a los días: 15 días → 385,71 €', () => {
    expect(calcularPagaVacaciones(10_950, 15)).toBeCloseTo(385.71, 2);
  });

  it('rechaza salario ≤ 0, NaN e Infinity', () => {
    expect(() => calcularPagaVacaciones(0, 30)).toThrow(RangeError);
    expect(() => calcularPagaVacaciones(-100, 30)).toThrow(RangeError);
    expect(() => calcularPagaVacaciones(NaN, 30)).toThrow(RangeError);
    expect(() => calcularPagaVacaciones(Infinity, 30)).toThrow(RangeError);
  });

  it('0 días de vacaciones → 0 €, sin lanzar (auditoría UX 1-oct: con 5 días trabajados se redondea a 0 y la página se quedaba con el dato viejo)', () => {
    const r = calcularVacaciones({ diasAnuales: 30, diasTrabajados: 5 });
    expect(r.diasCorresponden).toBe(0);
    expect(calcularPagaVacaciones(10_950, r.diasCorresponden)).toBe(0);
  });

  it('rechaza días de vacaciones negativos, NaN e Infinity', () => {
    expect(() => calcularPagaVacaciones(10_950, -1)).toThrow(RangeError);
    expect(() => calcularPagaVacaciones(10_950, NaN)).toThrow(RangeError);
    expect(() => calcularPagaVacaciones(10_950, Infinity)).toThrow(RangeError);
  });

  it('rechaza un número de pagas distinto de 12 o 14', () => {
    expect(() => calcularPagaVacaciones(10_950, 30, 13 as 12)).toThrow(RangeError);
  });
});

/**
 * textoDias — texto de los desgloses. Auditoría UX del 1-oct-2026: salía «1 días» y
 * «22.5 días» (punto inglés, por interpolar el número a pelo). Debe usar `num()` del
 * formateador del repo (coma decimal es-ES) y el singular para 1.
 */
describe('textoDias — plural y coma decimal', () => {
  it('singular solo para 1', () => {
    expect(textoDias(1)).toBe('1 día');
    expect(textoDias(0)).toBe('0 días');
    expect(textoDias(30)).toBe('30 días');
  });
  it('decimales con coma española, no con punto', () => {
    expect(textoDias(22.5)).toBe('22,5 días');
    expect(textoDias(22.25)).toBe('22,25 días');
  });
});

/**
 * Tabla «meses trabajados → días» y matiz «por días o por meses completos» (ampliación del
 * 19-oct-2026). Fuente: art. 38.1 ET (RDLeg 2/2015, BOE-A-2015-11430), texto consolidado
 * leído en el BOE el 19-oct-2026 (última actualización publicada el 03/10/2026): «En ningún caso
 * la duración será inferior a treinta días naturales». 30 / 12 = 2,5 días por mes. La fórmula
 * proporcional es cálculo propio (la ley fija el mínimo, no el prorrateo), igual que arriba.
 */
describe('prorrateo por meses trabajados (30 días naturales, art. 38.1 ET)', () => {
  it('2,5 días por mes trabajado', () => {
    expect(vacacionesPorMeses(1)).toBe(2.5);
  });
  it('3, 6, 9 y 12 meses → 7,5 · 15 · 22,5 · 30 días', () => {
    expect(vacacionesPorMeses(3)).toBe(7.5);
    expect(vacacionesPorMeses(6)).toBe(15);
    expect(vacacionesPorMeses(9)).toBe(22.5);
    expect(vacacionesPorMeses(12)).toBe(30);
  });
  it('convenio de 22 días laborables: 6 meses → 11 días; 1 mes → 1,83', () => {
    expect(vacacionesPorMeses(6, 22)).toBe(11);
    expect(vacacionesPorMeses(1, 22)).toBeCloseTo(1.8333, 4);
  });
  it('rechaza meses fuera de 0-12', () => {
    expect(() => vacacionesPorMeses(13)).toThrow(RangeError);
    expect(() => vacacionesPorMeses(-1)).toThrow(RangeError);
  });
});

describe('días y meses desde la fecha de alta hasta el 31 de diciembre', () => {
  it('alta el 1-jul-2026 → 184 días (el ejemplo de Marta) y 6 meses completos', () => {
    expect(diasDesdeAlta('2026-07-01')).toBe(184);
    expect(mesesCompletosDesdeAlta('2026-07-01')).toBe(6);
  });
  it('año completo: 365 días en 2026, 366 en 2028 (bisiesto), 12 meses', () => {
    expect(diasDesdeAlta('2026-01-01')).toBe(365);
    expect(diasDesdeAlta('2028-01-01')).toBe(366);
    expect(mesesCompletosDesdeAlta('2026-01-01')).toBe(12);
  });
  it('alta el 15-mar-2026 → 292 días (24 de vacaciones) pero 9 meses completos (22,5)', () => {
    const dias = diasDesdeAlta('2026-03-15');
    expect(dias).toBe(292); // 17 de marzo + 275 de abril a diciembre
    expect(calcularVacaciones({ diasAnuales: 30, diasTrabajados: dias }).diasExactos).toBeCloseTo(24, 6);
    expect(mesesCompletosDesdeAlta('2026-03-15')).toBe(9);
    expect(vacacionesPorMeses(9)).toBe(22.5);
  });
  it('alta el 31-dic → 1 día y 0 meses completos', () => {
    expect(diasDesdeAlta('2026-12-31')).toBe(1);
    expect(mesesCompletosDesdeAlta('2026-12-31')).toBe(0);
  });
  it('27 días trabajados: 2,22 días por días (30 × 27 / 365) frente a 2,25 con 2,5 por mes', () => {
    expect(calcularVacaciones({ diasAnuales: 30, diasTrabajados: 27 }).diasExactos).toBeCloseTo(2.219, 3);
    expect(vacacionesPorMeses(27 / 30)).toBeCloseTo(2.25, 6);
  });
  it('rechaza fechas mal formadas o inexistentes', () => {
    expect(() => diasDesdeAlta('15/03/2026')).toThrow(RangeError);
    expect(() => diasDesdeAlta('2026-02-30')).toThrow(RangeError);
  });
});
