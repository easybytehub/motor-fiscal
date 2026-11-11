import { describe, it, expect } from 'vitest';
import {
  PAGAS_EXTRA_ANUALES,
  PAGAS_TOTALES_ANUALES,
  DIAS_ANIO,
  MENSUALIDADES_ORDINARIAS,
  calcularFiniquito,
  salarioDiarioOrdinario,
  importePagaExtraProporcional,
} from '../src/finiquito.js';

/**
 * El finiquito liquida importes YA DEVENGADOS al cese (no hay cifra normativa de
 * ley que fije el resultado: depende del salario y del convenio). Se verifican
 * los dos anclajes normativos y los ejemplos resueltos de la página.
 *
 * Fuente oficial: Estatuto de los Trabajadores (Real Decreto Legislativo 2/2015,
 * de 23 de octubre, BOE-A-2015-11430):
 *   - Art. 31: dos gratificaciones extraordinarias al año → factor 2/14 sobre el
 *     salario bruto anual (12 mensualidades + 2 extras = 14 pagas).
 *   - Art. 38: vacaciones anuales mínimo 30 días naturales; las no disfrutadas se
 *     compensan económicamente al terminar el contrato.
 *   - Arts. 26 y 49.2: salario y obligación de liquidación (finiquito) al cese.
 * Verificación art. 38 ("no será inferior a treinta días naturales") y art. 31
 * ("dos gratificaciones extraordinarias al año"): texto consolidado del ET en BOE.
 *
 * Corrección del 1-oct-2026 (doble cómputo de las pagas extra). Con 14 pagas, el
 * salario bruto anual YA contiene las dos extras; si el salario diario es bruto/365
 * y además se suma la prorrata de las extras, se cobran dos veces dentro de los días
 * trabajados y las vacaciones (+16,7 % = 14/12). Sin prorratear, el salario diario
 * ordinario es (bruto · 12/14) / 365 y las extras van SOLO en su prorrata; con las
 * pagas prorrateadas en 12 nóminas, bruto/365 y sin prorrata aparte.
 * Cifras de la página antes → después: 24.000 € 3.221,92 → 3.005,87 €;
 * Marta (21.000 €) 2.761,64 → 2.580,82 €.
 */

describe('constantes normativas (art. 31 ET)', () => {
  it('dos pagas extra al año, 14 pagas totales, 12 mensualidades ordinarias', () => {
    expect(PAGAS_EXTRA_ANUALES).toBe(2);
    expect(PAGAS_TOTALES_ANUALES).toBe(14);
    expect(MENSUALIDADES_ORDINARIAS).toBe(12);
    expect(DIAS_ANIO).toBe(365);
  });
});

describe('ejemplo resuelto de la página (Marta, 21.000 €/año)', () => {
  // 21.000 €/año, 10 días trabajados, 12 de vacaciones, pagas NO prorrateadas,
  // 182 días desde la última paga.
  const r = calcularFiniquito({
    salarioBrutoAnual: 21000,
    diasTrabajadosMes: 10,
    vacacionesPendientes: 12,
    pagasProrrateadas: false,
    diasDesdeUltimaPaga: 182,
  });

  it('salario diario ordinario 21.000 × 12/14 / 365 = 49,32 € (sin las extras)', () => {
    expect(r.salarioDiario).toBeCloseTo(49.32, 2);
  });
  it('10 días trabajados → 493,15 € (antes 575,34 €, con las extras contadas dos veces)', () => {
    expect(r.importeDiasTrabajados).toBeCloseTo(493.15, 2);
  });
  it('12 días de vacaciones → 591,78 € (antes 690,41 €)', () => {
    expect(r.importeVacaciones).toBeCloseTo(591.78, 2);
  });
  it('prorrata pagas extra (3.000 € × 182/365) → 1.495,89 € (no cambia)', () => {
    expect(r.importePagasExtra).toBeCloseTo(1495.89, 2);
  });
  it('total finiquito bruto → 2.580,82 € (antes 2.761,64 €)', () => {
    expect(r.total).toBeCloseTo(2580.82, 2);
  });
});

describe('ejemplo simplificado de la página (24.000 €/año)', () => {
  // 24.000 €/año, 15 días trabajados, 8 de vacaciones, no prorrateadas, 182 días.
  const r = calcularFiniquito({
    salarioBrutoAnual: 24000,
    diasTrabajadosMes: 15,
    vacacionesPendientes: 8,
    pagasProrrateadas: false,
    diasDesdeUltimaPaga: 182,
  });

  it('salario diario ordinario 24.000 × 12/14 / 365 = 56,36 €', () => {
    expect(r.salarioDiario).toBeCloseTo(56.36, 2);
  });
  it('15 días trabajados → 845,40 € (antes 986,30 €)', () => {
    expect(r.importeDiasTrabajados).toBeCloseTo(845.4, 2);
  });
  it('8 días de vacaciones → 450,88 € (antes 526,03 €)', () => {
    expect(r.importeVacaciones).toBeCloseTo(450.88, 2);
  });
  it('prorrata pagas extra (24.000 × 2/14 × 182/365) → 1.709,59 €', () => {
    expect(r.importePagasExtra).toBeCloseTo(1709.59, 2);
  });
  it('total finiquito bruto → 3.005,87 € (antes 3.221,92 €)', () => {
    expect(r.total).toBeCloseTo(3005.87, 2);
  });
});

describe('regresión del doble cómputo de pagas extra (1-oct-2026)', () => {
  it('sin prorratear, el salario diario es exactamente 12/14 del prorrateado', () => {
    const sin = calcularFiniquito({ salarioBrutoAnual: 24000, diasTrabajadosMes: 15, vacacionesPendientes: 8, pagasProrrateadas: false, diasDesdeUltimaPaga: 0 });
    const con = calcularFiniquito({ salarioBrutoAnual: 24000, diasTrabajadosMes: 15, vacacionesPendientes: 8, pagasProrrateadas: true, diasDesdeUltimaPaga: 0 });
    expect(sin.salarioDiario / con.salarioDiario).toBeCloseTo(12 / 14, 12);
  });

  it('un año entero trabajado sin prorratear suma el bruto anual, no 14/12 de él', () => {
    // 365 días de salario ordinario + las dos extras completas = 24.000 € exactos.
    // Con el error anterior salía 24.000 + 3.428,57 = 27.428,57 €.
    const r = calcularFiniquito({ salarioBrutoAnual: 24000, diasTrabajadosMes: 365, vacacionesPendientes: 0, pagasProrrateadas: false, diasDesdeUltimaPaga: 365 });
    expect(r.total).toBeCloseTo(24000, 6);
  });

  it('salarioDiarioOrdinario: bruto/365 prorrateadas, bruto·12/14/365 sin prorratear', () => {
    expect(salarioDiarioOrdinario(36500, true)).toBeCloseTo(100, 10);
    expect(salarioDiarioOrdinario(36500, false)).toBeCloseTo(100 * 12 / 14, 10);
    expect(() => salarioDiarioOrdinario(0, false)).toThrow(RangeError);
  });
});

describe('pagas extra prorrateadas', () => {
  it('no añade prorrata (ya cobradas en las nóminas)', () => {
    const r = calcularFiniquito({
      salarioBrutoAnual: 21000,
      diasTrabajadosMes: 10,
      vacacionesPendientes: 12,
      pagasProrrateadas: true,
      diasDesdeUltimaPaga: 182,
    });
    expect(r.importePagasExtra).toBe(0);
    // Prorrateadas: el salario diario es bruto/365 (la nómina ya lleva las extras) y
    // solo se suman días trabajados + vacaciones: 21.000/365 × 22 = 1.265,75 €.
    expect(r.salarioDiario).toBeCloseTo(57.53, 2);
    expect(r.total).toBeCloseTo(1265.75, 2);
  });
});

describe('límites y fronteras', () => {
  it('días desde última paga = 0 → prorrata 0', () => {
    const r = calcularFiniquito({
      salarioBrutoAnual: 21000,
      diasTrabajadosMes: 0,
      vacacionesPendientes: 0,
      pagasProrrateadas: false,
      diasDesdeUltimaPaga: 0,
    });
    expect(r.importePagasExtra).toBe(0);
    expect(r.total).toBe(0);
  });

  it('días desde última paga se acota a 365 (una anualidad completa = 2/14)', () => {
    const r = calcularFiniquito({
      salarioBrutoAnual: 21000,
      diasTrabajadosMes: 0,
      vacacionesPendientes: 0,
      pagasProrrateadas: false,
      diasDesdeUltimaPaga: 500, // > 365, debe acotarse
    });
    // 21.000 × 2/14 = 3.000 € (las dos pagas completas)
    expect(r.importePagasExtra).toBeCloseTo(3000, 2);
  });

  it('diasDesdeUltimaPaga NaN → prorrata 0 (input vacío)', () => {
    const r = calcularFiniquito({
      salarioBrutoAnual: 21000,
      diasTrabajadosMes: 10,
      vacacionesPendientes: 0,
      pagasProrrateadas: false,
      diasDesdeUltimaPaga: NaN,
    });
    expect(r.importePagasExtra).toBe(0);
  });
});

describe('entradas inválidas', () => {
  const base = {
    salarioBrutoAnual: 21000,
    diasTrabajadosMes: 10,
    vacacionesPendientes: 12,
    pagasProrrateadas: false,
    diasDesdeUltimaPaga: 182,
  };
  it('salario ≤ 0, NaN o Infinity → RangeError', () => {
    expect(() => calcularFiniquito({ ...base, salarioBrutoAnual: 0 })).toThrow(RangeError);
    expect(() => calcularFiniquito({ ...base, salarioBrutoAnual: -1 })).toThrow(RangeError);
    expect(() => calcularFiniquito({ ...base, salarioBrutoAnual: NaN })).toThrow(RangeError);
    expect(() => calcularFiniquito({ ...base, salarioBrutoAnual: Infinity })).toThrow(RangeError);
  });
  it('días trabajados o vacaciones negativos → RangeError', () => {
    expect(() => calcularFiniquito({ ...base, diasTrabajadosMes: -1 })).toThrow(RangeError);
    expect(() => calcularFiniquito({ ...base, vacacionesPendientes: -1 })).toThrow(RangeError);
  });
});

describe('importePagaExtraProporcional (extraída para /fiscal/paga-extra-proporcional-o-prorrateada/)', () => {
  it('con el periodo por defecto (año natural) coincide con calcularFiniquito — regresión', () => {
    // Mismo caso que "ejemplo resuelto de la página (Marta)": 21.000 €, 182 días → 1.495,89 €.
    expect(importePagaExtraProporcional(21000, 182)).toBeCloseTo(1495.89, 2);
    // Mismo caso que "ejemplo simplificado (24.000 €)": 182 días → 1.709,59 €.
    expect(importePagaExtraProporcional(24000, 182)).toBeCloseTo(1709.59, 2);
  });

  it('periodo de devengo semestral (182 días): trabajar el semestre completo da 1 paga entera', () => {
    // 24.000 € × 2/14 = 3.428,57 € es el importe de las DOS pagas extra al año;
    // devengando el semestre completo (182/182) corresponde a UNA paga (mitad del año).
    const dosPagasExtra = (24000 * PAGAS_EXTRA_ANUALES) / PAGAS_TOTALES_ANUALES;
    expect(importePagaExtraProporcional(24000, 182, 182)).toBeCloseTo(dosPagasExtra, 2);
  });

  it('menos de un año: 90 de 182 días de devengo → proporcional, no la paga entera', () => {
    const dosPagasExtra = (24000 * PAGAS_EXTRA_ANUALES) / PAGAS_TOTALES_ANUALES;
    expect(importePagaExtraProporcional(24000, 90, 182)).toBeCloseTo(dosPagasExtra * (90 / 182), 2);
  });

  it('acota los días devengados al periodo (no se puede devengar más de una paga)', () => {
    expect(importePagaExtraProporcional(24000, 400, DIAS_ANIO)).toBeCloseTo(
      importePagaExtraProporcional(24000, DIAS_ANIO, DIAS_ANIO),
      2,
    );
  });

  it('días negativos o NaN → 0 (mismo criterio que calcularFiniquito)', () => {
    expect(importePagaExtraProporcional(24000, -5)).toBe(0);
    expect(importePagaExtraProporcional(24000, NaN)).toBe(0);
  });

  it('salario ≤ 0, NaN o Infinity → RangeError', () => {
    expect(() => importePagaExtraProporcional(0, 182)).toThrow(RangeError);
    expect(() => importePagaExtraProporcional(-1, 182)).toThrow(RangeError);
    expect(() => importePagaExtraProporcional(NaN, 182)).toThrow(RangeError);
    expect(() => importePagaExtraProporcional(Infinity, 182)).toThrow(RangeError);
  });
});
