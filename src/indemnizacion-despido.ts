/**
 * Indemnización por despido — estimación EN BRUTO de la indemnización legal
 * mínima según el tipo de despido, en función del salario bruto anual y la
 * antigüedad.
 *
 * NO son cifras variables de una orden anual: los días por año y los topes de
 * mensualidades están fijados en el Estatuto de los Trabajadores (Real Decreto
 * Legislativo 2/2015, de 23 de octubre, BOE-A-2015-11430), texto consolidado:
 *   - Art. 56.1 — DESPIDO IMPROCEDENTE: indemnización equivalente a "treinta y
 *     tres días de salario por año de servicio, prorrateándose por meses los
 *     periodos de tiempo inferiores a un año, hasta un máximo de veinticuatro
 *     mensualidades" (redacción vigente tras la reforma de 2012).
 *   - Art. 53.1.b — DESPIDO OBJETIVO/PROCEDENTE (causas económicas, técnicas,
 *     organizativas o de producción, art. 52): indemnización de "veinte días
 *     por año de servicio, prorrateándose por meses los periodos de tiempo
 *     inferiores a un año y con un máximo de doce mensualidades".
 *
 * Convenciones documentadas en la página (se preservan, no se "mejoran" sin
 * criterio del mantenedor, porque cambiarían el comportamiento visible):
 *   - Salario diario (módulo salarial) = salario bruto anual / 365 (día natural;
 *     el bruto anual ya incorpora la prorrata de pagas extra).
 *   - Mensualidad (unidad del tope) = salario bruto anual / 12.
 *   - Prorrateo por meses: la antigüedad se recibe ya en años (decimal); la
 *     indemnización es lineal salario_diario · días_por_año · antigüedad. La
 *     conversión de meses a fracción de año la hace quien introduce el dato.
 *   - Régimen transitorio de contratos anteriores al 12-feb-2012 (45 días/año
 *     hasta esa fecha, tope 42 mensualidades para ese tramo; RD-ley 3/2012 y
 *     Ley 3/2012, BOE-A-2012-2076): NO se modela — la página asume antigüedad
 *     íntegra posterior a 2012 y lo advierte. Si la antigüedad es anterior, el
 *     resultado es una aproximación a la baja.
 * El resultado es BRUTO. Sobre la exención de IRPF (art. 7.e Ley 35/2006, límite
 * 180.000 €) informa la página, no este cálculo.
 *
 * Regla del repo: toda modificación de este archivo exige
 * actualizar tests/indemnizacion-despido.test.ts con la fuente oficial citada.
 */

/** Días naturales del año, base del salario diario. */
export const DIAS_ANIO = 365;
/** Meses del año, base de la "mensualidad" (unidad del tope legal). */
export const MESES_ANIO = 12;

export type TipoDespido = 'improcedente' | 'objetivo';

export interface ParametrosDespido {
  /** Días de salario indemnizables por año de servicio. */
  diasPorAnio: number;
  /** Tope máximo de la indemnización, en nº de mensualidades. */
  topeMensualidades: number;
}

/**
 * Parámetros legales por tipo de despido (ET, texto consolidado):
 *   - improcedente: art. 56.1 → 33 días/año, tope 24 mensualidades.
 *   - objetivo/procedente: art. 53.1.b → 20 días/año, tope 12 mensualidades.
 */
export const PARAMETROS_DESPIDO: Record<TipoDespido, ParametrosDespido> = {
  improcedente: { diasPorAnio: 33, topeMensualidades: 24 },
  objetivo: { diasPorAnio: 20, topeMensualidades: 12 },
};

export interface IndemnizacionInput {
  /** Salario bruto anual en EUR (incluye prorrata de pagas extra). */
  salarioBrutoAnual: number;
  /** Antigüedad en años (los meses van como fracción decimal de año). */
  antiguedadAnios: number;
  /** Tipo de despido: 'improcedente' (33 d) u 'objetivo' (20 d). */
  tipoDespido: TipoDespido;
}

export interface IndemnizacionResultado {
  /** Días indemnizables por año aplicados. */
  diasPorAnio: number;
  /** Tope aplicable en nº de mensualidades. */
  topeMensualidades: number;
  /** Salario bruto por día natural (salario bruto anual / 365). */
  salarioDiario: number;
  /** Mensualidad (salario bruto anual / 12), unidad del tope. */
  mensualidad: number;
  /** Importe del tope = mensualidad · topeMensualidades. */
  topeImporte: number;
  /** Indemnización calculada por días × años, antes de aplicar el tope. */
  indemnizacionSinTope: number;
  /** true si el tope recorta la indemnización sin tope. */
  topeAplicado: boolean;
  /** Indemnización final = min(indemnizacionSinTope, topeImporte). */
  indemnizacion: number;
}

export function calcularIndemnizacionDespido(
  input: IndemnizacionInput,
): IndemnizacionResultado {
  const { salarioBrutoAnual, antiguedadAnios, tipoDespido } = input;

  if (!isFinite(salarioBrutoAnual) || salarioBrutoAnual <= 0) {
    throw new RangeError('El salario bruto anual debe ser un número > 0');
  }
  if (!isFinite(antiguedadAnios) || antiguedadAnios < 0) {
    throw new RangeError('La antigüedad debe ser un número de años ≥ 0');
  }
  const parametros = PARAMETROS_DESPIDO[tipoDespido];
  if (!parametros) {
    throw new RangeError("El tipo de despido debe ser 'improcedente' u 'objetivo'");
  }

  const { diasPorAnio, topeMensualidades } = parametros;

  const salarioDiario = salarioBrutoAnual / DIAS_ANIO;
  const mensualidad = salarioBrutoAnual / MESES_ANIO;
  const topeImporte = mensualidad * topeMensualidades;

  const indemnizacionSinTope = salarioDiario * diasPorAnio * antiguedadAnios;
  const topeAplicado = indemnizacionSinTope > topeImporte;
  const indemnizacion = topeAplicado ? topeImporte : indemnizacionSinTope;

  return {
    diasPorAnio,
    topeMensualidades,
    salarioDiario,
    mensualidad,
    topeImporte,
    indemnizacionSinTope,
    topeAplicado,
    indemnizacion,
  };
}
