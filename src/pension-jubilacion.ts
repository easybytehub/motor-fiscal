/**
 * Pensión de jubilación contributiva (Seguridad Social) 2026: estimación de la
 * cuantía mensual a partir de la base reguladora y los años cotizados.
 *
 * Fuente oficial:
 *   - Art. 210.1 del texto refundido de la Ley General de la Seguridad Social
 *     (Real Decreto Legislativo 8/2015, de 30 de octubre, BOE-A-2015-11724):
 *     la cuantía se obtiene aplicando a la base reguladora un porcentaje que es
 *     del 50 % por los primeros 15 años cotizados y sube por cada mes adicional,
 *     sin superar el 100 %.
 *   - Disposición Transitoria Novena de la LGSS (aplicación paulatina del
 *     porcentaje). Escala VIGENTE para jubilaciones causadas en 2026:
 *       · Primeros 15 años (180 meses): 50 %.
 *       · Cada uno de los 49 meses siguientes (meses 1-49): +0,21 %.
 *       · Cada uno de los 209 meses siguientes (meses 50-258): +0,19 %.
 *       · Total 258 meses adicionales → 100 % a los 36 años y 6 meses.
 *     (Para 2027 la escala definitiva del art. 210 es +0,19 % los primeros 248
 *     meses y +0,18 % los 16 siguientes → 100 % a los 37 años.)
 *   - Límite máximo de las pensiones públicas 2026: 3.359,60 €/mes (14 pagas),
 *     47.034,40 €/año. Real Decreto 241/2026, de 25 de marzo (BOE-A-2026-6977),
 *     sobre limitación de la cuantía inicial y revalorización de las pensiones
 *     públicas para el ejercicio 2026.
 *
 * Alcance (simplificaciones documentadas en la página, NO bugs): esta función
 * estima la CUANTÍA. Toma la base media mensual introducida como base reguladora
 * ya calculada; NO aplica el divisor exacto del periodo de cómputo ni la
 * actualización por IPC de las bases históricas (el cálculo real de la base
 * reguladora se rige por el art. 209 y la DT 40.ª LGSS, con el sistema dual de
 * cómputo 2026). Tampoco modela coeficientes de jubilación anticipada/demorada,
 * complementos ni lagunas de cotización.
 *
 * Regla del repo: toda modificación de este archivo exige
 * actualizar tests/pension-jubilacion.test.ts con la fuente oficial citada.
 */

/** Porcentaje de la base reguladora garantizado por los primeros 15 años (art. 210.1.a). */
export const PORCENTAJE_MINIMO = 50;

/** Meses correspondientes a los 15 años mínimos de cotización (15 × 12). */
export const MESES_MINIMOS = 15 * 12; // 180

/**
 * Escala transitoria 2026 (DT Novena LGSS) del incremento por mes adicional
 * cotizado a partir del mes 181, en orden de aplicación.
 * 49 × 0,21 % + 209 × 0,19 % = 10,29 + 39,71 = 50 puntos → 100 % a los 36a 6m.
 */
export const ESCALA_2026: ReadonlyArray<{ meses: number; incremento: number }> = [
  { meses: 49, incremento: 0.21 },
  { meses: 209, incremento: 0.19 },
];

/** Límite máximo de la pensión pública 2026, mensual en EUR (14 pagas). RD 241/2026. */
export const PENSION_MAXIMA_MENSUAL_2026 = 3359.6;

/** Número de pagas anuales de la pensión (12 ordinarias + 2 extraordinarias). */
export const PAGAS_ANUALES = 14;

/**
 * Porcentaje aplicable a la base reguladora según los años cotizados, con la
 * escala transitoria vigente para jubilaciones causadas en 2026 (DT Novena LGSS).
 *
 * Devuelve 0 por debajo de los 15 años (no da derecho a pensión contributiva),
 * 50 % justo a los 15 años y hasta un máximo del 100 % (a los 36 años y 6 meses).
 *
 * @param anios Años cotizados (admite decimales; se convierten a meses).
 */
export function porcentajePorAnios(anios: number): number {
  if (!isFinite(anios) || anios < 0) {
    throw new RangeError('Los años cotizados deben ser un número ≥ 0');
  }
  const mesesCotizados = anios * 12;
  if (mesesCotizados < MESES_MINIMOS) {
    return 0;
  }
  let porcentaje = PORCENTAJE_MINIMO;
  let mesesAdicionales = mesesCotizados - MESES_MINIMOS;
  for (const tramo of ESCALA_2026) {
    if (mesesAdicionales <= 0) break;
    const mesesEnTramo = Math.min(mesesAdicionales, tramo.meses);
    porcentaje += mesesEnTramo * tramo.incremento;
    mesesAdicionales -= mesesEnTramo;
  }
  return Math.min(porcentaje, 100);
}

export interface ResultadoPension {
  /** Base reguladora mensual utilizada, en EUR. */
  baseReguladora: number;
  /** Porcentaje aplicado a la base reguladora según años cotizados (0-100). */
  porcentaje: number;
  /** Pensión mensual antes de aplicar el tope máximo, en EUR. */
  pensionSinTope: number;
  /** true si el tope máximo mensual limita la pensión. */
  topeAplicado: boolean;
  /** Pensión mensual estimada (con tope aplicado), en EUR. */
  pensionMensual: number;
  /** Pensión anual estimada (14 pagas), en EUR. */
  pensionAnual: number;
}

/**
 * Estima la pensión de jubilación mensual y anual (art. 210 + DT Novena LGSS),
 * limitada al tope máximo de las pensiones públicas de 2026 (RD 241/2026).
 *
 * @param baseReguladoraMensual Base reguladora mensual en EUR (> 0). La página
 *   usa la base de cotización media mensual introducida por el usuario.
 * @param anios Años cotizados (≥ 0).
 */
export function calcularPension(baseReguladoraMensual: number, anios: number): ResultadoPension {
  if (!isFinite(baseReguladoraMensual) || baseReguladoraMensual <= 0) {
    throw new RangeError('La base reguladora mensual debe ser un número > 0');
  }
  const porcentaje = porcentajePorAnios(anios);
  const pensionSinTope = baseReguladoraMensual * (porcentaje / 100);
  const topeAplicado = pensionSinTope > PENSION_MAXIMA_MENSUAL_2026;
  const pensionMensual = Math.min(pensionSinTope, PENSION_MAXIMA_MENSUAL_2026);
  return {
    baseReguladora: baseReguladoraMensual,
    porcentaje,
    pensionSinTope,
    topeAplicado,
    pensionMensual,
    pensionAnual: pensionMensual * PAGAS_ANUALES,
  };
}
