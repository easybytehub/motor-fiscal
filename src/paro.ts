/**
 * Prestación contributiva por desempleo (SEPE) 2026: cuantía mensual por tramos.
 *
 * Fuente oficial:
 *   - Art. 270 del texto refundido de la Ley General de la Seguridad Social
 *     (Real Decreto Legislativo 8/2015, de 30 de octubre, BOE-A-2015-11724):
 *       · Base reguladora (270.1) = promedio de la base por la que se cotizó por
 *         desempleo (la de contingencias profesionales) los últimos 180 días,
 *         excluidas las horas extraordinarias.
 *       · Cuantía (270.2) = 70 % de la base reguladora los primeros 180 días y 60 %
 *         a partir del día 181.
 *       · Tope MÁXIMO: 175 % del IPREM (sin hijos), 200 % (un hijo) o 225 %
 *         (dos o más hijos a cargo).
 *       · Tope MÍNIMO: 80 % del IPREM (sin hijos) o 107 % (con hijos a cargo).
 *       · A estos efectos se toma el "IPREM mensual vigente en el momento del
 *         nacimiento del derecho, INCREMENTADO EN UNA SEXTA PARTE" → factor 7/6
 *         (el IPREM mensual con la prorrata de dos pagas extra: 600 × 14/12 = 700).
 *       · Desempleo por pérdida de un empleo a TIEMPO PARCIAL (art. 270.3, tercer
 *         párrafo): los importes máximo y mínimo se determinan "en función del
 *         promedio de las horas trabajadas durante el período de los últimos 180
 *         días..., ponderándose tal promedio en relación con los días en cada
 *         empleo a tiempo parcial o completo". Es decir, los TOPES se prorratean
 *         por el coeficiente de parcialidad (media jornada → topes al 50 %). La
 *         base reguladora del apartado 1 ya viene reducida por la parcialidad; el
 *         coeficiente NO se le aplica otra vez, solo a los topes.
 *   - IPREM 2026: 600 €/mes (congelado desde 2023, Ley 31/2022 de PGE 2023
 *     prorrogada por falta de nuevos Presupuestos).
 *   - Verificación cruzada de las cuantías: SEPE, "Cuantías anuales" (prestación
 *     contributiva 2026): máx. sin hijos 1.225,00 €, 1 hijo 1.400,00 €, 2+ hijos
 *     1.575,00 €; mín. sin hijos 560,00 €, con hijos 749,00 €.
 *
 *   - Art. 269.1 LGSS (escala de duración, releída en el BOE consolidado el
 *     31-oct-2026): de 360 a 539 días cotizados en los 6 años anteriores, 120
 *     días de prestación; cada tramo de 180 días cotizados suma 60 días; desde
 *     2.160 días cotizados, 720 (el máximo). Con menos de 360, no hay derecho a
 *     la prestación contributiva.
 *
 * Numeración (31-oct-2026): hasta hoy estos comentarios citaban los topes como
 * «270.4». En el texto consolidado los porcentajes son el 270.2 y los topes el
 * 270.3; el 270.4 es el de dos contratos a tiempo parcial. Las cifras no cambian.
 *
 *   - Neto (31-oct-2026, leído ese día): el SEPE ingresa la cotización y descuenta
 *     de la prestación la aportación del trabajador, también cuando la cuantía está
 *     en el tope (art. 273.1 LGSS: «incluidos los supuestos a que hace referencia el
 *     artículo 270.3»). La base de esa cotización es la base reguladora (Orden
 *     PJC/297/2026, BOE-A-2026-7296, art. 8.1) y la aportación del trabajador es el
 *     4,70 % de contingencias comunes (art. 4.a) más el 0,15 % del mecanismo de
 *     equidad intergeneracional (art. 16): 4,85 %, la cifra que da el SEPE en «Cuantías
 *     anuales» (https://www.sepe.es/HomeSepe/prestaciones-desempleo/Cuantias-anuales.html).
 *     Tras la extinción del contrato no se cotiza por desempleo, FOGASA ni formación
 *     (art. 273.3), así que no hay más descuentos de Seguridad Social.
 *
 * Alcance (simplificaciones documentadas en la página, NO bugs): usa la base de
 * cotización mensual introducida como base reguladora; cuenta los meses de 30
 * días (la prestación se reconoce en días: 120 días = 4 meses); no aplica la
 * retención de IRPF (depende de toda la situación fiscal del año); y no aplica
 * aparte el suelo de la base mínima del grupo (art. 8.1): una base de jornada
 * completa ya está por encima, y a tiempo parcial la mínima es por horas.
 *
 * Regla del repo: toda modificación de este archivo exige
 * actualizar tests/paro.test.ts con la fuente oficial citada.
 */

import { BASE_MAX_MENSUAL } from './nomina.js';

/** Categoría de hijos a cargo a efectos de los topes del art. 270.3 LGSS. */
export type CategoriaHijos = 0 | 1 | 2; // 0 = sin hijos, 1 = un hijo, 2 = dos o más

/** IPREM mensual 2026, en EUR (Ley 31/2022 de PGE 2023, prorrogada). */
export const IPREM_MENSUAL_2026 = 600;

/**
 * "Incrementado en una sexta parte" (art. 270.3 LGSS): el IPREM mensual con la
 * prorrata de dos pagas extraordinarias. 7/6 = 14/12 → 600 € × 7/6 = 700 €.
 */
export const FACTOR_SEXTA_PARTE = 7 / 6;

/** Porcentaje de la base reguladora durante los primeros 180 días (art. 270.2). */
export const PORCENTAJE_PRIMEROS_180 = 0.7;

/** Porcentaje de la base reguladora a partir del día 181 (art. 270.2). */
export const PORCENTAJE_DESDE_181 = 0.6;

export interface TopePorcentual {
  /** Fracción del IPREM (incrementado en 1/6) para el tope mínimo. */
  min: number;
  /** Fracción del IPREM (incrementado en 1/6) para el tope máximo. */
  max: number;
  /** Etiqueta descriptiva mostrada en el desglose. */
  label: string;
}

/**
 * Topes del art. 270.3 LGSS como fracción del IPREM (antes de aplicar el
 * factor 7/6). El mínimo es 80 % sin hijos y 107 % con hijos; el máximo es
 * 175 % / 200 % / 225 % según 0 / 1 / 2+ hijos a cargo.
 */
export const TOPES_PORCENTAJE: Record<CategoriaHijos, TopePorcentual> = {
  0: { min: 0.8, max: 1.75, label: 'Sin hijos (mín. 80% / máx. 175% IPREM + 1/6)' },
  1: { min: 1.07, max: 2.0, label: '1 hijo (mín. 107% / máx. 200% IPREM + 1/6)' },
  2: { min: 1.07, max: 2.25, label: '2 o más hijos (mín. 107% / máx. 225% IPREM + 1/6)' },
};

/** Normaliza un número de hijos a la categoría de topes (0, 1 o "2 o más"). */
export function categoriaHijos(hijos: number): CategoriaHijos {
  if (!isFinite(hijos) || hijos < 0) {
    throw new RangeError('El número de hijos a cargo debe ser un número ≥ 0');
  }
  const n = Math.floor(hijos);
  return (n >= 2 ? 2 : n) as CategoriaHijos;
}

export interface TopesMensuales {
  categoria: CategoriaHijos;
  /** Tope mínimo mensual en EUR. */
  min: number;
  /** Tope máximo mensual en EUR. */
  max: number;
  label: string;
}

/** Topes mínimo y máximo mensuales (EUR) para una categoría de hijos. */
export function topesMensuales(hijos: number): TopesMensuales {
  const categoria = categoriaHijos(hijos);
  const t = TOPES_PORCENTAJE[categoria];
  const iprem = IPREM_MENSUAL_2026 * FACTOR_SEXTA_PARTE;
  return { categoria, min: iprem * t.min, max: iprem * t.max, label: t.label };
}

export interface ResultadoParo {
  /** Base reguladora mensual utilizada, en EUR. */
  baseReguladora: number;
  categoria: CategoriaHijos;
  /** Coeficiente de parcialidad aplicado a los topes (1 = jornada completa). */
  coeficienteParcialidad: number;
  /** 70 % de la base reguladora, SIN aplicar topes. */
  brutoPrimeros180: number;
  /** 60 % de la base reguladora, SIN aplicar topes. */
  brutoDesde181: number;
  /** Cuantía mensual meses 1-6, con topes aplicados. */
  cuantiaPrimeros180: number;
  /** Cuantía mensual desde el mes 7, con topes aplicados. */
  cuantiaDesde181: number;
  /** Tope mínimo mensual EFECTIVO (ya prorrateado por la parcialidad), en EUR. */
  topeMin: number;
  /** Tope máximo mensual EFECTIVO (ya prorrateado por la parcialidad), en EUR. */
  topeMax: number;
  topeLabel: string;
}

function aplicarTopes(cuantia: number, min: number, max: number): number {
  return Math.min(Math.max(cuantia, min), max);
}

/**
 * Calcula la prestación contributiva por desempleo mensual (art. 270 LGSS).
 *
 * @param baseReguladoraMensual Base reguladora mensual en EUR (> 0). La página
 *   usa la base de cotización mensual introducida por el usuario. Para un empleo
 *   a tiempo parcial es la base REAL de esa jornada (ya reducida): no se vuelve a
 *   prorratear.
 * @param hijos Número de hijos a cargo (se normaliza a 0, 1 o "2 o más").
 * @param coeficienteParcialidad Promedio de jornada de los últimos 180 días
 *   respecto a la completa, en (0, 1]. 1 = jornada completa (por defecto);
 *   0,5 = media jornada. Solo prorratea los TOPES (art. 270.3, tercer párrafo,
 *   LGSS), no la base reguladora.
 */
export function calcularParo(
  baseReguladoraMensual: number,
  hijos: number,
  coeficienteParcialidad = 1,
): ResultadoParo {
  if (!isFinite(baseReguladoraMensual) || baseReguladoraMensual <= 0) {
    throw new RangeError('La base reguladora mensual debe ser un número > 0');
  }
  if (
    !isFinite(coeficienteParcialidad) ||
    coeficienteParcialidad <= 0 ||
    coeficienteParcialidad > 1
  ) {
    throw new RangeError('El coeficiente de parcialidad debe ser un número en (0, 1]');
  }
  const topes = topesMensuales(hijos);
  // Art. 270.3 LGSS (tercer párrafo): en el desempleo por pérdida de un empleo a
  // tiempo parcial, los importes máximo y mínimo se ponderan por el promedio de
  // horas trabajadas respecto a la jornada completa. Con jornada completa el
  // coeficiente es 1 y el resultado es idéntico al de antes de introducir este
  // parámetro (regresión cubierta en tests/paro.test.ts).
  const topeMin = topes.min * coeficienteParcialidad;
  const topeMax = topes.max * coeficienteParcialidad;

  const brutoPrimeros180 = baseReguladoraMensual * PORCENTAJE_PRIMEROS_180;
  const brutoDesde181 = baseReguladoraMensual * PORCENTAJE_DESDE_181;

  return {
    baseReguladora: baseReguladoraMensual,
    categoria: topes.categoria,
    coeficienteParcialidad,
    brutoPrimeros180,
    brutoDesde181,
    cuantiaPrimeros180: aplicarTopes(brutoPrimeros180, topeMin, topeMax),
    cuantiaDesde181: aplicarTopes(brutoDesde181, topeMin, topeMax),
    topeMin,
    topeMax,
    topeLabel: topes.label,
  };
}

/**
 * Escala del art. 269.1 LGSS: [desde días cotizados, días de prestación].
 * Leída en el BOE consolidado (BOE-A-2015-11724) el 31-oct-2026. Se escribe
 * entera y no como fórmula: es la tabla de la ley, y el Gobierno puede cambiar
 * un tramo sin cambiar los demás (párrafo final del 269.1).
 */
export const ESCALA_DURACION: ReadonlyArray<readonly [number, number]> = [
  [360, 120],
  [540, 180],
  [720, 240],
  [900, 300],
  [1080, 360],
  [1260, 420],
  [1440, 480],
  [1620, 540],
  [1800, 600],
  [1980, 660],
  [2160, 720],
];

/** Días cotizados mínimos para tener derecho a la prestación contributiva (art. 269.1). */
export const DIAS_COTIZADOS_MINIMOS = 360;

/**
 * Días de prestación que dan los días cotizados en los últimos 6 años (art. 269.1
 * LGSS). Devuelve 0 por debajo de 360: no hay prestación contributiva.
 */
export function duracionPrestacion(diasCotizados: number): number {
  if (!isFinite(diasCotizados) || diasCotizados < 0) {
    throw new RangeError('Los días cotizados deben ser un número ≥ 0');
  }
  let dias = 0;
  for (const [desde, prestacion] of ESCALA_DURACION) {
    if (diasCotizados >= desde) dias = prestacion;
  }
  return dias;
}

export interface TotalParo {
  /** Días de prestación (art. 269.1). */
  diasPrestacion: number;
  /** Los mismos días en meses de 30. */
  meses: number;
  /** Meses cobrados al 70 % (como mucho 6). */
  mesesAl70: number;
  /** Meses cobrados al 60 % (desde el día 181). */
  mesesAl60: number;
  /** Total bruto de toda la prestación, con topes, en EUR. */
  total: number;
  /** Total neto: el bruto menos el 4,85 % de la base de cada mes (art. 273.1). */
  totalNeto: number;
}

/**
 * Total bruto de la prestación entera: los primeros 180 días a la cuantía del 70 %
 * y el resto a la del 60 %, las dos ya con topes. Meses de 30 días.
 */
export function totalPrestacion(
  baseReguladoraMensual: number,
  hijos: number,
  diasCotizados: number,
  coeficienteParcialidad = 1,
): TotalParo {
  const r = calcularParo(baseReguladoraMensual, hijos, coeficienteParcialidad);
  const diasPrestacion = duracionPrestacion(diasCotizados);
  const dias70 = Math.min(diasPrestacion, 180);
  const dias60 = Math.max(diasPrestacion - 180, 0);
  const mesesAl70 = dias70 / 30;
  const mesesAl60 = dias60 / 30;
  const total = r.cuantiaPrimeros180 * mesesAl70 + r.cuantiaDesde181 * mesesAl60;
  return {
    diasPrestacion,
    meses: diasPrestacion / 30,
    mesesAl70,
    mesesAl60,
    total,
    totalNeto: total - descuentoCotizacion(baseReguladoraMensual) * (mesesAl70 + mesesAl60),
  };
}

/**
 * Aportación del trabajador que el SEPE descuenta de la prestación (art. 273.1 LGSS):
 * 4,70 % de contingencias comunes + 0,15 % del mecanismo de equidad intergeneracional
 * (Orden PJC/297/2026). El SEPE publica la suma, 4,85 %, en «Cuantías anuales».
 */
export const TIPO_COTIZACION_TRABAJADOR_PARO = 0.047 + 0.0015;

/**
 * Descuento mensual de cotización: 4,85 % de la base reguladora (Orden PJC/297/2026,
 * art. 8.1), que como base de cotización no pasa de la máxima de 2026 (5.101,20 €).
 * Se calcula sobre la BASE y no sobre la cuantía: con el tope, la prestación no sube
 * con la base y el descuento sí, así que una base más alta deja menos neto.
 */
export function descuentoCotizacion(baseReguladoraMensual: number): number {
  return Math.min(baseReguladoraMensual, BASE_MAX_MENSUAL) * TIPO_COTIZACION_TRABAJADOR_PARO;
}

export interface NetoParo {
  /** Descuento mensual de cotización (4,85 % de la base), en EUR. */
  descuento: number;
  /** Lo que llega al banco los primeros 180 días, antes de IRPF. */
  netoPrimeros180: number;
  /** Lo que llega al banco desde el día 181, antes de IRPF. */
  netoDesde181: number;
}

/** Paro neto mensual (antes de la retención de IRPF): cuantía con topes menos la cotización. */
export function netoParo(
  baseReguladoraMensual: number,
  hijos: number,
  coeficienteParcialidad = 1,
): NetoParo {
  const r = calcularParo(baseReguladoraMensual, hijos, coeficienteParcialidad);
  const descuento = descuentoCotizacion(baseReguladoraMensual);
  return {
    descuento,
    netoPrimeros180: r.cuantiaPrimeros180 - descuento,
    netoDesde181: r.cuantiaDesde181 - descuento,
  };
}
