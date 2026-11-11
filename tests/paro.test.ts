import { describe, it, expect } from 'vitest';
import {
  calcularParo,
  topesMensuales,
  categoriaHijos,
  TOPES_PORCENTAJE,
  IPREM_MENSUAL_2026,
  FACTOR_SEXTA_PARTE,
  PORCENTAJE_PRIMEROS_180,
  PORCENTAJE_DESDE_181,
  ESCALA_DURACION,
  DIAS_COTIZADOS_MINIMOS,
  duracionPrestacion,
  totalPrestacion,
  netoParo,
  descuentoCotizacion,
  TIPO_COTIZACION_TRABAJADOR_PARO,
} from '../src/paro.js';

/**
 * Casos verificados contra la fuente oficial:
 *   - Art. 270 del texto refundido de la LGSS (Real Decreto Legislativo 8/2015,
 *     de 30 de octubre, BOE-A-2015-11724): 70 % de la base reguladora los
 *     primeros 180 días y 60 % desde el día 181; topes máximo 175 %/200 %/225 %
 *     y mínimo 80 %/107 % del IPREM "incrementado en una sexta parte" (× 7/6).
 *   - IPREM 2026: 600 €/mes (Ley 31/2022 de PGE 2023, prorrogada; congelado
 *     desde 2023).
 *   - Cuantías 2026 de la prestación contributiva publicadas por el SEPE
 *     ("Cuantías anuales"): máx. sin hijos 1.225,00 €, 1 hijo 1.400,00 €,
 *     2+ hijos 1.575,00 €; mín. sin hijos 560,00 €, con hijos 749,00 €.
 */

describe('constantes normativas (art. 270 LGSS + IPREM 2026)', () => {
  it('IPREM mensual 2026 = 600 € y porcentajes 70 % / 60 %', () => {
    expect(IPREM_MENSUAL_2026).toBe(600);
    expect(PORCENTAJE_PRIMEROS_180).toBe(0.7);
    expect(PORCENTAJE_DESDE_181).toBe(0.6);
  });

  it('el factor "incrementado en una sexta parte" es 7/6 (600 € → 700 €)', () => {
    expect(FACTOR_SEXTA_PARTE).toBeCloseTo(7 / 6, 10);
    expect(IPREM_MENSUAL_2026 * FACTOR_SEXTA_PARTE).toBeCloseTo(700, 6);
  });

  it('porcentajes de los topes según hijos (art. 270.3 LGSS)', () => {
    expect(TOPES_PORCENTAJE[0]).toMatchObject({ min: 0.8, max: 1.75 });
    expect(TOPES_PORCENTAJE[1]).toMatchObject({ min: 1.07, max: 2.0 });
    expect(TOPES_PORCENTAJE[2]).toMatchObject({ min: 1.07, max: 2.25 });
  });
});

describe('topes mensuales en EUR (SEPE, cuantías 2026)', () => {
  // [hijos, min esperado, max esperado] — importes publicados por el SEPE
  const casos: Array<[number, number, number]> = [
    [0, 560.0, 1225.0], // sin hijos
    [1, 749.0, 1400.0], // un hijo
    [2, 749.0, 1575.0], // dos o más hijos
    [5, 749.0, 1575.0], // 5 hijos → misma categoría que "2 o más"
  ];

  it.each(casos)('%s hijo(s) → mín. %s €, máx. %s €', (hijos, min, max) => {
    const t = topesMensuales(hijos);
    expect(t.min).toBeCloseTo(min, 2);
    expect(t.max).toBeCloseTo(max, 2);
  });
});

describe('categorización de hijos', () => {
  it('normaliza a 0, 1 o "2 o más"', () => {
    expect(categoriaHijos(0)).toBe(0);
    expect(categoriaHijos(1)).toBe(1);
    expect(categoriaHijos(2)).toBe(2);
    expect(categoriaHijos(3)).toBe(2);
    expect(categoriaHijos(10)).toBe(2);
  });

  it('rechaza negativos y no finitos', () => {
    expect(() => categoriaHijos(-1)).toThrow(RangeError);
    expect(() => categoriaHijos(NaN)).toThrow(RangeError);
    expect(() => categoriaHijos(Infinity)).toThrow(RangeError);
  });
});

describe('ejemplo resuelto de la página (María, 1.800 €, sin hijos)', () => {
  it('meses 1-6 tope máx. 1.225 €; desde mes 7 → 1.080 € (sin tope)', () => {
    const r = calcularParo(1800, 0);
    // 70 % de 1.800 = 1.260 € > tope máx. 1.225 € → se aplica el tope
    expect(r.brutoPrimeros180).toBeCloseTo(1260, 2);
    expect(r.cuantiaPrimeros180).toBeCloseTo(1225.0, 2);
    // 60 % de 1.800 = 1.080 €, dentro del rango [560, 1225] → sin tope
    expect(r.brutoDesde181).toBeCloseTo(1080, 2);
    expect(r.cuantiaDesde181).toBeCloseTo(1080.0, 2);
  });
});

describe('aplicación de topes (art. 270.3 LGSS)', () => {
  it('base baja → se eleva al tope mínimo (sin hijos, 560 €)', () => {
    // 70 % de 700 = 490 € < mín. 560 € → sube a 560; 60 % = 420 € → sube a 560
    const r = calcularParo(700, 0);
    expect(r.cuantiaPrimeros180).toBeCloseTo(560.0, 2);
    expect(r.cuantiaDesde181).toBeCloseTo(560.0, 2);
  });

  it('base alta con hijos → tope máximo de su categoría', () => {
    // 2+ hijos: 70 % de 3.000 = 2.100 € > máx. 1.575 € → 1.575; 60 % = 1.800 → 1.575
    const r = calcularParo(3000, 2);
    expect(r.categoria).toBe(2);
    expect(r.cuantiaPrimeros180).toBeCloseTo(1575.0, 2);
    expect(r.cuantiaDesde181).toBeCloseTo(1575.0, 2);
  });

  it('base intermedia sin tope → 70 % y 60 % exactos', () => {
    // 1.500 €: 70 % = 1.050 € (≤ 1.225), 60 % = 900 € (≥ 560) → ambos sin tope
    const r = calcularParo(1500, 0);
    expect(r.cuantiaPrimeros180).toBeCloseTo(1050.0, 2);
    expect(r.cuantiaDesde181).toBeCloseTo(900.0, 2);
  });

  it('el tope máximo con 1 hijo (1.400 €) es mayor que sin hijos', () => {
    const sinHijos = calcularParo(2500, 0).cuantiaPrimeros180; // → 1.225
    const unHijo = calcularParo(2500, 1).cuantiaPrimeros180; // → 1.400
    expect(sinHijos).toBeCloseTo(1225.0, 2);
    expect(unHijo).toBeCloseTo(1400.0, 2);
  });
});

describe('entradas inválidas', () => {
  it('rechaza base reguladora ≤ 0, NaN e Infinity', () => {
    expect(() => calcularParo(0, 0)).toThrow(RangeError);
    expect(() => calcularParo(-100, 0)).toThrow(RangeError);
    expect(() => calcularParo(NaN, 0)).toThrow(RangeError);
    expect(() => calcularParo(Infinity, 0)).toThrow(RangeError);
  });

  it('rechaza coeficiente de parcialidad fuera de (0, 1]', () => {
    expect(() => calcularParo(1000, 0, 0)).toThrow(RangeError);
    expect(() => calcularParo(1000, 0, -0.5)).toThrow(RangeError);
    expect(() => calcularParo(1000, 0, 1.2)).toThrow(RangeError);
    expect(() => calcularParo(1000, 0, NaN)).toThrow(RangeError);
  });
});

describe('desempleo a tiempo parcial: proración de los topes (art. 270.3, tercer párr. LGSS)', () => {
  it('con coeficiente 1 (jornada completa) el resultado no cambia respecto a omitirlo (regresión)', () => {
    // Garantiza que el nuevo parámetro es aditivo: mismo cálculo que antes de existir.
    const completa = calcularParo(1800, 0);
    const explicita = calcularParo(1800, 0, 1);
    expect(explicita.cuantiaPrimeros180).toBeCloseTo(completa.cuantiaPrimeros180, 6);
    expect(explicita.cuantiaDesde181).toBeCloseTo(completa.cuantiaDesde181, 6);
    expect(explicita.topeMin).toBeCloseTo(560.0, 2);
    expect(explicita.topeMax).toBeCloseTo(1225.0, 2);
  });

  it('media jornada (50%): los topes sin hijos bajan a 280 € / 612,50 €', () => {
    // Topes de jornada completa (SEPE 2026): 560 € y 1.225 €. Prorrateados al 50%.
    const r = calcularParo(1000, 0, 0.5);
    expect(r.topeMin).toBeCloseTo(280.0, 2);
    expect(r.topeMax).toBeCloseTo(612.5, 2);
    expect(r.coeficienteParcialidad).toBe(0.5);
  });

  it('ejemplo resuelto de la página (Ana, base 700 €, media jornada, sin hijos)', () => {
    // Punto clave del contenido: como los topes se prorratean al 50 % (mín. 280 €),
    // la cuantía del 70 % (490 €) NO se eleva al mínimo de jornada completa (560 €).
    // Ana cobra 490 € — MENOS que el "mínimo del paro" que citan las fuentes que
    // olvidan la proración. Ese es el error que la página corrige.
    const r = calcularParo(700, 0, 0.5);
    // 70 % de 700 = 490 €; rango prorrateado [280, 612,50] → sin tope → 490 €.
    expect(r.brutoPrimeros180).toBeCloseTo(490.0, 2);
    expect(r.cuantiaPrimeros180).toBeCloseTo(490.0, 2);
    // 60 % de 700 = 420 €; dentro del rango → 420 €.
    expect(r.brutoDesde181).toBeCloseTo(420.0, 2);
    expect(r.cuantiaDesde181).toBeCloseTo(420.0, 2);
  });

  it('contraste: SIN prorratear los topes (bug frecuente) el resultado sería 560 €', () => {
    // Documenta explícitamente el error que combatimos: usar los topes de jornada
    // completa eleva indebidamente 490 € al mínimo de 560 €.
    const naive = calcularParo(700, 0); // coef 1 → mín. 560
    expect(naive.cuantiaPrimeros180).toBeCloseTo(560.0, 2);
    const correcto = calcularParo(700, 0, 0.5);
    expect(correcto.cuantiaPrimeros180).toBeCloseTo(490.0, 2);
    expect(correcto.cuantiaPrimeros180).toBeLessThan(naive.cuantiaPrimeros180);
  });

  it('media jornada con base alta: el tope máximo prorrateado (612,50 €) recorta', () => {
    // 70 % de 1.000 = 700 € > máx. prorrateado 612,50 € → se aplica el tope.
    const r = calcularParo(1000, 0, 0.5);
    expect(r.brutoPrimeros180).toBeCloseTo(700.0, 2);
    expect(r.cuantiaPrimeros180).toBeCloseTo(612.5, 2);
  });
});

/**
 * Duración y total (añadido el 31-oct-2026). Escala del art. 269.1 LGSS releída ese día en el
 * texto consolidado del BOE (https://www.boe.es/buscar/act.php?id=BOE-A-2015-11724#a269):
 * «Desde 360 hasta 539 → 120 … Desde 1.980 hasta 2.159 → 660 · Desde 2.160 → 720».
 */
describe('duración de la prestación (art. 269.1 LGSS, BOE leído el 31-oct-2026)', () => {
  it('la escala es la de la ley, tramo a tramo', () => {
    expect(ESCALA_DURACION).toEqual([
      [360, 120], [540, 180], [720, 240], [900, 300], [1080, 360], [1260, 420],
      [1440, 480], [1620, 540], [1800, 600], [1980, 660], [2160, 720],
    ]);
    expect(DIAS_COTIZADOS_MINIMOS).toBe(360);
  });

  // [días cotizados, días de prestación]: bordes de cada tramo de la tabla del BOE
  const casos: Array<[number, number]> = [
    [0, 0], [359, 0], [360, 120], [539, 120], [540, 180], [719, 180], [720, 240],
    [899, 240], [900, 300], [1079, 300], [1080, 360], [1259, 360], [1260, 420],
    [1439, 420], [1440, 480], [1619, 480], [1620, 540], [1799, 540], [1800, 600],
    [1979, 600], [1980, 660], [2159, 660], [2160, 720], [2190, 720],
  ];
  it.each(casos)('%s días cotizados → %s días de paro', (cotizados, prestacion) => {
    expect(duracionPrestacion(cotizados)).toBe(prestacion);
  });

  it('años trabajados a jornada completa (365 días cotizados por año)', () => {
    expect(duracionPrestacion(365)).toBe(120); // 1 año → 4 meses
    expect(duracionPrestacion(730)).toBe(240); // 2 años → 8 meses
    expect(duracionPrestacion(1095)).toBe(360); // 3 años → 12 meses
    expect(duracionPrestacion(1825)).toBe(600); // 5 años → 20 meses
  });

  it('rechaza días negativos', () => {
    expect(() => duracionPrestacion(-1)).toThrow(RangeError);
  });
});

describe('total de la prestación (art. 269.1 + 270.2-3 LGSS, IPREM 2026)', () => {
  it('ejemplo de la página: base 1.800 €, sin hijos, 1.300 días → 420 días, 15.990 €', () => {
    // 6 meses × 1.225 € (70 % = 1.260, topado a 175 % IPREM × 7/6) + 8 meses × 1.080 € (60 %)
    const t = totalPrestacion(1800, 0, 1300);
    expect(t.diasPrestacion).toBe(420);
    expect(t.mesesAl70).toBe(6);
    expect(t.mesesAl60).toBe(8);
    expect(t.total).toBeCloseTo(15990, 2);
  });

  it('prestación de 120 días: solo hay tramo del 70 %', () => {
    const t = totalPrestacion(1200, 0, 400); // 70 % de 1.200 = 840 €, dentro de 560-1.225
    expect(t.mesesAl70).toBe(4);
    expect(t.mesesAl60).toBe(0);
    expect(t.total).toBeCloseTo(3360, 2);
  });

  it('sin 360 días cotizados el total es 0', () => {
    expect(totalPrestacion(2000, 1, 300).total).toBe(0);
  });

  it('máximo legal con 2 o más hijos: 6 × 1.575 + 18 × 1.575 = 37.800 €', () => {
    expect(totalPrestacion(4000, 2, 2190).total).toBeCloseTo(37800, 2);
  });
});

/**
 * Neto del paro (leído el 31-oct-2026):
 *   - Art. 273.1 LGSS (BOE-A-2015-11724, https://www.boe.es/buscar/act.php?id=BOE-A-2015-11724#a273):
 *     el SEPE descuenta de la prestación la aportación del trabajador, «incluidos los supuestos a
 *     que hace referencia el artículo 270.3» (los topes).
 *   - Orden PJC/297/2026 (BOE-A-2026-7296, https://www.boe.es/buscar/act.php?id=BOE-A-2026-7296):
 *     art. 8.1, la base de cotización es la base reguladora; art. 4.a, 4,70 % del trabajador por
 *     contingencias comunes; art. 16, 0,15 % del trabajador por el mecanismo de equidad
 *     intergeneracional; art. 3, base máxima 5.101,20 €.
 *   - SEPE, «Cuantías anuales» (https://www.sepe.es/HomeSepe/prestaciones-desempleo/Cuantias-anuales.html):
 *     «Cotización a la Seguridad Social: 4,85 %».
 */
describe('paro neto (art. 273.1 LGSS + Orden PJC/297/2026 arts. 4, 8.1 y 16)', () => {
  it('el tipo del trabajador es el 4,85 % que publica el SEPE', () => {
    expect(TIPO_COTIZACION_TRABAJADOR_PARO).toBeCloseTo(0.0485, 10);
  });

  it('ejemplo de la página: base 1.800 €, sin hijos → descuento 87,30 €, neto 1.137,70 € y 992,70 €', () => {
    const n = netoParo(1800, 0);
    expect(n.descuento).toBeCloseTo(87.3, 2);
    expect(n.netoPrimeros180).toBeCloseTo(1137.7, 2); // 1.225 (tope) − 87,30
    expect(n.netoDesde181).toBeCloseTo(992.7, 2); // 1.080 (60 %) − 87,30
  });

  it('total neto del ejemplo: 15.990 € − 14 meses × 87,30 € = 14.767,80 €', () => {
    expect(totalPrestacion(1800, 0, 1300).totalNeto).toBeCloseTo(14767.8, 2);
  });

  it('con el tope, una base más alta deja MENOS neto (el descuento va sobre la base)', () => {
    // Sin hijos el 70 % toca el tope de 1.225 € con una base de 1.750 €.
    expect(netoParo(1750, 0).netoPrimeros180).toBeCloseTo(1225 - 1750 * 0.0485, 2); // 1.140,125
    expect(netoParo(3000, 0).netoPrimeros180).toBeCloseTo(1225 - 145.5, 2); // 1.079,50
    expect(netoParo(3000, 0).netoPrimeros180).toBeLessThan(netoParo(1750, 0).netoPrimeros180);
  });

  it('con la base máxima (5.101,20 €) el neto en el tope es 977,59 € sin hijos, 1.152,59 € con uno y 1.327,59 € con dos', () => {
    expect(descuentoCotizacion(5101.2)).toBeCloseTo(247.4082, 4);
    expect(netoParo(5101.2, 0).netoPrimeros180).toBeCloseTo(977.59, 2);
    expect(netoParo(5101.2, 1).netoPrimeros180).toBeCloseTo(1152.59, 2);
    expect(netoParo(5101.2, 2).netoPrimeros180).toBeCloseTo(1327.59, 2);
  });

  it('el descuento no pasa de la base máxima aunque se introduzca una base mayor', () => {
    expect(descuentoCotizacion(8000)).toBeCloseTo(descuentoCotizacion(5101.2), 10);
  });

  it('el descuento no cambia la cuantía bruta (calcularParo sigue igual)', () => {
    expect(calcularParo(1800, 0).cuantiaPrimeros180).toBeCloseTo(1225, 2);
    expect(totalPrestacion(1800, 0, 1300).total).toBeCloseTo(15990, 2);
  });
});
