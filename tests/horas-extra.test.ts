import { describe, it, expect } from 'vitest';
import {
  LIMITE_HORAS_EXTRA_ANUAL,
  JORNADA_MAXIMA_SEMANAL_HORAS,
  JORNADA_ANUAL_REFERENCIA,
  COTIZACION_HORAS_EXTRA,
  calcularHorasExtra,
} from '../src/horas-extra.js';

/**
 * Casos verificados contra el texto refundido de la Ley del Estatuto de los
 * Trabajadores (Real Decreto Legislativo 2/2015, de 23 de octubre,
 * BOE-A-2015-11430), texto consolidado:
 *  - Art. 35.1 ET: el valor de la hora extraordinaria "en ningún caso podrá ser
 *    inferior al valor de la hora ordinaria"; el recargo lo fija el convenio o el
 *    contrato, no la ley (por eso el mínimo legal es recargo 0 %).
 *  - Art. 35.2 ET: máximo de 80 horas extraordinarias al año.
 *  - Art. 34.1 ET: jornada máxima de 40 horas semanales de promedio en cómputo
 *    anual (≈ 1.800 h/año descontando festivos y vacaciones).
 * Verificado vía texto del art. 35 ET (conceptosjuridicos.com / Iberley, texto
 * consolidado) y prensa 2026 (El Español, 17-02-2026, "límite de 80 horas extra").
 */

describe('constantes normativas (art. 34-35 ET)', () => {
  it('límite legal de 80 horas extra al año (art. 35.2 ET)', () => {
    expect(LIMITE_HORAS_EXTRA_ANUAL).toBe(80);
  });

  it('jornada máxima de 40 horas semanales (art. 34.1 ET) y referencia anual 1.800 h', () => {
    expect(JORNADA_MAXIMA_SEMANAL_HORAS).toBe(40);
    expect(JORNADA_ANUAL_REFERENCIA).toBe(1800);
  });
});

describe('ejemplo resuelto de la página (Carlos)', () => {
  // 21.600 € / 1.800 h = 12,00 €/hora; ×1,25 = 15,00 €/hora; ×10 h = 150,00 €.
  it('21.600 €, 1.800 h, 10 horas extra, recargo 25 % → 150,00 €', () => {
    const r = calcularHorasExtra({
      salarioBrutoAnual: 21600,
      horasAnuales: 1800,
      numHoras: 10,
      recargoPorcentaje: 25,
    });
    expect(r.valorHoraOrdinaria).toBeCloseTo(12.0, 2);
    expect(r.valorHoraExtra).toBeCloseTo(15.0, 2);
    expect(r.total).toBeCloseTo(150.0, 2);
  });

  // Mismo caso sin recargo (0 %): mínimo legal = valor de la hora ordinaria.
  it('mismo caso con recargo 0 % → 12,00 €/hora, 120,00 € por 10 horas (art. 35.1 ET)', () => {
    const r = calcularHorasExtra({
      salarioBrutoAnual: 21600,
      horasAnuales: 1800,
      numHoras: 10,
      recargoPorcentaje: 0,
    });
    expect(r.valorHoraExtra).toBeCloseTo(12.0, 2);
    expect(r.total).toBeCloseTo(120.0, 2);
  });
});

describe('valor de la hora ordinaria por jornada de convenio', () => {
  // Un convenio con jornada anual menor sube el valor de cada hora (art. 35.1 suelo).
  it('misma retribución, jornada 1.700 h → hora ordinaria más cara que a 1.800 h', () => {
    const base = { salarioBrutoAnual: 21600, numHoras: 1, recargoPorcentaje: 0 };
    const a1800 = calcularHorasExtra({ ...base, horasAnuales: 1800 });
    const a1700 = calcularHorasExtra({ ...base, horasAnuales: 1700 });
    expect(a1800.valorHoraOrdinaria).toBeCloseTo(12.0, 2);
    expect(a1700.valorHoraOrdinaria).toBeCloseTo(21600 / 1700, 6);
    expect(a1700.valorHoraOrdinaria).toBeGreaterThan(a1800.valorHoraOrdinaria);
  });
});

describe('recargo y linealidad', () => {
  it('el recargo del 50 % sobre la hora ordinaria es exacto', () => {
    const r = calcularHorasExtra({
      salarioBrutoAnual: 24000,
      horasAnuales: 1800,
      numHoras: 8,
      recargoPorcentaje: 50,
    });
    const valorHora = 24000 / 1800;
    expect(r.valorHoraExtra).toBeCloseTo(valorHora * 1.5, 6);
    expect(r.total).toBeCloseTo(valorHora * 1.5 * 8, 6);
  });

  it('0 horas extra → total 0 (pero el valor de la hora extra se sigue calculando)', () => {
    const r = calcularHorasExtra({
      salarioBrutoAnual: 24000,
      horasAnuales: 1800,
      numHoras: 0,
      recargoPorcentaje: 75,
    });
    expect(r.total).toBe(0);
    expect(r.valorHoraExtra).toBeGreaterThan(0);
  });
});

describe('entradas inválidas', () => {
  const ok = { salarioBrutoAnual: 24000, horasAnuales: 1800, numHoras: 10, recargoPorcentaje: 25 };

  it('rechaza salario ≤ 0, NaN o Infinity', () => {
    expect(() => calcularHorasExtra({ ...ok, salarioBrutoAnual: 0 })).toThrow(RangeError);
    expect(() => calcularHorasExtra({ ...ok, salarioBrutoAnual: -1 })).toThrow(RangeError);
    expect(() => calcularHorasExtra({ ...ok, salarioBrutoAnual: NaN })).toThrow(RangeError);
    expect(() => calcularHorasExtra({ ...ok, salarioBrutoAnual: Infinity })).toThrow(RangeError);
  });

  it('rechaza jornada anual ≤ 0 (evita división por cero)', () => {
    expect(() => calcularHorasExtra({ ...ok, horasAnuales: 0 })).toThrow(RangeError);
    expect(() => calcularHorasExtra({ ...ok, horasAnuales: -1 })).toThrow(RangeError);
  });

  it('rechaza número de horas o recargo negativos, NaN o Infinity', () => {
    expect(() => calcularHorasExtra({ ...ok, numHoras: -1 })).toThrow(RangeError);
    expect(() => calcularHorasExtra({ ...ok, numHoras: NaN })).toThrow(RangeError);
    expect(() => calcularHorasExtra({ ...ok, recargoPorcentaje: -1 })).toThrow(RangeError);
    expect(() => calcularHorasExtra({ ...ok, recargoPorcentaje: Infinity })).toThrow(RangeError);
  });
});

/**
 * Ampliación del 30-oct-2026. Fuentes leídas ese día:
 *  - Orden PJC/297/2026, de 30 de marzo, art. 5 «Cotización adicional por horas
 *    extraordinarias» (BOE-A-2026-7296, https://www.boe.es/diario_boe/txt.php?id=BOE-A-2026-7296):
 *    fuerza mayor 14,00 % (12,00 empresa, 2,00 trabajador); las demás 28,30 % (23,60 empresa,
 *    4,70 trabajador).
 *  - Art. 35.2 ET, párrafo 2 (BOE-A-2015-11430, https://www.boe.es/buscar/act.php?id=BOE-A-2015-11430):
 *    con una jornada en cómputo anual inferior a la general por la modalidad o duración del
 *    contrato, el máximo de horas extra «se reducirá en la misma proporción».
 */
describe('cotización adicional 2026 (Orden PJC/297/2026, art. 5)', () => {
  it('tipos: 28,30 % (23,60 + 4,70) y fuerza mayor 14,00 % (12,00 + 2,00)', () => {
    expect(COTIZACION_HORAS_EXTRA.resto.empresa + COTIZACION_HORAS_EXTRA.resto.trabajador).toBeCloseTo(28.3, 6);
    expect(COTIZACION_HORAS_EXTRA.resto.trabajador).toBe(4.7);
    expect(COTIZACION_HORAS_EXTRA.fuerzaMayor.empresa).toBe(12);
    expect(COTIZACION_HORAS_EXTRA.fuerzaMayor.trabajador).toBe(2);
  });

  // Ejemplo de la página (Carlos): 150,00 € × 4,70 % = 7,05 €; × 23,60 % = 35,40 €.
  it('150,00 € de horas extra normales → 7,05 € al trabajador y 35,40 € a la empresa', () => {
    const r = calcularHorasExtra({ salarioBrutoAnual: 21600, horasAnuales: 1800, numHoras: 10, recargoPorcentaje: 25 });
    expect(r.tipoTrabajador).toBe(4.7);
    expect(r.cotizacionTrabajador).toBeCloseTo(7.05, 2);
    expect(r.cotizacionEmpresa).toBeCloseTo(35.4, 2);
  });

  it('las mismas por fuerza mayor → 3,00 € al trabajador y 18,00 € a la empresa', () => {
    const r = calcularHorasExtra({
      salarioBrutoAnual: 21600, horasAnuales: 1800, numHoras: 10, recargoPorcentaje: 25, fuerzaMayor: true,
    });
    expect(r.tipoTrabajador).toBe(2);
    expect(r.cotizacionTrabajador).toBeCloseTo(3.0, 2);
    expect(r.cotizacionEmpresa).toBeCloseTo(18.0, 2);
  });

  it('la cotización no cambia el valor de la hora extra', () => {
    const base = { salarioBrutoAnual: 21600, horasAnuales: 1800, numHoras: 10, recargoPorcentaje: 25 };
    expect(calcularHorasExtra({ ...base, fuerzaMayor: true }).total)
      .toBeCloseTo(calcularHorasExtra(base).total, 9);
  });
});

describe('tope anual proporcional a la duración del contrato (art. 35.2 ET)', () => {
  const base = { salarioBrutoAnual: 21600, horasAnuales: 1800, numHoras: 10, recargoPorcentaje: 0 };
  it('12 meses (por defecto) → 80 horas', () => {
    expect(calcularHorasExtra(base).limiteAnual).toBe(80);
  });
  it('contrato de 6 meses → 40 horas; de 3 meses → 20; de 9 → 60', () => {
    expect(calcularHorasExtra({ ...base, mesesContrato: 6 }).limiteAnual).toBe(40);
    expect(calcularHorasExtra({ ...base, mesesContrato: 3 }).limiteAnual).toBe(20);
    expect(calcularHorasExtra({ ...base, mesesContrato: 9 }).limiteAnual).toBe(60);
  });
  it('rechaza meses fuera de 1-12', () => {
    expect(() => calcularHorasExtra({ ...base, mesesContrato: 0 })).toThrow(RangeError);
    expect(() => calcularHorasExtra({ ...base, mesesContrato: 13 })).toThrow(RangeError);
    expect(() => calcularHorasExtra({ ...base, mesesContrato: NaN })).toThrow(RangeError);
  });
});
