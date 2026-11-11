import { describe, it, expect } from 'vitest';
import {
  PORCENTAJES,
  baseReguladoraDiaria,
  baseReguladoraDiariaProfesional,
  calcularBajaLaboral,
  calendarioBaja,
  diaDeBaja,
} from '../src/baja-laboral.js';

/**
 * Casos verificados contra fuente oficial 2026:
 *  - Régimen de la prestación de incapacidad temporal: arts. 169-176 del texto refundido de la
 *    LGSS (Real Decreto Legislativo 8/2015, de 30 de octubre, BOE-A-2015-11724).
 *  - Porcentajes de la base reguladora — Real Decreto 53/1980, de 11 de enero:
 *      · Enfermedad común / accidente no laboral: días 1-3 al 0 % (salvo mejora de convenio),
 *        días 4-20 al 60 %, día 21 en adelante al 75 %.
 *      · Accidente de trabajo / enfermedad profesional: 75 % desde el día siguiente a la baja
 *        (art. 171 LGSS).
 *  - Base reguladora diaria = base de cotización del mes anterior ÷ 30.
 *  Verificación cruzada: guía de la Seguridad Social (seg-social.es) e Iberley (texto
 *  consolidado). Todos los importes salen de baseDiaria × porcentaje × días del tramo.
 */

describe('porcentajes oficiales (RD 53/1980 + art. 171 LGSS)', () => {
  it('coinciden con los porcentajes de ley', () => {
    expect(PORCENTAJES.comunDias1a3).toBe(0);
    expect(PORCENTAJES.comunDias4a20).toBe(0.6);
    expect(PORCENTAJES.comunDias21mas).toBe(0.75);
    expect(PORCENTAJES.laboral).toBe(0.75);
  });
});

describe('base reguladora diaria', () => {
  it('base mensual ÷ 30', () => {
    expect(baseReguladoraDiaria(1800)).toBeCloseTo(60, 2);
    expect(baseReguladoraDiaria(1500)).toBeCloseTo(50, 2);
  });

  it('rechaza base no positiva o no finita', () => {
    expect(() => baseReguladoraDiaria(0)).toThrow(RangeError);
    expect(() => baseReguladoraDiaria(-100)).toThrow(RangeError);
    expect(() => baseReguladoraDiaria(NaN)).toThrow(RangeError);
    expect(() => baseReguladoraDiaria(Infinity)).toThrow(RangeError);
  });
});

describe('ejemplo resuelto de la página (Marta: 1.800 €, enfermedad común, 25 días)', () => {
  const r = calcularBajaLaboral(1800, 'comun', 25);

  it('base reguladora diaria = 60 €/día', () => {
    expect(r.baseDiaria).toBeCloseTo(60, 2);
  });

  it('desglose por tramos: 0 € + 612 € + 225 €', () => {
    // Días 1-3 (3 días, 0 %) → 0 €
    expect(r.tramos[0].importe).toBeCloseTo(0, 2);
    // Días 4-20 (17 días, 60 %) → 17 × 60 × 0,60 = 612 €
    expect(r.tramos[1].importe).toBeCloseTo(612, 2);
    // Días 21-25 (5 días, 75 %) → 5 × 60 × 0,75 = 225 €
    expect(r.tramos[2].importe).toBeCloseTo(225, 2);
  });

  it('total 837 € y media 33,48 €/día', () => {
    expect(r.total).toBeCloseTo(837, 2);
    expect(r.mediaPorDia).toBeCloseTo(33.48, 2);
  });
});

describe('fronteras de los tramos — enfermedad común (base 1.800 € → 60 €/día)', () => {
  it('3 días: solo tramo de carencia → 0 €', () => {
    expect(calcularBajaLaboral(1800, 'comun', 3).total).toBeCloseTo(0, 2);
  });

  it('4 días: primer día al 60 % → 36 €', () => {
    // Día 4 es el primero con prestación: 1 × 60 × 0,60 = 36 €
    expect(calcularBajaLaboral(1800, 'comun', 4).total).toBeCloseTo(36, 2);
  });

  it('20 días: 17 días al 60 %, ninguno al 75 % → 612 €', () => {
    const r = calcularBajaLaboral(1800, 'comun', 20);
    expect(r.total).toBeCloseTo(612, 2);
    expect(r.tramos[2].importe).toBeCloseTo(0, 2); // día 21 aún no alcanzado
  });

  it('21 días: se suma el primer día al 75 % → 612 + 45 = 657 €', () => {
    const r = calcularBajaLaboral(1800, 'comun', 21);
    expect(r.tramos[2].importe).toBeCloseTo(45, 2); // 1 × 60 × 0,75
    expect(r.total).toBeCloseTo(657, 2);
  });
});

describe('accidente de trabajo / enfermedad profesional (75 % desde el día siguiente)', () => {
  it('base 1.800 €, 25 días → 25 × 60 × 0,75 = 1.125 €', () => {
    const r = calcularBajaLaboral(1800, 'laboral', 25);
    expect(r.baseDiaria).toBeCloseTo(60, 2);
    expect(r.total).toBeCloseTo(1125, 2);
    expect(r.tramos).toHaveLength(1);
    expect(r.mediaPorDia).toBeCloseTo(45, 2); // 75 % desde el primer día
  });

  it('es más favorable que la enfermedad común a igualdad de base y días', () => {
    const comun = calcularBajaLaboral(1800, 'comun', 25).total;
    const laboral = calcularBajaLaboral(1800, 'laboral', 25).total;
    expect(laboral).toBeGreaterThan(comun);
  });
});

describe('entradas inválidas de días', () => {
  it('rechaza días no positivos o no finitos', () => {
    expect(() => calcularBajaLaboral(1800, 'comun', 0)).toThrow(RangeError);
    expect(() => calcularBajaLaboral(1800, 'comun', -5)).toThrow(RangeError);
    expect(() => calcularBajaLaboral(1800, 'comun', NaN)).toThrow(RangeError);
  });
});

/**
 * Modo proyecto: la baja con fechas, pagador por día y reparto por mes de nómina.
 * Quién paga — art. 173.1 LGSS (Real Decreto Legislativo 8/2015, BOE-A-2015-11724, texto
 * consolidado leído en https://www.boe.es/buscar/act.php?id=BOE-A-2015-11724 el 2026-10-13):
 *   «En caso de enfermedad común o de accidente no laboral, el subsidio se abonará a partir del
 *   cuarto día de baja en el trabajo, si bien desde el día cuarto al decimoquinto de baja, ambos
 *   inclusive, el subsidio estará a cargo del empresario.»
 *   «En caso de accidente de trabajo o enfermedad profesional, el subsidio se abonará desde el día
 *   siguiente al de la baja en el trabajo, estando a cargo del empresario el salario íntegro
 *   correspondiente al día de la baja.»
 * Porcentajes: RD 53/1980 (60 % días 4-20, 75 % desde el 21), los mismos de arriba.
 */
describe('pagador y porcentaje por día (art. 173.1 LGSS + RD 53/1980)', () => {
  it('común: 1-3 nadie, 4-15 empresa al 60 %, 16-20 INSS/mutua al 60 %, 21+ INSS/mutua al 75 %', () => {
    expect(diaDeBaja('comun', 3)).toEqual({ porcentaje: 0, pagador: 'nadie' });
    expect(diaDeBaja('comun', 4)).toEqual({ porcentaje: 0.6, pagador: 'empresa' });
    expect(diaDeBaja('comun', 15)).toEqual({ porcentaje: 0.6, pagador: 'empresa' });
    // El día 16 cambia quién paga, NO cuánto: sigue al 60 % (el error de quien publica «75 % desde el 16»).
    expect(diaDeBaja('comun', 16)).toEqual({ porcentaje: 0.6, pagador: 'inss-mutua' });
    expect(diaDeBaja('comun', 20)).toEqual({ porcentaje: 0.6, pagador: 'inss-mutua' });
    expect(diaDeBaja('comun', 21)).toEqual({ porcentaje: 0.75, pagador: 'inss-mutua' });
  });

  it('accidente de trabajo: 75 % a cargo de la mutua o el INSS desde el primer día de subsidio', () => {
    expect(diaDeBaja('laboral', 1)).toEqual({ porcentaje: 0.75, pagador: 'inss-mutua' });
  });
});

describe('calendario: Marta (1.800 €, común, 25 días) con la baja desde el 28 de octubre de 2026', () => {
  const c = calendarioBaja(1800, 'comun', 25, '2026-10-28');

  it('cuatro tramos con fechas: 28-30 oct sin prestación, 31 oct-11 nov empresa, 12-16 nov INSS 60 %, 17-21 nov INSS 75 %', () => {
    expect(c.tramos.map((t) => [t.desde, t.hasta, t.porcentaje, t.pagador])).toEqual([
      ['2026-10-28', '2026-10-30', 0, 'nadie'],
      ['2026-10-31', '2026-11-11', 0.6, 'empresa'],
      ['2026-11-12', '2026-11-16', 0.6, 'inss-mutua'],
      ['2026-11-17', '2026-11-21', 0.75, 'inss-mutua'],
    ]);
    // 12 días × 36 € = 432 € a cargo de la empresa; 5 × 36 = 180 € y 5 × 45 = 225 € del INSS o la mutua.
    expect(c.tramos[1].importe).toBeCloseTo(432, 2);
    expect(c.tramos[2].importe).toBeCloseTo(180, 2);
    expect(c.tramos[3].importe).toBeCloseTo(225, 2);
    expect(c.fin).toBe('2026-11-21');
  });

  it('reparto por nómina: octubre 36 € (solo el día 31), noviembre 801 €; suma = 837 € del cálculo sin fechas', () => {
    expect(c.meses.map((m) => [m.mes, m.dias])).toEqual([['2026-10', 4], ['2026-11', 21]]);
    expect(c.meses[0].prestacion).toBeCloseTo(36, 2);
    expect(c.meses[1].prestacion).toBeCloseTo(801, 2);
    expect(c.prestacion).toBeCloseTo(calcularBajaLaboral(1800, 'comun', 25).total, 6);
    expect(c.complemento).toBe(0);
  });
});

describe('calendario: complemento de convenio hasta el 100 % de la base', () => {
  it('Marta con convenio al 100 %: cada día cobra 60 €, 25 × 60 = 1.500 €; la empresa pone 663 €', () => {
    const c = calendarioBaja(1800, 'comun', 25, '2026-10-28', 100);
    expect(c.total).toBeCloseTo(1500, 2);
    expect(c.complemento).toBeCloseTo(1500 - 837, 2);
    // Octubre: 4 días × 60 € = 240 €.
    expect(c.meses[0].total).toBeCloseTo(240, 2);
  });

  it('un complemento por debajo de lo que ya paga la prestación no suma nada (nunca negativo)', () => {
    const c = calendarioBaja(1800, 'laboral', 10, '2026-03-01', 50);
    expect(c.complemento).toBe(0);
    expect(c.total).toBeCloseTo(10 * 45, 2);
  });
});

describe('calendario: fronteras y entradas', () => {
  it('cruza de año y respeta febrero bisiesto/no bisiesto', () => {
    expect(calendarioBaja(1800, 'comun', 3, '2026-12-30').meses.map((m) => m.mes)).toEqual(['2026-12', '2027-01']);
    expect(calendarioBaja(1800, 'comun', 2, '2027-02-28').fin).toBe('2027-03-01');
    expect(calendarioBaja(1800, 'comun', 2, '2028-02-28').fin).toBe('2028-02-29');
  });

  it('accidente de trabajo cruzando mes: todo al 75 %, a cargo de la mutua o el INSS', () => {
    const c = calendarioBaja(1800, 'laboral', 25, '2026-10-28');
    expect(c.tramos).toHaveLength(1);
    expect(c.meses[0].prestacion).toBeCloseTo(4 * 45, 2);
    expect(c.prestacion).toBeCloseTo(1125, 2);
  });

  it('rechaza fechas inexistentes, días no enteros y complementos fuera de rango', () => {
    expect(() => calendarioBaja(1800, 'comun', 5, '2026-02-31')).toThrow(RangeError);
    expect(() => calendarioBaja(1800, 'comun', 5, '28/10/2026')).toThrow(RangeError);
    expect(() => calendarioBaja(1800, 'comun', 10.5, '2026-10-28')).toThrow(RangeError);
    expect(() => calendarioBaja(1800, 'comun', 5, '2026-10-28', 120)).toThrow(RangeError);
  });
});

/**
 * Accidente de trabajo / enfermedad profesional con horas extra (11-nov-2026). Fuente: página de
 * cuantía de la IT de la Seguridad Social, leída el 11-nov-2026:
 * https://www.seg-social.es/wps/portal/wss/internet/Trabajadores/PrestacionesPensionesTrabajadores/10952/28362/28365
 * «La BR se obtiene por adición de dos sumandos: La base de cotización por contingencias
 * profesionales del mes anterior, sin horas extraordinarias, dividida por el número de días a que
 * corresponda dicha cotización. La cotización por horas extraordinarias del año natural anterior,
 * dividida entre 365 días, salvo que la antigüedad en la empresa sea inferior, en cuyo caso, se
 * expresará el número de días de alta laboral en la empresa excluidos los del mes de la baja.»
 * Contingencias comunes: «… por el número de días a que dicha cotización se refiere (este divisor
 * será concretamente: 30, si la persona trabajadora tiene salario mensual …)».
 */
describe('accidente de trabajo: base sin horas extra ÷ 30 + horas extra del año anterior ÷ 365 (Seg. Social)', () => {
  it('ejemplo de la página: 1.800 € sin horas extra y 1.460 € de horas extra → 64 €/día', () => {
    expect(baseReguladoraDiariaProfesional(1800, 1460)).toBeCloseTo(64, 6);
    const r = calcularBajaLaboral(1800, 'laboral', 30, 1460);
    expect(r.baseDiaria).toBeCloseTo(64, 6);
    expect(r.total).toBeCloseTo(1440, 6); // 30 × 64 × 75 %
  });

  it('sin horas extra da lo mismo que antes (1.350 € en 30 días con 1.800 €)', () => {
    expect(calcularBajaLaboral(1800, 'laboral', 30).total).toBeCloseTo(1350, 6);
    expect(calcularBajaLaboral(1800, 'laboral', 30, 0).total).toBeCloseTo(1350, 6);
  });

  it('con menos de un año en la empresa divide entre los días de alta (730 € en 146 días → +5 €/día)', () => {
    expect(baseReguladoraDiariaProfesional(1800, 730, 146)).toBeCloseTo(65, 6);
  });

  it('en enfermedad común las horas extra no cuentan (la base por contingencias comunes no las lleva)', () => {
    expect(calcularBajaLaboral(1800, 'comun', 25, 1460).total).toBeCloseTo(837, 6);
  });

  it('rechaza horas extra negativas y divisores fuera de 1-365', () => {
    expect(() => baseReguladoraDiariaProfesional(1800, -1)).toThrow(RangeError);
    expect(() => baseReguladoraDiariaProfesional(1800, 100, 0)).toThrow(RangeError);
    expect(() => baseReguladoraDiariaProfesional(1800, 100, 366)).toThrow(RangeError);
  });
});
