/**
 * Días de vacaciones que corresponden por prorrateo según los días trabajados en el año.
 *
 * Fuente oficial: art. 38 del texto refundido de la Ley del Estatuto de los Trabajadores
 * (Real Decreto Legislativo 2/2015, de 23 de octubre, BOE-A-2015-11430), texto consolidado:
 *   - Art. 38.1: "El periodo de vacaciones anuales retribuidas, no sustituible por compensación
 *     económica, será el pactado en convenio colectivo o contrato individual. En ningún caso la
 *     duración será inferior a treinta días naturales." → mínimo legal DIAS_ANUALES_MINIMO_LEGAL.
 *   - Art. 38.3: el trabajador conocerá las fechas al menos dos meses antes del disfrute (preaviso).
 *
 * El PRORRATEO lineal sobre 365 días naturales NO lo fija la ley: es el criterio más habitual
 * (y el que usan la mayoría de convenios cuando no detallan otra fórmula). Es, por tanto, un
 * cálculo propio simplificado documentado como tal en la página; la única cifra de ley que fija
 * el resultado es el mínimo de 30 días naturales del art. 38.1. Un convenio puede mejorar ese
 * mínimo (nunca reducirlo) o prorratear por meses completos, en cuyo caso el resultado varía.
 *
 * Regla del repo: toda modificación de este archivo exige actualizar
 * tests/vacaciones.test.ts con la fuente oficial citada.
 */

import { salarioDiarioOrdinario } from './finiquito.js';
import { num } from './format.js';

/** Mínimo legal de vacaciones anuales: 30 días naturales/año (art. 38.1 ET). */
export const DIAS_ANUALES_MINIMO_LEGAL = 30;

/** Días naturales del año usados como base del prorrateo lineal. */
export const DIAS_ANO = 365;

export interface DatosVacaciones {
  /** Días de vacaciones al año pactados en convenio o contrato (≥ 1). */
  diasAnuales: number;
  /** Días efectivamente trabajados en el año (> 0). Se acota a un máximo de DIAS_ANO. */
  diasTrabajados: number;
}

export interface ResultadoVacaciones {
  /** Días anuales pactados usados en el cálculo. */
  diasAnuales: number;
  /** Días trabajados tras acotar al máximo de DIAS_ANO. */
  diasTrabajadosClamped: number;
  /** Proporción del año trabajada (diasTrabajadosClamped / DIAS_ANO), en [0, 1]. */
  proporcion: number;
  /** Días de vacaciones sin redondear (diasAnuales × proporcion). */
  diasExactos: number;
  /** Días de vacaciones que corresponden, redondeados al entero más próximo. */
  diasCorresponden: number;
}

export function calcularVacaciones({ diasAnuales, diasTrabajados }: DatosVacaciones): ResultadoVacaciones {
  if (!isFinite(diasAnuales) || diasAnuales <= 0) {
    throw new RangeError('Los días de vacaciones al año deben ser un número > 0');
  }
  if (!isFinite(diasTrabajados) || diasTrabajados <= 0) {
    throw new RangeError('Los días trabajados deben ser un número > 0');
  }

  const diasTrabajadosClamped = Math.min(diasTrabajados, DIAS_ANO);
  const proporcion = diasTrabajadosClamped / DIAS_ANO;
  const diasExactos = diasAnuales * proporcion;
  const diasCorresponden = Math.round(diasExactos);

  return { diasAnuales, diasTrabajadosClamped, proporcion, diasExactos, diasCorresponden };
}

/**
 * Retribución bruta de los días de vacaciones. El art. 38.1 ET fija los DÍAS (no se
 * reducen por trabajar a tiempo parcial: `calcularVacaciones` de arriba no depende de
 * la jornada, solo del tiempo trabajado en el año), pero no dice cuánto se cobra por
 * ellos. Eso lo fija el art. 7.1 del Convenio 132 de la OIT sobre vacaciones anuales
 * pagadas (ratificado por España, Instrumento de Ratificación de 16-jun-1972,
 * BOE-A-1974-1055): durante las vacaciones se percibe "la retribución normal o
 * media" — el salario ORDINARIO del trabajador. A tiempo parcial ese salario ordinario
 * ya es más bajo (menos horas, menos sueldo); lo que el convenio impide es rebajarlo
 * una segunda vez por estar de vacaciones, no que sea proporcional a la jornada.
 *
 * Ese salario ordinario NO incluye las pagas extraordinarias (art. 31 ET): se
 * devengan aparte y se siguen devengando durante las vacaciones. Con 14 pagas, el
 * día de vacaciones vale (bruto · 12/14) / 365; solo si las extras van prorrateadas
 * en 12 nóminas vale bruto / 365, porque entonces la nómina del mes de vacaciones
 * las lleva dentro. Misma convención que `finiquito.ts` (`salarioDiarioOrdinario`).
 *
 * Corrección del 1-oct-2026: antes era siempre bruto/365, que con 14 pagas mete las
 * extras en el día de vacaciones (+16,7 %, 14/12). Ejemplo de vacaciones-media-jornada
 * (10.950 €, 30 días): antes 900 €, ahora 771,43 € con 14 pagas (900 € con 12).
 *
 * @param numeroPagas 14 (12 mensualidades + 2 extras aparte, por defecto) o 12
 *   (extras prorrateadas en las nóminas).
 */
export function calcularPagaVacaciones(
  salarioBrutoAnual: number,
  diasVacaciones: number,
  numeroPagas: 12 | 14 = 14,
): number {
  if (!isFinite(salarioBrutoAnual) || salarioBrutoAnual <= 0) {
    throw new RangeError('El salario bruto anual debe ser un número > 0');
  }
  // 0 días es un resultado legítimo (p. ej. 5 días trabajados → 30 × 5/365 = 0,41 → 0 días)
  // y vale 0 €. Antes lanzaba y la página se quedaba con el resultado anterior en pantalla.
  if (!isFinite(diasVacaciones) || diasVacaciones < 0) {
    throw new RangeError('Los días de vacaciones deben ser un número ≥ 0');
  }
  if (numeroPagas !== 12 && numeroPagas !== 14) {
    throw new RangeError('El número de pagas debe ser 12 (prorrateadas) o 14');
  }

  return salarioDiarioOrdinario(salarioBrutoAnual, numeroPagas === 12) * diasVacaciones;
}

/**
 * «1 día», «0 días», «22,5 días»: número con coma decimal española (vía `num` del
 * formateador del repo, nunca `${n}`, que pinta «22.5») y singular solo para 1.
 * Enteros sin decimales; si no, 1 o 2 decimales según haga falta.
 */
export function textoDias(dias: number): string {
  const decimales = Number.isInteger(dias) ? 0 : Number.isInteger(Math.round(dias * 1e6) / 1e5) ? 1 : 2;
  return `${num(dias, decimales)} ${dias === 1 ? 'día' : 'días'}`;
}

/**
 * Prorrateo por MESES trabajados: días anuales × meses ÷ 12. Con el mínimo legal de 30 días
 * naturales (art. 38.1 ET) salen 2,5 días por mes, que es la cifra por la que pregunta la gente
 * («cuántos días me corresponden por 6 meses trabajados»).
 *
 * Igual que el prorrateo por días de `calcularVacaciones`, la ley no fija esta fórmula: fija el
 * mínimo anual. La proporción por meses es la que usan los convenios que prorratean «por mes
 * trabajado», y la página la presenta así. Sin redondeo: el medio día (7,5 con 3 meses) lo
 * resuelve el convenio, y el Estatuto no dice nada de cómo redondear.
 */
export function vacacionesPorMeses(meses: number, diasAnuales: number = DIAS_ANUALES_MINIMO_LEGAL): number {
  if (!isFinite(meses) || meses < 0 || meses > 12) {
    throw new RangeError('Los meses trabajados deben estar entre 0 y 12');
  }
  if (!isFinite(diasAnuales) || diasAnuales <= 0) {
    throw new RangeError('Los días de vacaciones al año deben ser un número > 0');
  }
  return (diasAnuales * meses) / 12;
}

/**
 * Días naturales trabajados en el año desde una fecha de alta hasta el 31 de diciembre, ambos
 * incluidos. Fechas ISO (`AAAA-MM-DD`) en UTC para que el cambio de hora no reste un día.
 * Base del prorrateo por días con el año real (365 o 366).
 */
export function diasDesdeAlta(altaIso: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(altaIso);
  if (!m) throw new RangeError('La fecha de alta debe ir en formato AAAA-MM-DD');
  const [anio, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const alta = Date.UTC(anio, mes - 1, dia);
  const fin = Date.UTC(anio, 11, 31);
  if (new Date(alta).getUTCMonth() !== mes - 1) throw new RangeError('Fecha de alta inválida');
  return Math.round((fin - alta) / 86_400_000) + 1;
}

/** Meses COMPLETOS trabajados desde la fecha de alta hasta el 31 de diciembre. */
export function mesesCompletosDesdeAlta(altaIso: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(altaIso);
  if (!m) throw new RangeError('La fecha de alta debe ir en formato AAAA-MM-DD');
  const mes = Number(m[2]);
  const dia = Number(m[3]);
  // Si entra el día 1 el mes de alta cuenta entero; si no, empieza a contar el siguiente.
  return 12 - mes + (dia === 1 ? 1 : 0);
}
