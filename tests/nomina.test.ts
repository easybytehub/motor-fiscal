import { describe, it, expect } from 'vitest';
import {
  SS_TOTAL,
  BASE_MAX_ANUAL,
  TRAMOS_IRPF,
  cotizacionSeguridadSocial,
  cuotaSolidaridadAnual,
  aplicarLimitesRetencion,
  LIMITE_EXCLUYENTE,
  reduccionRendimientosTrabajo,
  irpfPorTramos,
  calcularNomina,
  brutoDesdeNeto,
  franjaLimite43,
  LIMITE_43_TIPO,
} from '../src/nomina.js';

/**
 * Casos verificados contra fuentes oficiales 2026:
 *  - Cotización del trabajador (6,50 %) y base máxima 61.214,40 €/año: Orden PJC/297/2026, de 30 de
 *    marzo (BOE-A-2026-7296). Contingencias comunes 4,70 % + desempleo 1,55 % + formación 0,10 % +
 *    MEI 0,15 %.
 *  - Escala general IRPF 19/24/30/37/45/47 % (art. 63 + 65 LIRPF, vigente desde 2021, sin cambios
 *    para 2026). Gastos deducibles 2.000 € (art. 19.2.f LIRPF).
 *  - Reducción por obtención de rendimientos del trabajo por tramos (art. 20 LIRPF, redacción
 *    vigente 2025-2026, manual IRPF de la AEAT): 7.302 € hasta 14.852 €; 7.302 − 1,75×(RN−14.852)
 *    hasta 17.673,52 €; 2.364,34 − 1,14×(RN−17.673,52) hasta 19.747,5 €; 0 por encima.
 *  - Mínimo del contribuyente 5.550 € (art. 57) y por primer descendiente 2.400 € (art. 58).
 *
 * FIX de exactitud (auditoría del harness): la lógica inline previa de la página aplicaba el
 * coeficiente 1,75 en todo el rango 14.852-19.747,5 €, omitiendo el tercer tramo. Eso daba
 * reducciones demasiado pequeñas e incluso NEGATIVAS (que aumentaban la base y sobrestimaban el
 * IRPF) para rendimientos previos de ~17.673,52 a 19.747,5 €. El módulo aplica los tres tramos
 * oficiales; el ejemplo resuelto de la página (bruto 24.000 €) queda idéntico porque su rendimiento
 * previo (22.440 €) supera 19.747,5 € y la reducción es 0 en ambos casos.
 */

describe('cotización del trabajador (Orden PJC/297/2026)', () => {
  it('suma 6,50 %', () => {
    expect(SS_TOTAL).toBeCloseTo(0.065, 10);
  });

  it('24.000 € brutos → 1.560 € de cotización', () => {
    expect(cotizacionSeguridadSocial(24000)).toBeCloseTo(1560, 2);
  });

  it('topa en la base máxima 61.214,40 €/año y suma la solidaridad del trabajador sobre el exceso', () => {
    expect(BASE_MAX_ANUAL).toBe(61214.4);
    // 70.000 € brutos: ordinaria sobre el tope (61.214,40 × 6,50 % = 3.978,936 €) + solidaridad
    // (Orden PJC/297/2026, art. 17.1, parte trabajador) sobre 5.833,33 €/mes:
    //   (5.611,32 − 5.101,20) × 0,19 % = 0,969228 + (5.833,333 − 5.611,32) × 0,21 % = 0,466228
    //   → 1,435456 €/mes × 12 = 17,2255 €/año.
    expect(cuotaSolidaridadAnual(70000, 'trabajador')).toBeCloseTo(17.2255, 3);
    expect(cotizacionSeguridadSocial(70000)).toBeCloseTo(3978.936 + 17.2255, 2); // 3.996,16 €
  });

  it('sin exceso sobre la base máxima no hay cuota de solidaridad', () => {
    expect(cuotaSolidaridadAnual(61214.4, 'trabajador')).toBe(0);
    expect(cuotaSolidaridadAnual(24000, 'trabajador')).toBe(0);
  });

  it('solidaridad del trabajador en el tercer tramo (100.000 €: 8.333,33 €/mes)', () => {
    // 510,12 × 0,19 % + 2.040,48 × 0,21 % + (8.333,333 − 7.651,80) × 0,24 %
    // = 0,969228 + 4,285008 + 1,635680 = 6,889916 €/mes × 12 = 82,679 €
    expect(cuotaSolidaridadAnual(100000, 'trabajador')).toBeCloseTo(82.679, 2);
  });
});

describe('reducción por rendimientos del trabajo — tres tramos (art. 20 LIRPF)', () => {
  it('tramo 1: RN ≤ 14.852 € → 7.302 €', () => {
    expect(reduccionRendimientosTrabajo(0)).toBe(7302);
    expect(reduccionRendimientosTrabajo(14000)).toBe(7302);
    expect(reduccionRendimientosTrabajo(14852)).toBe(7302);
  });

  it('tramo 2: en 17.673,52 € da 2.364,34 € (frontera con el tramo 3)', () => {
    expect(reduccionRendimientosTrabajo(17673.52)).toBeCloseTo(2364.34, 2);
  });

  it('tramo 3: en 18.700 € da 1.194,15 €', () => {
    // 2.364,34 − 1,14 × (18.700 − 17.673,52) = 1.194,1528
    expect(reduccionRendimientosTrabajo(18700)).toBeCloseTo(1194.15, 2);
  });

  it('tramo 3: se anula exactamente en 19.747,5 €', () => {
    expect(reduccionRendimientosTrabajo(19747.5)).toBeCloseTo(0, 2);
  });

  it('RN > 19.747,5 € → 0 €', () => {
    expect(reduccionRendimientosTrabajo(20000)).toBe(0);
    expect(reduccionRendimientosTrabajo(22440)).toBe(0); // el del ejemplo resuelto de la página
  });

  it('regresión del bug: nunca es negativa y supera a la fórmula inline errónea', () => {
    // En 19.500 € la lógica inline previa daba 7.302 − 1,75×(19.500−14.852) = −832 € (negativa).
    // La correcta (tramo 3): 2.364,34 − 1,14×(19.500−17.673,52) = 282,1528 €.
    expect(reduccionRendimientosTrabajo(19500)).toBeCloseTo(282.15, 2);
    for (let rn = 0; rn <= 21000; rn += 250) {
      expect(reduccionRendimientosTrabajo(rn)).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('cuota íntegra por la escala general de IRPF', () => {
  it('tiene los seis tramos oficiales 19/24/30/37/45/47 %', () => {
    expect(TRAMOS_IRPF.map((t) => t.tipo)).toEqual([0.19, 0.24, 0.3, 0.37, 0.45, 0.47]);
  });

  const casos: Array<[number, number]> = [
    [0, 0],
    [5550, 1054.5], // mínimo del contribuyente al 19 %
    [12450, 2365.5], // límite del primer tramo
    [20200, 4225.5], // 2.365,5 + 7.750×0,24
    [20440, 4297.5], // + 240×0,30 (base del ejemplo resuelto)
    [35200, 8725.5], // + 15.000×0,30
  ];
  it.each(casos)('base %s € → cuota %s €', (base, cuota) => {
    expect(irpfPorTramos(base)).toBeCloseTo(cuota, 2);
  });
});

describe('ejemplo resuelto de la página (Ana: 24.000 €, 14 pagas, general)', () => {
  const r = calcularNomina({ brutoAnual: 24000, pagas: 14, situacion: 'general' });

  it('cotización SS = 1.560 €', () => {
    expect(r.cotizacionSeguridadSocial).toBeCloseTo(1560, 2);
  });
  it('base liquidable IRPF = 20.440 €', () => {
    expect(r.baseLiquidableIRPF).toBeCloseTo(20440, 2);
  });
  it('retención IRPF = 3.243,00 € (13,5 % efectivo)', () => {
    expect(r.retencionIRPF).toBeCloseTo(3243, 2);
    expect(r.tipoEfectivoIRPF).toBeCloseTo(13.5, 1);
  });
  it('neto anual = 19.197,00 € y neto/paga = 1.371,21 €', () => {
    expect(r.netoAnual).toBeCloseTo(19197, 2);
    expect(r.netoPorPaga).toBeCloseTo(1371.21, 2);
  });
});

describe('situación con hijos (mínimo por primer descendiente 2.400 €)', () => {
  it('24.000 € con hijos deja más neto que en general', () => {
    const general = calcularNomina({ brutoAnual: 24000, pagas: 14, situacion: 'general' });
    const hijos = calcularNomina({ brutoAnual: 24000, pagas: 14, situacion: 'hijos' });
    // minimo 5.550 + 2.400 = 7.950 → irpfPorTramos(7.950)=1.510,5; retención 4.297,5 − 1.510,5 = 2.787
    expect(hijos.retencionIRPF).toBeCloseTo(2787, 2);
    expect(hijos.netoAnual).toBeGreaterThan(general.netoAnual);
  });
});

describe('límites del algoritmo de retención AEAT 2026 (ALGORITMO_2026.pdf)', () => {
  /*
   * Fuente: AEAT, «Algoritmo de cálculo del tipo de retención 2026»:
   *  - Tabla 1 (límite excluyente, art. 81 RIRPF), situación 3 (contribuyente sin cónyuge a cargo):
   *    15.876 € con 0 hijos y 16.342 € con 1 hijo → por debajo, retención 0.
   *  - Límite del 43 % (art. 85.3 RIRPF): si RETRIB ≤ 35.200 €, CUOTA ≤ 0,43 × (RETRIB − límite).
   */
  it('límites excluyentes de la situación 3', () => {
    expect(LIMITE_EXCLUYENTE.general).toBe(15876);
    expect(LIMITE_EXCLUYENTE.hijos).toBe(16342);
    expect(aplicarLimitesRetencion(500, 15876, 'general')).toBe(0);
    expect(aplicarLimitesRetencion(500, 16342, 'hijos')).toBe(0);
  });

  it('el límite del 43 % deja de aplicarse por encima de 35.200 €', () => {
    expect(aplicarLimitesRetencion(99999, 35200, 'general')).toBeCloseTo((35200 - 15876) * 0.43, 2);
    expect(aplicarLimitesRetencion(99999, 35201, 'general')).toBe(99999);
  });

  it('SMI 2026 (17.094 €), general → 523,74 € (sin el límite salía 590,89 €)', () => {
    const r = calcularNomina({ brutoAnual: 17094, pagas: 14, situacion: 'general' });
    // (17.094 − 15.876) × 0,43 = 523,74 €
    expect(r.retencionIRPF).toBeCloseTo(523.74, 2);
  });

  it('18.000 €, general → 913,32 € (antes 1.033,51 €)', () => {
    const r = calcularNomina({ brutoAnual: 18000, pagas: 14, situacion: 'general' });
    expect(r.retencionIRPF).toBeCloseTo(913.32, 2); // (18.000 − 15.876) × 0,43
  });

  it('20.000 €, 14 pagas, general → retención 1.773,32 € (antes 2.044,40 €)', () => {
    const r = calcularNomina({ brutoAnual: 20000, pagas: 14, situacion: 'general' });
    // La escala da 2.044,40 € (rendimiento previo 18.700 € → reducción art. 20 de 1.194,15 €),
    // pero el 43 % de (20.000 − 15.876) = 1.773,32 € es menor y manda.
    expect(r.retencionIRPF).toBeCloseTo(1773.32, 2);
    expect(r.netoAnual).toBeCloseTo(20000 - 1300 - 1773.32, 2);
  });

  it('con 1 hijo el límite usa 16.342 €: 20.000 € → 0,43 × 3.658 = 1.572,94 €', () => {
    const r = calcularNomina({ brutoAnual: 20000, pagas: 14, situacion: 'hijos' });
    expect(r.retencionIRPF).toBeCloseTo(1572.94, 2);
  });

  it('por debajo del límite excluyente no hay retención', () => {
    expect(calcularNomina({ brutoAnual: 15876, pagas: 14 }).retencionIRPF).toBe(0);
    expect(calcularNomina({ brutoAnual: 16300, pagas: 14, situacion: 'hijos' }).retencionIRPF).toBe(0);
  });

  it('el ejemplo de 24.000 € no cambia: la escala (3.243 €) queda bajo el 43 % (3.493,32 €)', () => {
    expect(calcularNomina({ brutoAnual: 24000, pagas: 14 }).retencionIRPF).toBeCloseTo(3243, 2);
  });
});

describe('entradas inválidas', () => {
  it('rechaza bruto ≤ 0, NaN e Infinity', () => {
    expect(() => calcularNomina({ brutoAnual: 0, pagas: 14 })).toThrow(RangeError);
    expect(() => calcularNomina({ brutoAnual: -1, pagas: 14 })).toThrow(RangeError);
    expect(() => calcularNomina({ brutoAnual: NaN, pagas: 14 })).toThrow(RangeError);
    expect(() => calcularNomina({ brutoAnual: Infinity, pagas: 14 })).toThrow(RangeError);
  });
  it('rechaza nº de pagas ≤ 0', () => {
    expect(() => calcularNomina({ brutoAnual: 24000, pagas: 0 })).toThrow(RangeError);
    expect(() => calcularNomina({ brutoAnual: 24000, pagas: -2 })).toThrow(RangeError);
  });
});

/**
 * Del neto al bruto: la inversa de `calcularNomina` con las MISMAS tablas (Orden PJC/297/2026 para
 * la cotización del 6,50 %; LIRPF arts. 19, 20, 57, 58 y 63 y RIRPF arts. 81 y 85.3 para la
 * retención, ver la cabecera de este fichero). Lo que se blinda: que la vuelta reproduce el neto
 * de la ida y que, en la franja del límite del 43 % (art. 85.3 RIRPF), cada euro neto de más cuesta
 * 1 / (1 − 0,065 − 0,43) = 1,98 € brutos.
 */
describe('del neto al bruto (inversa de calcularNomina)', () => {
  it.each([
    [12000, 14, 'general'], [17094, 14, 'general'], [24000, 14, 'general'], [24000, 12, 'hijos'],
    [40000, 12, 'general'], [70000, 14, 'general'], [19000, 14, 'hijos'],
  ] as const)('bruto %d en %d pagas (%s) → neto → bruto con margen de 1 €', (bruto, pagas, situacion) => {
    const ida = calcularNomina({ brutoAnual: bruto, pagas, situacion });
    const vuelta = brutoDesdeNeto({ netoPorPaga: ida.netoPorPaga, pagas, situacion });
    expect(Math.abs(vuelta.brutoAnual - bruto)).toBeLessThan(1);
    expect(vuelta.netoPorPaga).toBeCloseTo(ida.netoPorPaga, 1);
  });

  it('1.500 € netos en 14 pagas, sin hijos → 26.754,78 € brutos al año', () => {
    const r = brutoDesdeNeto({ netoPorPaga: 1500, pagas: 14 });
    expect(r.brutoAnual).toBeCloseTo(26754.78, 1);
    expect(r.brutoPorPaga).toBeCloseTo(26754.78 / 14, 1);
  });

  it('el mismo neto por paga pide menos bruto en 12 pagas (1.500 € → 22.125,39 €)', () => {
    expect(brutoDesdeNeto({ netoPorPaga: 1500, pagas: 12 }).brutoAnual).toBeCloseTo(22125.39, 1);
  });

  it('por debajo del límite excluyente no hay retención: 1.000 € netos en 14 pagas son el bruto ÷ 0,935', () => {
    const r = brutoDesdeNeto({ netoPorPaga: 1000, pagas: 14 });
    expect(r.retencionIRPF).toBe(0);
    expect(r.brutoAnual).toBeCloseTo(14000 / 0.935, 1);
    expect(r.brutoAnual).toBeLessThan(LIMITE_EXCLUYENTE.general);
  });

  it('en la franja del 43 % cada euro neto cuesta 1,98 € brutos', () => {
    const a = brutoDesdeNeto({ netoPorPaga: 1100, pagas: 14 });
    const b = brutoDesdeNeto({ netoPorPaga: 1150, pagas: 14 });
    const pendiente = (b.brutoAnual - a.brutoAnual) / (50 * 14);
    expect(pendiente).toBeCloseTo(1 / (1 - 0.065 - LIMITE_43_TIPO), 2);
  });

  it('la franja donde manda el 43 % va de unos 15.950 a unos 22.720 € brutos (sin hijos)', () => {
    const [desde, hasta] = franjaLimite43('general');
    expect(desde).toBeGreaterThan(LIMITE_EXCLUYENTE.general);
    expect(desde).toBeLessThan(16000);
    expect(hasta).toBeGreaterThan(22700);
    expect(hasta).toBeLessThan(22750);
  });

  it('rechaza un neto no positivo', () => {
    expect(() => brutoDesdeNeto({ netoPorPaga: 0, pagas: 14 })).toThrow(RangeError);
  });
});
