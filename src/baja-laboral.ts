/**
 * Prestación por incapacidad temporal (IT) — "baja laboral" — vigente en 2026.
 *
 * Fuente oficial:
 *  - Régimen de la prestación de IT: arts. 169 a 176 del texto refundido de la Ley General
 *    de la Seguridad Social (Real Decreto Legislativo 8/2015, de 30 de octubre, BOE-A-2015-11724).
 *  - Porcentajes de la base reguladora:
 *      · Enfermedad común / accidente no laboral: días 1-3 sin prestación (salvo mejora de
 *        convenio); días 4-20 al 60 %; día 21 en adelante al 75 % — Real Decreto 53/1980, de
 *        11 de enero, sobre porcentajes de la base reguladora en la prestación de IT.
 *      · Accidente de trabajo / enfermedad profesional: 75 % de la base reguladora desde el día
 *        siguiente al de la baja (art. 171 LGSS).
 *  - Base reguladora diaria: base de cotización (por contingencias comunes o profesionales, según
 *    el tipo de baja) del mes anterior a la baja dividida entre 30 (divisor de la Seguridad Social
 *    para salario mensual; con salario diario son los días del mes). No incluye las mejoras de
 *    convenio colectivo.
 *  - Accidente de trabajo / enfermedad profesional (11-nov-2026): la base reguladora suma dos
 *    sumandos, según la página de cuantía de la IT de la Seguridad Social (leída el 11-nov-2026,
 *    https://www.seg-social.es/wps/portal/wss/internet/Trabajadores/PrestacionesPensionesTrabajadores/10952/28362/28365):
 *    «La base de cotización por contingencias profesionales del mes anterior, sin horas
 *    extraordinarias, dividida por el número de días a que corresponda dicha cotización» + «La
 *    cotización por horas extraordinarias del año natural anterior, dividida entre 365 días, salvo
 *    que la antigüedad en la empresa sea inferior, en cuyo caso, se expresará el número de días de
 *    alta laboral en la empresa excluidos los del mes de la baja». Hasta hoy la calculadora omitía
 *    el segundo sumando y la página lo llamaba, por error, «prorrateo de pagas extra» (las pagas
 *    extra ya van prorrateadas en la base mensual en los dos tipos de baja).
 *
 * Regla del repo: toda modificación de este archivo exige actualizar
 * tests/baja-laboral.test.ts con la fuente oficial citada.
 */

export type TipoBaja = 'comun' | 'laboral';

/** Porcentajes de la base reguladora por contingencia (RD 53/1980 y art. 171 LGSS). */
export const PORCENTAJES = {
  /** Enfermedad común / accidente no laboral: días 1 a 3 sin prestación (salvo convenio). */
  comunDias1a3: 0,
  /** Enfermedad común / accidente no laboral: días 4 a 20 al 60 %. */
  comunDias4a20: 0.6,
  /** Enfermedad común / accidente no laboral: día 21 en adelante al 75 %. */
  comunDias21mas: 0.75,
  /** Accidente de trabajo / enfermedad profesional: 75 % desde el día siguiente a la baja. */
  laboral: 0.75,
} as const;

export interface TramoImporte {
  /** Etiqueta descriptiva del tramo, con días y porcentaje. */
  label: string;
  /** Importe del tramo en EUR. */
  importe: number;
}

export interface ResultadoBajaLaboral {
  /** Base reguladora diaria (base de cotización mensual ÷ 30), en EUR. */
  baseDiaria: number;
  /** Importe total estimado del periodo de baja, en EUR. */
  total: number;
  /** Importe medio por día de baja (total ÷ días), en EUR. */
  mediaPorDia: number;
  /** Desglose por tramos aplicados. */
  tramos: TramoImporte[];
}

/**
 * Base reguladora diaria a partir de la base de cotización mensual.
 * Aproximación estándar para salario mensual: base del mes anterior ÷ 30.
 */
export function baseReguladoraDiaria(baseCotizacionMensual: number): number {
  if (!isFinite(baseCotizacionMensual) || baseCotizacionMensual <= 0) {
    throw new RangeError('La base de cotización mensual debe ser un número > 0');
  }
  return baseCotizacionMensual / 30;
}

/**
 * Base reguladora diaria en accidente de trabajo o enfermedad profesional: base profesional del
 * mes anterior SIN horas extra ÷ 30 + horas extra cotizadas el año natural anterior ÷ 365 (o ÷ los
 * días de alta en la empresa, sin los del mes de la baja, si llevas menos de un año).
 */
export function baseReguladoraDiariaProfesional(
  baseSinHorasExtra: number,
  horasExtraAnoAnterior = 0,
  diasDivisorHorasExtra = 365,
): number {
  if (!isFinite(horasExtraAnoAnterior) || horasExtraAnoAnterior < 0) {
    throw new RangeError('Las horas extra del año anterior deben ser un número ≥ 0');
  }
  if (!Number.isInteger(diasDivisorHorasExtra) || diasDivisorHorasExtra < 1 || diasDivisorHorasExtra > 365) {
    throw new RangeError('El divisor de las horas extra debe ser un entero entre 1 y 365');
  }
  return baseReguladoraDiaria(baseSinHorasExtra) + horasExtraAnoAnterior / diasDivisorHorasExtra;
}

/** Reparto de la baja por enfermedad común / accidente no laboral en sus tres tramos. */
function calcularComun(baseDiaria: number, dias: number): Omit<ResultadoBajaLaboral, 'baseDiaria' | 'mediaPorDia'> {
  const diasTramo1 = Math.min(dias, 3);
  const diasTramo2 = Math.max(0, Math.min(dias, 20) - 3);
  const diasTramo3 = Math.max(0, dias - 20);

  const importeTramo1 = diasTramo1 * baseDiaria * PORCENTAJES.comunDias1a3;
  const importeTramo2 = diasTramo2 * baseDiaria * PORCENTAJES.comunDias4a20;
  const importeTramo3 = diasTramo3 * baseDiaria * PORCENTAJES.comunDias21mas;

  return {
    total: importeTramo1 + importeTramo2 + importeTramo3,
    tramos: [
      { label: `Días 1-3 (${diasTexto(diasTramo1)}, 0 %)`, importe: importeTramo1 },
      { label: `Días 4-20 (${diasTexto(diasTramo2)}, 60 %)`, importe: importeTramo2 },
      { label: `Día 21 en adelante (${diasTexto(diasTramo3)}, 75 %)`, importe: importeTramo3 },
    ],
  };
}

/** «10,5 días», «1 día»: coma decimal y singular (auditoría UX, 1-oct). */
const diasTexto = (n: number) => `${String(n).replace('.', ',')} ${n === 1 ? 'día' : 'días'}`;

/** Baja por accidente de trabajo / enfermedad profesional: 75 % desde el día siguiente a la baja. */
function calcularLaboral(baseDiaria: number, dias: number): Omit<ResultadoBajaLaboral, 'baseDiaria' | 'mediaPorDia'> {
  const importe = dias * baseDiaria * PORCENTAJES.laboral;
  return {
    total: importe,
    tramos: [
      { label: `Desde el día siguiente a la baja (${diasTexto(dias)}, 75 %)`, importe },
    ],
  };
}

/**
 * Estimación de la prestación por incapacidad temporal para el periodo indicado.
 *
 * @param baseCotizacionMensual base de cotización del mes anterior a la baja (EUR/mes)
 * @param tipo tipo de baja: 'comun' (enfermedad común / accidente no laboral) o 'laboral'
 *             (accidente de trabajo / enfermedad profesional)
 * @param dias número de días de baja
 * @param horasExtraAnoAnterior solo en 'laboral': importe de las horas extra cotizadas el año
 *   natural anterior (EUR). En ese caso `baseCotizacionMensual` va SIN horas extra. En 'comun' se
 *   ignora: la base por contingencias comunes no lleva horas extra.
 * @param diasDivisorHorasExtra 365, o los días de alta en la empresa si la antigüedad es menor
 */
export function calcularBajaLaboral(
  baseCotizacionMensual: number,
  tipo: TipoBaja,
  dias: number,
  horasExtraAnoAnterior = 0,
  diasDivisorHorasExtra = 365,
): ResultadoBajaLaboral {
  if (!isFinite(dias) || dias <= 0) {
    throw new RangeError('Los días de baja deben ser un número > 0');
  }
  const baseDiaria = tipo === 'laboral'
    ? baseReguladoraDiariaProfesional(baseCotizacionMensual, horasExtraAnoAnterior, diasDivisorHorasExtra)
    : baseReguladoraDiaria(baseCotizacionMensual);
  const { total, tramos } = tipo === 'laboral'
    ? calcularLaboral(baseDiaria, dias)
    : calcularComun(baseDiaria, dias);

  return { baseDiaria, total, mediaPorDia: total / dias, tramos };
}

/* ------------------------------------------------------------------------------------------
 * Modo proyecto (13-oct-2026): la misma baja con FECHAS. Una respuesta genérica da los tramos en
 * abstracto; lo que no hace es decirte qué días caen en cada tramo, quién te
 * los paga y cuánto entra en la nómina de cada mes cuando la baja cruza de mes.
 *
 * Quién paga cada día — art. 173.1 LGSS (BOE-A-2015-11724, texto consolidado leído el
 * 13-oct-2026): en enfermedad común o accidente no laboral el subsidio se abona «a partir del
 * cuarto día de baja», y «desde el día cuarto al decimoquinto de baja, ambos inclusive, el
 * subsidio estará a cargo del empresario»; desde el 16, de la entidad gestora o la mutua. En
 * accidente de trabajo o enfermedad profesional, «desde el día siguiente al de la baja», con el
 * salario íntegro del día de la baja a cargo del empresario (ese día no entra en el cálculo: lo
 * cobras como salario, no como prestación).
 *
 * El porcentaje NO cambia el día 16: cambia el pagador. Los importes por día son exactamente los
 * de `calcularBajaLaboral` (los tests lo comprueban sumando), solo repartidos en el calendario.
 *
 * Fuera a propósito: la RECAÍDA (art. 169.2 LGSS: nueva baja por la misma patología dentro de
 * los 180 días siguientes al alta). La norma la define a efectos de duración máxima; cómo afecta
 * a los días sin prestación y al tramo de porcentaje no está en ese texto y no se publica sin
 * fuente (regla de exactitud).
 * ---------------------------------------------------------------------------------------- */

/** Quién abona cada día de la baja (art. 173.1 LGSS). */
export type Pagador = 'nadie' | 'empresa' | 'inss-mutua';

export interface TramoFechado {
  /** Primer y último día del tramo, en ISO `AAAA-MM-DD`. */
  desde: string;
  hasta: string;
  /** Ordinal del primer y último día de baja (1 = primer día de baja). */
  diaDesde: number;
  diaHasta: number;
  dias: number;
  /** Porcentaje de la base reguladora (0, 0,6 o 0,75). */
  porcentaje: number;
  pagador: Pagador;
  /** Prestación del tramo, en EUR. */
  importe: number;
}

export interface MesNomina {
  /** Mes natural, `AAAA-MM`. */
  mes: string;
  /** Días de baja que caen en ese mes. */
  dias: number;
  /** Prestación de IT de esos días, en EUR. */
  prestacion: number;
  /** Complemento de convenio de esos días (lo paga la empresa), en EUR. */
  complemento: number;
  /** prestacion + complemento. */
  total: number;
}

export interface CalendarioBaja {
  baseDiaria: number;
  tramos: TramoFechado[];
  meses: MesNomina[];
  /** Último día de baja, ISO. */
  fin: string;
  prestacion: number;
  complemento: number;
  total: number;
}

const DIA_MS = 86_400_000;
const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

/** `AAAA-MM-DD` → milisegundos UTC (sin zona horaria: un día es un día en cualquier navegador). */
function isoAms(iso: string): number {
  const m = ISO.exec(iso);
  if (!m) throw new RangeError('La fecha de inicio debe ir en formato AAAA-MM-DD');
  const ms = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  // Date.UTC acepta «2026-02-31» y lo pasa a marzo: se rechaza en vez de corregirlo en silencio.
  if (new Date(ms).toISOString().slice(0, 10) !== iso) throw new RangeError('Fecha de inicio inexistente');
  return ms;
}

const msAiso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Porcentaje y pagador del día `n` de la baja (n = 1 es el primer día). */
export function diaDeBaja(tipo: TipoBaja, n: number): { porcentaje: number; pagador: Pagador } {
  if (tipo === 'laboral') return { porcentaje: PORCENTAJES.laboral, pagador: 'inss-mutua' };
  if (n <= 3) return { porcentaje: PORCENTAJES.comunDias1a3, pagador: 'nadie' };
  if (n <= 15) return { porcentaje: PORCENTAJES.comunDias4a20, pagador: 'empresa' };
  if (n <= 20) return { porcentaje: PORCENTAJES.comunDias4a20, pagador: 'inss-mutua' };
  return { porcentaje: PORCENTAJES.comunDias21mas, pagador: 'inss-mutua' };
}

/**
 * La baja día a día con fechas: tramos por porcentaje y pagador, y reparto por mes de nómina.
 *
 * @param complementoPct porcentaje de la base reguladora diaria que el convenio garantiza
 *   durante la baja (0 = sin complemento; 100 = cobrar el 100 % de la base). El complemento de
 *   cada día es lo que falta de la prestación hasta ese porcentaje; si el convenio solo
 *   complementa desde cierto día, este cálculo lo aplica a todos (supuesto declarado en la página).
 */
export function calendarioBaja(
  baseCotizacionMensual: number,
  tipo: TipoBaja,
  dias: number,
  inicio: string,
  complementoPct = 0,
): CalendarioBaja {
  if (!Number.isInteger(dias) || dias < 1 || dias > 545) {
    throw new RangeError('Con fechas, los días de baja deben ser un entero entre 1 y 545');
  }
  if (!isFinite(complementoPct) || complementoPct < 0 || complementoPct > 100) {
    throw new RangeError('El complemento de convenio debe estar entre 0 y 100 %');
  }
  const baseDiaria = baseReguladoraDiaria(baseCotizacionMensual);
  const t0 = isoAms(inicio);
  const garantizado = baseDiaria * (complementoPct / 100);

  const tramos: TramoFechado[] = [];
  const meses: MesNomina[] = [];
  let prestacion = 0;
  let complemento = 0;

  for (let n = 1; n <= dias; n++) {
    const fecha = msAiso(t0 + (n - 1) * DIA_MS);
    const { porcentaje, pagador } = diaDeBaja(tipo, n);
    const importe = baseDiaria * porcentaje;
    const extra = Math.max(0, garantizado - importe);
    prestacion += importe;
    complemento += extra;

    const ult = tramos[tramos.length - 1];
    if (ult && ult.porcentaje === porcentaje && ult.pagador === pagador) {
      ult.hasta = fecha; ult.diaHasta = n; ult.dias++; ult.importe += importe;
    } else {
      tramos.push({ desde: fecha, hasta: fecha, diaDesde: n, diaHasta: n, dias: 1, porcentaje, pagador, importe });
    }

    const mes = fecha.slice(0, 7);
    const m = meses[meses.length - 1];
    if (m && m.mes === mes) {
      m.dias++; m.prestacion += importe; m.complemento += extra; m.total += importe + extra;
    } else {
      meses.push({ mes, dias: 1, prestacion: importe, complemento: extra, total: importe + extra });
    }
  }

  return {
    baseDiaria,
    tramos,
    meses,
    fin: msAiso(t0 + (dias - 1) * DIA_MS),
    prestacion,
    complemento,
    total: prestacion + complemento,
  };
}
