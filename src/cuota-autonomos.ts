/**
 * Cuota de autónomos (RETA) 2026 por tramos de rendimiento neto mensual.
 *
 * Fuente oficial: Orden PJC/297/2026, de 30 de marzo (BOE-A-2026-7296).
 * La Orden NO publica cuotas: publica las BASES mínimas por tramo (art. 18.1, tabla) y
 * los TIPOS (arts. 18.2, 37.5.a) y 37.6). La cuota mínima es base mínima × tipo total, redondeada al
 * céntimo, y la tabla de cuotas que difunde la Seguridad Social coincide céntimo a
 * céntimo con base × 31,50 % redondeado.
 *
 * Historia (corregido el 1-oct-2026). Este archivo guardaba cuotas escritas a mano con
 * el comentario de que eran «importes publicados que no se derivan de base×tipo» (nota
 * de la auditoría del 2026-07-08). Era falso: los tramos 7 a 15 seguían con las cuotas
 * de 2025 y varios tramos bajos iban desviados unos céntimos. Ahora se guarda la base
 * del BOE y la cuota se DERIVA, para que no vuelva a poder divergir de la Orden.
 *
 * Regla del repo: toda modificación de este archivo exige actualizar
 * tests/cuota-autonomos.test.ts con la fuente oficial citada.
 */

/**
 * Tipos de cotización RETA 2026, Orden PJC/297/2026, arts. 18.2, 37.5.a) y 37.6 (fracciones).
 * Con la cobertura obligatoria de todas las contingencias desde 2019.
 */
export const TIPOS_RETA_2026 = {
  /** Contingencias comunes, art. 18.2. */
  contingenciasComunes: 0.283,
  /** Contingencias profesionales (AT y EP), art. 18.2. */
  contingenciasProfesionales: 0.013,
  /** Mecanismo de Equidad Intergeneracional, art. 18.2. */
  mei: 0.009,
  /** Cese de actividad, art. 37.5.a) (no el 18.2: corregido el 11-nov-2026). */
  ceseActividad: 0.009,
  /** Formación profesional, art. 37.6. */
  formacion: 0.001,
} as const;

/** Tipo total 2026: 28,30 + 1,30 + 0,90 + 0,90 + 0,10 = 31,50 %. */
export const TIPO_TOTAL_2026 = 0.315;

/** Redondeo al céntimo, mitad hacia arriba, operando en céntimos para no arrastrar error binario. */
function round2(n: number): number {
  return Math.round(Math.round(n * 1e6) / 1e4) / 100;
}

/** Cuota mensual = base × tipo total, redondeada al céntimo. */
export function cuotaDeBase(base: number, tipo: number = TIPO_TOTAL_2026): number {
  return round2(base * tipo);
}

export interface Tramo {
  tramo: number;
  /** Límite superior del rendimiento neto mensual del tramo (Infinity en el último). */
  hasta: number;
  /** ¿`hasta` cae dentro del tramo? Sí en todos salvo el 3 (ver LIMITE_TABLA_REDUCIDA). */
  hastaIncluido: boolean;
  /** Base mínima mensual 2026 del tramo, en EUR (Orden PJC/297/2026, art. 18.1). */
  baseMinima: number;
  /** Cuota mensual mínima 2026 del tramo, en EUR: baseMinima × TIPO_TOTAL_2026, redondeada. */
  cuota: number;
}

/** Límites de rendimiento y bases mínimas, tabla del art. 18.1 de la Orden PJC/297/2026. */
const TABLA_ART_18_1: Array<[number, number]> = [
  [670, 653.59],
  [900, 718.95],
  [1166.7, 849.67],
  [1300, 950.98],
  [1500, 960.78],
  [1700, 960.78],
  [1850, 1143.79],
  [2030, 1209.15],
  [2330, 1274.51],
  [2760, 1356.21],
  [3190, 1437.91],
  [3620, 1519.61],
  [4050, 1601.31],
  [6000, 1732.03],
  [Infinity, 1928.1],
];

/**
 * La tabla reducida acaba ANTES de 1.166,70 €: el art. 18.1 da el tramo 3 como «> 900 y < 1.166,70» y el
 * tramo 1 de la general como «≥ 1.166,70». Es el único límite de la tabla que no pertenece a su tramo.
 * Corregido el 11-nov-2026: hasta hoy un rendimiento de 1.166,70 € justos caía en el tramo 3 (267,65 €)
 * en vez del 4 (299,56 €), y el test lo daba por bueno.
 */
export const LIMITE_TABLA_REDUCIDA = 1166.7;

export const TRAMOS: Tramo[] = TABLA_ART_18_1.map(([hasta, baseMinima], i) => ({
  tramo: i + 1,
  hasta,
  hastaIncluido: hasta !== LIMITE_TABLA_REDUCIDA,
  baseMinima,
  cuota: cuotaDeBase(baseMinima),
}));

export function localizarTramo(rendimientoNetoMensual: number): Tramo {
  if (!isFinite(rendimientoNetoMensual) || rendimientoNetoMensual < 0) {
    throw new RangeError('El rendimiento neto mensual debe ser un número ≥ 0');
  }
  const r = rendimientoNetoMensual;
  return TRAMOS.find((t) => r < t.hasta || (r === t.hasta && t.hastaIncluido)) ?? TRAMOS[TRAMOS.length - 1];
}

export interface ResultadoCuotaAutonomos {
  tramo: Tramo;
  cuotaMensual: number;
  cuotaAnual: number;
}

export function calcularCuotaAutonomos(rendimientoNetoMensual: number): ResultadoCuotaAutonomos {
  const tramo = localizarTramo(rendimientoNetoMensual);
  return { tramo, cuotaMensual: tramo.cuota, cuotaAnual: round2(tramo.cuota * 12) };
}
