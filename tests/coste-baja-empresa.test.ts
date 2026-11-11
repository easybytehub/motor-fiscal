import { describe, it, expect } from 'vitest';
import { calcularCosteBajaEmpresa } from '../src/coste-baja-empresa.js';

/**
 * Casos verificados contra fuente oficial 2026:
 *  - Art. 144.4 del texto refundido de la LGSS (Real Decreto Legislativo 8/2015, de 30 de
 *    octubre, BOE-A-2015-11724): la obligación de cotizar continúa durante la incapacidad
 *    temporal, cualquiera que sea su causa.
 *  - Art. 173 LGSS: en enfermedad común o accidente no laboral, el pago del subsidio del día 4
 *    al 15 (ambos inclusive) corre a cargo de la empresa; desde el día 16 corre a cargo del
 *    INSS o la mutua, sin perjuicio de que la empresa lo siga adelantando en nómina como pago
 *    delegado y lo compense después en la liquidación de cuotas.
 *  - Porcentajes por tramo (RD 53/1980 + art. 171 LGSS): 60 % días 4-20, 75 % desde el 21 —
 *    mismos que tests/baja-laboral.test.ts.
 *  - Tipos de cotización empresarial 2026: Orden PJC/297/2026 (BOE-A-2026-7296) — mismos que
 *    tests/coste-empresa.test.ts (32,15 % indefinido).
 *  Verificación cruzada de los arts. 144.4 y 173 LGSS: Iberley y minegocioenespana.es.
 *
 * Ejemplo resuelto (mismo escenario que el de la página de baja laboral, para poder cruzar
 * cifras entre páginas): base de cotización mensual 1.800 €, contrato indefinido, 25 días.
 */

describe('calcularCosteBajaEmpresa — ejemplo resuelto (1.800 €/mes, indefinido, 25 días)', () => {
  const r = calcularCosteBajaEmpresa(1800, 'indefinido', 25);

  it('base reguladora diaria = 1.800 ÷ 30 = 60 €', () => {
    expect(r.baseDiaria).toBeCloseTo(60, 2);
  });

  it('cotización SS empresa continúa los 25 días al 32,15 %: 60 × 0,3215 × 25 = 482,25 €', () => {
    expect(r.cotizacionSS).toBeCloseTo(482.25, 2);
  });

  it('tramo directo (días 4-15, 12 días) al 60 %: 12 × 60 × 0,60 = 432,00 €', () => {
    expect(r.diasTramoDirecto).toBe(12);
    expect(r.subsidioDirecto).toBeCloseTo(432, 2);
  });

  it('tramo delegado (días 16-25, 10 días): 5 días al 60 % + 5 días al 75 % = 180 + 225 = 405,00 €', () => {
    expect(r.diasTramoDelegado).toBe(10);
    expect(r.subsidioDelegadoInformativo).toBeCloseTo(405, 2);
  });

  it('coste real = cotización + subsidio directo (NO incluye el delegado, que se compensa): 482,25 + 432 = 914,25 €', () => {
    expect(r.costeReal).toBeCloseTo(914.25, 2);
  });
});

describe('calcularCosteBajaEmpresa — límites de tramos', () => {
  it('con 3 días o menos no hay subsidio a cargo de nadie, solo cotización (días 1-3 sin prestación)', () => {
    const r = calcularCosteBajaEmpresa(1800, 'indefinido', 3);
    expect(r.diasTramoDirecto).toBe(0);
    expect(r.diasTramoDelegado).toBe(0);
    expect(r.subsidioDirecto).toBe(0);
    expect(r.costeReal).toBeCloseTo(r.cotizacionSS, 2);
  });

  it('con 10 días (dentro del tramo 4-15) todo el subsidio es directo, nada delegado', () => {
    const r = calcularCosteBajaEmpresa(1800, 'indefinido', 10);
    expect(r.diasTramoDirecto).toBe(7); // días 4 a 10
    expect(r.diasTramoDelegado).toBe(0);
    expect(r.subsidioDelegadoInformativo).toBe(0);
  });

  it('con exactamente 15 días, el tramo directo se satura en 12 y no hay delegado', () => {
    const r = calcularCosteBajaEmpresa(1800, 'indefinido', 15);
    expect(r.diasTramoDirecto).toBe(12);
    expect(r.diasTramoDelegado).toBe(0);
  });

  it('con 16 días aparece el primer día delegado', () => {
    const r = calcularCosteBajaEmpresa(1800, 'indefinido', 16);
    expect(r.diasTramoDirecto).toBe(12);
    expect(r.diasTramoDelegado).toBe(1);
  });

  it('el tipo de contrato temporal usa el tipo de desempleo empresarial más alto (33,35 %)', () => {
    const indef = calcularCosteBajaEmpresa(1800, 'indefinido', 25);
    const temp = calcularCosteBajaEmpresa(1800, 'temporal', 25);
    expect(temp.cotizacionSS).toBeGreaterThan(indef.cotizacionSS);
    // Diferencia: 60 × (0,067 - 0,055) × 25 = 18,00 €
    expect(temp.cotizacionSS - indef.cotizacionSS).toBeCloseTo(18, 2);
  });

  it('rechaza días de baja no positivos o no finitos', () => {
    expect(() => calcularCosteBajaEmpresa(1800, 'indefinido', 0)).toThrow(RangeError);
    expect(() => calcularCosteBajaEmpresa(1800, 'indefinido', -5)).toThrow(RangeError);
    expect(() => calcularCosteBajaEmpresa(1800, 'indefinido', NaN)).toThrow(RangeError);
  });

  it('sin tipoBaja explícito, por defecto es "comun" (regresión: mismo resultado que antes de añadir el parámetro)', () => {
    const explicito = calcularCosteBajaEmpresa(1800, 'indefinido', 25, 'comun');
    const implicito = calcularCosteBajaEmpresa(1800, 'indefinido', 25);
    expect(implicito).toEqual(explicito);
  });
});

describe('calcularCosteBajaEmpresa — contingencia "laboral" (accidente de trabajo / enfermedad profesional)', () => {
  /**
   * Fuente: art. 173.1 del texto refundido de la LGSS (Real Decreto Legislativo 8/2015, de 30
   * de octubre, BOE-A-2015-11724). En accidente de trabajo o enfermedad profesional la
   * prestación se abona "desde el día siguiente al de la baja en el trabajo, estando a cargo
   * del empresario el salario íntegro correspondiente al día de la baja" — a diferencia de la
   * contingencia común, NO hay tramo de días 4 a 15 a cargo de la empresa: desde el día
   * siguiente al accidente paga directamente la mutua colaboradora (o el INSS) al 75 % de la
   * base reguladora (mismo porcentaje que baja-laboral.ts, PORCENTAJES.laboral).
   * Ejemplo resuelto: base de cotización mensual 1.800 €, contrato indefinido, 10 días de baja.
   */
  const r = calcularCosteBajaEmpresa(1800, 'indefinido', 10, 'laboral');

  it('el tramo directo es SOLO el día del accidente (1 día), no 4-15', () => {
    expect(r.diasTramoDirecto).toBe(1);
  });

  it('el día del accidente se paga como salario íntegro = base diaria (60 €), no al 75 %', () => {
    expect(r.subsidioDirecto).toBeCloseTo(60, 2);
  });

  it('el resto de días (9) son tramo delegado a cargo de la mutua/INSS desde el día siguiente', () => {
    expect(r.diasTramoDelegado).toBe(9);
    // 9 días × 60 € × 75 % = 405,00 €
    expect(r.subsidioDelegadoInformativo).toBeCloseTo(405, 2);
  });

  it('cotización SS empresa continúa los 10 días al 32,15 %: 60 × 0,3215 × 10 = 192,90 €', () => {
    expect(r.cotizacionSS).toBeCloseTo(192.9, 2);
  });

  it('coste real = cotización + salario del día del accidente: 192,90 + 60 = 252,90 €', () => {
    expect(r.costeReal).toBeCloseTo(252.9, 2);
  });

  it('con 1 solo día de baja, todo es tramo directo y no hay delegado', () => {
    const r1 = calcularCosteBajaEmpresa(1800, 'indefinido', 1, 'laboral');
    expect(r1.diasTramoDirecto).toBe(1);
    expect(r1.diasTramoDelegado).toBe(0);
    expect(r1.subsidioDelegadoInformativo).toBe(0);
  });

  it('baja muy corta (2 días): la laboral cuesta MÁS a la empresa, porque en común los días 1-3 no tienen prestación y en laboral el día del accidente se paga al 100 %', () => {
    const laboral = calcularCosteBajaEmpresa(1800, 'indefinido', 2, 'laboral');
    const comun = calcularCosteBajaEmpresa(1800, 'indefinido', 2, 'comun');
    expect(comun.subsidioDirecto).toBe(0); // días 1-3 sin prestación en común
    expect(laboral.costeReal).toBeGreaterThan(comun.costeReal);
  });

  it('baja media (10 días): la común cuesta MÁS a la empresa en tramo directo, porque acumula hasta 12 días (4-15) sin recuperación frente al único día del accidente en laboral — el resultado NO es intuitivo y es justo el que esta página aclara', () => {
    const laboral = calcularCosteBajaEmpresa(1800, 'indefinido', 10, 'laboral');
    const comun = calcularCosteBajaEmpresa(1800, 'indefinido', 10, 'comun');
    expect(comun.costeReal).toBeGreaterThan(laboral.costeReal);
  });
});

describe('tope de la base máxima 2026 (5.101,20 €/mes, Orden PJC/297/2026)', () => {
  it('una base por encima del tope se calcula como 5.101,20 €', () => {
    const topada = calcularCosteBajaEmpresa(8000, 'indefinido', 25);
    const enTope = calcularCosteBajaEmpresa(5101.2, 'indefinido', 25);
    expect(topada.baseTopada).toBe(true);
    expect(topada.baseCotizacionAplicada).toBeCloseTo(5101.2, 2);
    expect(topada.baseDiaria).toBeCloseTo(170.04, 2);
    expect(topada.costeReal).toBeCloseTo(enTope.costeReal, 6);
    expect(enTope.baseTopada).toBe(false);
  });

  it('por debajo del tope no cambia nada', () => {
    const r = calcularCosteBajaEmpresa(1800, 'indefinido', 25);
    expect(r.baseTopada).toBe(false);
    expect(r.baseCotizacionAplicada).toBe(1800);
  });

  it('sigue rechazando bases no finitas o ≤ 0', () => {
    expect(() => calcularCosteBajaEmpresa(Infinity, 'indefinido', 10)).toThrow(RangeError);
    expect(() => calcularCosteBajaEmpresa(0, 'indefinido', 10)).toThrow(RangeError);
    expect(() => calcularCosteBajaEmpresa(NaN, 'indefinido', 10)).toThrow(RangeError);
  });
});

/**
 * Trabajador de 62 años o más. Fuente: art. 144.4, párrafo segundo, del texto refundido de la
 * LGSS (RDLeg 8/2015, BOE-A-2015-11724; párrafo introducido por la Ley 21/2021, de 28 de
 * diciembre), leído en el texto consolidado del BOE (última actualización publicada el
 * 03/10/2026) el 18-oct-2026: «las empresas tendrán derecho a una reducción del 75 por ciento de
 * las cuotas empresariales a la Seguridad Social por contingencias comunes durante la situación
 * de incapacidad temporal de aquellos trabajadores que hubieran cumplido la edad de 62 años».
 * Tipo de contingencias comunes a cargo de la empresa en 2026: 23,60 % (Orden PJC/297/2026).
 */
describe('calcularCosteBajaEmpresa — trabajador de 62 años o más (art. 144.4 LGSS)', () => {
  const r = calcularCosteBajaEmpresa(1800, 'indefinido', 25, 'comun', true);

  it('el tipo baja del 32,15 % al 14,45 %: solo se reduce el 75 % de contingencias comunes (23,60 % × 0,75 = 17,70 puntos)', () => {
    expect(r.tipoCotizacion).toBeCloseTo(0.1445, 6);
  });

  it('cotización de los 25 días: 60 × 0,1445 × 25 = 216,75 €; ahorro 60 × 0,177 × 25 = 265,50 €', () => {
    expect(r.cotizacionSS).toBeCloseTo(216.75, 2);
    expect(r.ahorroMayor62).toBeCloseTo(265.5, 2);
  });

  it('el subsidio de los días 4-15 no cambia (432 €): la reducción es de cuotas, no del subsidio', () => {
    expect(r.subsidioDirecto).toBeCloseTo(432, 2);
    expect(r.costeReal).toBeCloseTo(648.75, 2);
  });

  it('contrato temporal: 33,35 % − 17,70 = 15,65 %', () => {
    const t = calcularCosteBajaEmpresa(1800, 'temporal', 25, 'comun', true);
    expect(t.tipoCotizacion).toBeCloseTo(0.1565, 6);
  });

  it('también en accidente de trabajo («cualquiera que sea su causa» no limita la reducción, que habla de «la situación de incapacidad temporal»)', () => {
    const l = calcularCosteBajaEmpresa(1800, 'indefinido', 25, 'laboral', true);
    expect(l.tipoCotizacion).toBeCloseTo(0.1445, 6);
  });

  it('sin el parámetro el resultado es el de siempre (regresión): 914,25 € y ahorro 0', () => {
    const base = calcularCosteBajaEmpresa(1800, 'indefinido', 25);
    expect(base.costeReal).toBeCloseTo(914.25, 2);
    expect(base.tipoCotizacion).toBeCloseTo(0.3215, 6);
    expect(base.ahorroMayor62).toBe(0);
  });
});
