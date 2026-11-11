/**
 * Finiquito (liquidación al cese) — estimación EN BRUTO de los conceptos ya
 * devengados al terminar la relación laboral: salario de los días trabajados
 * del último mes, vacaciones generadas y no disfrutadas, y prorrata de las
 * pagas extra pendientes de cobro.
 *
 * NO es una fórmula con cifras de ley: el finiquito liquida importes devengados
 * que dependen del salario real y del convenio colectivo. La metodología es un
 * cálculo propio simplificado, anclado en el Estatuto de los Trabajadores
 * (Real Decreto Legislativo 2/2015, de 23 de octubre, BOE-A-2015-11430):
 *   - Art. 26: salario.
 *   - Art. 31: el trabajador tiene derecho a DOS gratificaciones extraordinarias
 *     al año (Navidad + la que fije el convenio); pueden prorratearse en las 12
 *     mensualidades. De ahí el factor 2/14 sobre el salario bruto anual: las dos
 *     pagas extra frente a 12 mensualidades + 2 extras = 14 pagas al año.
 *   - Art. 38: vacaciones anuales, mínimo 30 días naturales, no sustituibles por
 *     compensación económica salvo al terminar el contrato, en cuyo caso las no
 *     disfrutadas se compensan en metálico (concepto de vacaciones del finiquito).
 *   - Art. 49.2: obligación de la empresa de acompañar la comunicación del cese
 *     con una propuesta de liquidación (el finiquito).
 *
 * Convenciones documentadas en la página:
 *   - Salario diario ORDINARIO, por día natural (base 365):
 *       · pagas prorrateadas (12 nóminas que ya llevan las extras dentro):
 *         salario bruto anual / 365;
 *       · pagas NO prorrateadas (14 pagas): (salario bruto anual · 12/14) / 365,
 *         es decir, SIN las dos pagas extra, que se liquidan aparte en su prorrata.
 *   - Prorrata de pagas extra (solo si NO están prorrateadas) =
 *     (salario bruto anual · 2/14) · (días desde el último cobro / 365),
 *     acotando los días al rango [0, 365].
 *
 * Corrección del 1-oct-2026: hasta entonces el salario diario era SIEMPRE
 * bruto/365. Con 14 pagas ese bruto ya contiene las dos extras, y como la prorrata
 * de las extras se sumaba además aparte, las pagas extra se contaban DOS veces
 * dentro de los días trabajados y las vacaciones (sobrestimados un 16,7 %, 14/12).
 * Ejemplo de la página (24.000 €, 15 días, 8 de vacaciones, 182 días, sin
 * prorratear): antes 3.221,92 €, ahora 3.005,87 €.
 * El resultado es BRUTO (sin IRPF ni cotización) y NO incluye indemnización por
 * despido, que se calcula y paga aparte.
 *
 * Regla del repo: toda modificación de este archivo exige
 * actualizar tests/finiquito.test.ts con la fuente oficial citada.
 */

/** Nº de gratificaciones extraordinarias al año (art. 31 ET). */
export const PAGAS_EXTRA_ANUALES = 2;
/** Pagas totales al año: 12 mensualidades + 2 extraordinarias (art. 31 ET). */
export const PAGAS_TOTALES_ANUALES = 14;
/** Días naturales del año, base del salario diario y del devengo de pagas. */
export const DIAS_ANIO = 365;
/** Mensualidades ordinarias al año (las 14 pagas menos las 2 extraordinarias). */
export const MENSUALIDADES_ORDINARIAS = PAGAS_TOTALES_ANUALES - PAGAS_EXTRA_ANUALES;

/**
 * Salario diario ORDINARIO por día natural (base 365), sin pagas extra salvo que ya
 * vayan prorrateadas dentro de las nóminas.
 *   - `pagasProrrateadas = true` (12 nóminas con la prorrata dentro): bruto / 365.
 *   - `pagasProrrateadas = false` (14 pagas): (bruto · 12/14) / 365. Las dos pagas
 *     extra no forman parte del salario de cada día: se devengan y cobran aparte.
 * Lo comparten el finiquito y la paga de vacaciones (`vacaciones.ts`).
 */
export function salarioDiarioOrdinario(salarioBrutoAnual: number, pagasProrrateadas: boolean): number {
  if (!isFinite(salarioBrutoAnual) || salarioBrutoAnual <= 0) {
    throw new RangeError('El salario bruto anual debe ser un número > 0');
  }
  const anualOrdinario = pagasProrrateadas
    ? salarioBrutoAnual
    : (salarioBrutoAnual * MENSUALIDADES_ORDINARIAS) / PAGAS_TOTALES_ANUALES;
  return anualOrdinario / DIAS_ANIO;
}

export interface FiniquitoInput {
  /** Salario bruto anual en EUR. */
  salarioBrutoAnual: number;
  /** Días trabajados del último mes pendientes de cobro. */
  diasTrabajadosMes: number;
  /** Días de vacaciones generados y no disfrutados (saldo neto a favor). */
  vacacionesPendientes: number;
  /** true si las pagas extra ya están prorrateadas en las 12 mensualidades. */
  pagasProrrateadas: boolean;
  /** Días transcurridos desde el último cobro/devengo de paga extra. */
  diasDesdeUltimaPaga: number;
}

export interface FiniquitoResultado {
  /**
   * Salario bruto ordinario por día natural: bruto/365 si las pagas están
   * prorrateadas; (bruto · 12/14)/365 si no (ver `salarioDiarioOrdinario`).
   */
  salarioDiario: number;
  /** Importe por los días trabajados del último mes. */
  importeDiasTrabajados: number;
  /** Importe por las vacaciones generadas y no disfrutadas. */
  importeVacaciones: number;
  /** Prorrata de las pagas extra devengadas (0 si están prorrateadas). */
  importePagasExtra: number;
  /** Finiquito bruto estimado = suma de los tres conceptos. */
  total: number;
}

/**
 * Importe devengado de las DOS pagas extra (art. 31 ET) proporcional a los días
 * ya trabajados dentro de un periodo de devengo. Por defecto el periodo es el año
 * natural completo (`DIAS_ANIO`), que es la convención que ya usaba el finiquito;
 * se generaliza el periodo para poder responder también «¿cuánto me toca si llevo
 * menos de un año en la empresa?» sin depender de que la relación laboral termine.
 * Los días se acotan a `[0, diasPeriodoDevengo]`: no se puede devengar más de una
 * paga completa aunque se pase una fecha de más.
 */
export function importePagaExtraProporcional(
  salarioBrutoAnual: number,
  diasDevengados: number,
  diasPeriodoDevengo: number = DIAS_ANIO,
): number {
  if (!isFinite(salarioBrutoAnual) || salarioBrutoAnual <= 0) {
    throw new RangeError('El salario bruto anual debe ser un número > 0');
  }
  const dosPagasExtra = (salarioBrutoAnual * PAGAS_EXTRA_ANUALES) / PAGAS_TOTALES_ANUALES;
  const dias =
    isFinite(diasDevengados) && diasDevengados >= 0
      ? Math.min(diasDevengados, diasPeriodoDevengo)
      : 0;
  return dosPagasExtra * (dias / diasPeriodoDevengo);
}

export function calcularFiniquito(input: FiniquitoInput): FiniquitoResultado {
  const {
    salarioBrutoAnual,
    diasTrabajadosMes,
    vacacionesPendientes,
    pagasProrrateadas,
    diasDesdeUltimaPaga,
  } = input;

  if (!isFinite(salarioBrutoAnual) || salarioBrutoAnual <= 0) {
    throw new RangeError('El salario bruto anual debe ser un número > 0');
  }
  if (!isFinite(diasTrabajadosMes) || diasTrabajadosMes < 0) {
    throw new RangeError('Los días trabajados deben ser un número ≥ 0');
  }
  if (!isFinite(vacacionesPendientes) || vacacionesPendientes < 0) {
    throw new RangeError('Los días de vacaciones deben ser un número ≥ 0');
  }

  // Sin prorratear, el salario de cada día NO lleva las extras: van en su prorrata.
  const salarioDiario = salarioDiarioOrdinario(salarioBrutoAnual, pagasProrrateadas);
  const importeDiasTrabajados = salarioDiario * diasTrabajadosMes;
  const importeVacaciones = salarioDiario * vacacionesPendientes;

  // Prorrata de pagas extra: solo si NO están prorrateadas ya en las nóminas.
  const importePagasExtra = pagasProrrateadas
    ? 0
    : importePagaExtraProporcional(salarioBrutoAnual, diasDesdeUltimaPaga, DIAS_ANIO);

  const total = importeDiasTrabajados + importeVacaciones + importePagasExtra;

  return {
    salarioDiario,
    importeDiasTrabajados,
    importeVacaciones,
    importePagasExtra,
    total,
  };
}
