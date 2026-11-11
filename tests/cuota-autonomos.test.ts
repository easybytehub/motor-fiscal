import { describe, it, expect } from 'vitest';
import {
  TRAMOS, TIPOS_RETA_2026, TIPO_TOTAL_2026, cuotaDeBase, localizarTramo, calcularCuotaAutonomos,
} from '../src/cuota-autonomos.js';

/**
 * Casos verificados contra la Orden PJC/297/2026, de 30 de marzo (BOE-A-2026-7296):
 * - art. 18.1, tabla: límites de rendimiento neto mensual y base mínima de cada tramo;
 * - art. 18.2: CC 28,30 + CP 1,30 + MEI 0,90; art. 37.5.a): cese de actividad 0,90; art. 37.6: FP 0,10.
 *   Total 31,50 %. (Hasta el 11-nov se citaba todo como art. 18.2.)
 * La cuota mínima es base mínima × 31,50 % redondeada al céntimo (la Orden no publica
 * cuotas). Corregido el 1-oct-2026: hasta entonces los tramos 7-15 llevaban las cuotas
 * de 2025 y varios tramos bajos iban desviados unos céntimos.
 */

// [tramo, hasta, base mínima art. 18.1, cuota = base × 0,315 redondeada]
const BOE: Array<[number, number, number, number]> = [
  [1, 670, 653.59, 205.88],
  [2, 900, 718.95, 226.47],
  [3, 1166.7, 849.67, 267.65],
  [4, 1300, 950.98, 299.56],
  [5, 1500, 960.78, 302.65],
  [6, 1700, 960.78, 302.65],
  [7, 1850, 1143.79, 360.29],
  [8, 2030, 1209.15, 380.88],
  [9, 2330, 1274.51, 401.47],
  [10, 2760, 1356.21, 427.21],
  [11, 3190, 1437.91, 452.94],
  [12, 3620, 1519.61, 478.68],
  [13, 4050, 1601.31, 504.41],
  [14, 6000, 1732.03, 545.59],
  [15, Infinity, 1928.1, 607.35],
];

describe('tipos de los arts. 18.2, 37.5.a) y 37.6', () => {
  it('suman 31,50 %', () => {
    const suma = Object.values(TIPOS_RETA_2026).reduce((a, b) => a + b, 0);
    expect(suma).toBeCloseTo(0.315, 10);
    expect(TIPO_TOTAL_2026).toBe(0.315);
  });

  it('redondea al céntimo', () => {
    expect(cuotaDeBase(1143.79)).toBe(360.29);
    expect(cuotaDeBase(849.67)).toBe(267.65);
  });
});

describe('tabla del art. 18.1', () => {
  it('tiene los 15 tramos oficiales', () => {
    expect(TRAMOS).toHaveLength(15);
    expect(TRAMOS.map((t) => t.tramo)).toEqual([...Array(15)].map((_, i) => i + 1));
  });

  it.each(BOE)('tramo %s: hasta %s €, base %s €, cuota %s €', (tramo, hasta, base, cuota) => {
    const t = TRAMOS[tramo - 1];
    expect(t.hasta).toBe(hasta);
    expect(t.baseMinima).toBe(base);
    expect(t.cuota).toBe(cuota);
  });

  it('límites estrictamente crecientes y cuotas no decrecientes (tramos 5-6 comparten base)', () => {
    for (let i = 1; i < TRAMOS.length; i++) {
      expect(TRAMOS[i].hasta).toBeGreaterThan(TRAMOS[i - 1].hasta);
      expect(TRAMOS[i].cuota).toBeGreaterThanOrEqual(TRAMOS[i - 1].cuota);
    }
  });
});

describe('límites de la tabla: todos incluidos en su tramo salvo el del tramo 3', () => {
  it('solo el tramo 3 deja fuera su límite (1.166,70 €)', () => {
    expect(TRAMOS.filter((t) => !t.hastaIncluido).map((t) => [t.tramo, t.hasta])).toEqual([[3, 1166.7]]);
  });
});

describe('localización de tramo en las fronteras', () => {
  // [rendimiento, tramo esperado, cuota mensual esperada]
  const casos: Array<[number, number, number]> = [
    [0, 1, 205.88],
    [670, 1, 205.88],
    [670.01, 2, 226.47],
    [900, 2, 226.47],
    // Frontera tabla reducida / general (art. 18.1): tramo 3 «> 900 y < 1.166,70», general tramo 1
    // «≥ 1.166,70». 1.166,70 € justos es ya el tramo 4. Hasta el 11-nov este caso esperaba el 3.
    [1166.69, 3, 267.65],
    [1166.7, 4, 299.56],
    [1166.71, 4, 299.56],
    [1500, 5, 302.65],
    [1700, 6, 302.65],
    [1850, 7, 360.29],
    [2030, 8, 380.88],
    [2330, 9, 401.47],
    [2760, 10, 427.21],
    [3190, 11, 452.94],
    [3620, 12, 478.68],
    [4050, 13, 504.41],
    [6000, 14, 545.59],
    [6000.01, 15, 607.35],
    [50000, 15, 607.35],
  ];

  it.each(casos)('rendimiento %s €/mes → tramo %s, cuota %s €', (rendimiento, tramo, cuota) => {
    const r = calcularCuotaAutonomos(rendimiento);
    expect(r.tramo.tramo).toBe(tramo);
    expect(r.cuotaMensual).toBe(cuota);
  });
});

describe('ejemplos de la página', () => {
  it('1.800 €/mes (diseñadora freelance) → tramo 7, 360,29 €/mes, 4.323,48 €/año', () => {
    const r = calcularCuotaAutonomos(1800);
    expect(r.tramo.tramo).toBe(7);
    expect(r.cuotaMensual).toBe(360.29);
    expect(r.cuotaAnual).toBe(4323.48);
  });

  it('1.500 €/mes (valor inicial de la herramienta) → tramo 5, 302,65 €/mes, 3.631,80 €/año', () => {
    const r = calcularCuotaAutonomos(1500);
    expect(r.tramo.tramo).toBe(5);
    expect(r.cuotaMensual).toBe(302.65);
    expect(r.cuotaAnual).toBe(3631.8);
  });
});

describe('entradas inválidas', () => {
  it('rechaza negativos, NaN e Infinity', () => {
    expect(() => localizarTramo(-1)).toThrow(RangeError);
    expect(() => localizarTramo(NaN)).toThrow(RangeError);
    expect(() => localizarTramo(Infinity)).toThrow(RangeError);
  });
});
