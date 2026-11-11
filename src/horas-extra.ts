/**
 * Valor y cobro de las horas extraordinarias (cálculo propio simplificado).
 *
 * Estima cuánto se cobra por las horas extra a partir del salario bruto anual,
 * la jornada anual de convenio y el recargo que aplique la empresa o el convenio:
 *
 *   valor hora ordinaria = salario bruto anual / horas anuales de convenio
 *   valor hora extra      = valor hora ordinaria × (1 + recargo / 100)
 *   total a cobrar        = valor hora extra × número de horas extra
 *
 * Fuente oficial (texto refundido de la Ley del Estatuto de los Trabajadores,
 * Real Decreto Legislativo 2/2015, de 23 de octubre, BOE-A-2015-11430):
 *  - Art. 35.1 ET: las horas extraordinarias se abonan en la cuantía que fije el
 *    convenio colectivo o el contrato, que "en ningún caso podrá ser inferior al
 *    valor de la hora ordinaria". La ley marca ese suelo (la hora ordinaria) pero
 *    NO fija un porcentaje de recargo: el recargo (25 %, 50 %, 75 %…) lo pacta el
 *    convenio o el contrato. Por eso el recargo por defecto es 0 % (mínimo legal).
 *  - Art. 35.2 ET: el número de horas extraordinarias no podrá ser superior a
 *    OCHENTA al año (salvo las de fuerza mayor y las compensadas con descanso).
 *  - Art. 34.1 ET: la jornada máxima es de 40 horas semanales de promedio en
 *    cómputo anual → aproximación habitual de 1.800 horas/año descontando festivos
 *    y vacaciones. El convenio puede fijar una jornada anual menor, por lo que la
 *    jornada anual es un dato de entrada, no una constante.
 *
 * Ampliado el 30-oct-2026 con dos datos que las respuestas generadas dan mal o no dan:
 *  - Art. 35.2 ET, párrafo 2: quien por la modalidad o DURACIÓN de su contrato hace una
 *    jornada anual inferior a la general tiene el tope de 80 horas reducido "en la misma
 *    proporción". Un contrato de 6 meses en el año tope = 40 horas, no 80. Se modela por
 *    meses de contrato en el año (1-12). Los contratos a tiempo parcial no hacen horas
 *    extra (art. 12.4.c ET, salvo fuerza mayor): sus horas de más son complementarias.
 *  - Cotización adicional (Orden PJC/297/2026, de 30 de marzo, art. 5, BOE-A-2026-7296,
 *    leída en https://www.boe.es/diario_boe/txt.php?id=BOE-A-2026-7296 el 30-oct-2026):
 *    horas extra por fuerza mayor 14,00 % (12,00 empresa + 2,00 trabajador); las demás
 *    28,30 % (23,60 empresa + 4,70 trabajador). No cambia el valor de la hora extra:
 *    es lo que se descuenta de ella en nómina y lo que paga la empresa encima.
 *
 * Regla del repo: toda modificación de este archivo exige
 * actualizar tests/horas-extra.test.ts con la fuente oficial citada.
 */

/** Máximo legal de horas extraordinarias al año por trabajador (art. 35.2 ET). */
export const LIMITE_HORAS_EXTRA_ANUAL = 80;

/** Jornada máxima legal semanal en cómputo anual (art. 34.1 ET), en horas. */
export const JORNADA_MAXIMA_SEMANAL_HORAS = 40;

/**
 * Jornada anual de referencia por defecto (aproximación de 40 h/semana
 * descontando festivos y vacaciones). El convenio puede fijar otra distinta.
 */
export const JORNADA_ANUAL_REFERENCIA = 1800;

/**
 * Tipos de la cotización adicional por horas extraordinarias en 2026, en porcentaje
 * (Orden PJC/297/2026, art. 5, BOE-A-2026-7296).
 */
export const COTIZACION_HORAS_EXTRA = {
  fuerzaMayor: { empresa: 12, trabajador: 2 },
  resto: { empresa: 23.6, trabajador: 4.7 },
} as const;

export interface DatosHorasExtra {
  /** Salario bruto anual, en EUR (> 0). */
  salarioBrutoAnual: number;
  /** Jornada anual de convenio, en horas (> 0). */
  horasAnuales: number;
  /** Número de horas extraordinarias realizadas (≥ 0). */
  numHoras: number;
  /** Recargo sobre la hora ordinaria, en porcentaje (≥ 0; 0 = mínimo legal). */
  recargoPorcentaje: number;
  /** Horas extra por fuerza mayor (art. 35.3 ET). Por defecto, no. */
  fuerzaMayor?: boolean;
  /** Meses de contrato en el año, 1-12 (art. 35.2 ET, tope proporcional). Por defecto, 12. */
  mesesContrato?: number;
}

export interface ResultadoHorasExtra {
  /** Valor de la hora ordinaria: salario bruto anual / horas anuales, en EUR. */
  valorHoraOrdinaria: number;
  /** Valor de la hora extra: hora ordinaria × (1 + recargo/100), en EUR. */
  valorHoraExtra: number;
  /** Total a cobrar: valor hora extra × número de horas, en EUR. */
  total: number;
  /** Tipo de la cotización adicional a cargo del trabajador, en % (Orden PJC/297/2026, art. 5). */
  tipoTrabajador: number;
  /** Tipo de la cotización adicional a cargo de la empresa, en %. */
  tipoEmpresa: number;
  /** Cotización adicional que se descuenta al trabajador sobre el total, en EUR. */
  cotizacionTrabajador: number;
  /** Cotización adicional que paga la empresa sobre el total, en EUR. */
  cotizacionEmpresa: number;
  /** Tope anual de horas extra para esos meses de contrato (80 × meses / 12, art. 35.2 ET). */
  limiteAnual: number;
}

/**
 * Calcula el valor de la hora extra y el total a cobrar.
 *
 * @throws RangeError si el salario o las horas anuales no son finitos y > 0, o si
 *   el número de horas o el recargo no son finitos y ≥ 0.
 */
export function calcularHorasExtra({
  salarioBrutoAnual,
  horasAnuales,
  numHoras,
  recargoPorcentaje,
  fuerzaMayor = false,
  mesesContrato = 12,
}: DatosHorasExtra): ResultadoHorasExtra {
  if (!isFinite(salarioBrutoAnual) || salarioBrutoAnual <= 0) {
    throw new RangeError('El salario bruto anual debe ser un número > 0');
  }
  if (!isFinite(horasAnuales) || horasAnuales <= 0) {
    throw new RangeError('La jornada anual de convenio debe ser un número > 0');
  }
  if (!isFinite(numHoras) || numHoras < 0) {
    throw new RangeError('El número de horas extra debe ser un número ≥ 0');
  }
  if (!isFinite(recargoPorcentaje) || recargoPorcentaje < 0) {
    throw new RangeError('El recargo debe ser un número ≥ 0');
  }
  if (!isFinite(mesesContrato) || mesesContrato <= 0 || mesesContrato > 12) {
    throw new RangeError('Los meses de contrato deben estar entre 1 y 12');
  }

  const valorHoraOrdinaria = salarioBrutoAnual / horasAnuales;
  const valorHoraExtra = valorHoraOrdinaria * (1 + recargoPorcentaje / 100);
  const total = valorHoraExtra * numHoras;

  const tipos = fuerzaMayor ? COTIZACION_HORAS_EXTRA.fuerzaMayor : COTIZACION_HORAS_EXTRA.resto;
  const cotizacionTrabajador = (total * tipos.trabajador) / 100;
  const cotizacionEmpresa = (total * tipos.empresa) / 100;
  const limiteAnual = (LIMITE_HORAS_EXTRA_ANUAL * mesesContrato) / 12;

  return {
    valorHoraOrdinaria,
    valorHoraExtra,
    total,
    tipoTrabajador: tipos.trabajador,
    tipoEmpresa: tipos.empresa,
    cotizacionTrabajador,
    cotizacionEmpresa,
    limiteAnual,
  };
}
