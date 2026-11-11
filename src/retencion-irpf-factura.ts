/**
 * Retención de IRPF en factura de autónomo/profesional 2026.
 *
 * Calcula el total a cobrar de una factura a partir de la base imponible:
 * suma la cuota de IVA repercutido y resta la retención de IRPF a cuenta que
 * el pagador retiene e ingresa en Hacienda a nombre del profesional.
 *
 *   Total a cobrar = Base imponible + Cuota de IVA − Retención de IRPF
 *
 * Fuente oficial de los tipos de retención (rendimientos de actividades
 * profesionales):
 *  - Art. 101.5.a) de la Ley 35/2006 del IRPF (BOE-A-2006-20764) y art. 95 del
 *    Reglamento del IRPF (RD 439/2007, BOE-A-2007-6820): 15 % con carácter
 *    general; 7 % para profesionales de nuevo inicio (período impositivo de
 *    inicio de la actividad y los dos siguientes), siempre que no hubieran
 *    ejercido actividad profesional en el año anterior al alta.
 *  - AEAT, "Cuadro de tipos de retención IRPF 2026" y Manual práctico de
 *    Actividades Económicas (apartado 7.1): confirma 15 % general y 7 % nuevo
 *    inicio para actividades profesionales.
 * Tipo general de IVA 21 %: art. 90.Uno de la Ley 37/1992 del IVA
 * (BOE-A-1992-28740). Una factura puede estar exenta de IVA (0 %) según los
 * arts. 20 y ss. de la misma ley.
 *
 * Regla del repo: toda modificación de este archivo exige
 * actualizar tests/retencion-irpf-factura.test.ts con la fuente oficial citada.
 */

/** Tipo de retención de IRPF a cuenta en actividades profesionales (art. 101.5.a LIRPF). */
export type TipoRetencion = 'general' | 'nuevo';

/** Tipos de retención de IRPF sobre la base imponible (2026), en tanto por uno. */
export const RETENCIONES: Record<TipoRetencion, number> = {
  /** 15 % — actividades profesionales, régimen general. */
  general: 0.15,
  /** 7 % — profesionales de nuevo inicio (año de alta y los dos siguientes). */
  nuevo: 0.07,
};

/** Tipo general de IVA (art. 90.Uno Ley 37/1992), en tanto por uno. */
export const IVA_GENERAL = 0.21;

/**
 * Tipos de IVA vigentes en 2026, en tanto por uno. Fuente: Ley 37/1992 del IVA
 * (BOE-A-1992-28740), art. 90.Uno (general 21 %), art. 91.Uno (reducido 10 %) y
 * art. 91.Dos (superreducido 4 %). El 0 % cubre las operaciones exentas de los
 * arts. 20 y ss. y las no sujetas.
 *
 * Existen desde 2026 (art. 91.Uno.2.10º) obras de renovación y reparación de
 * vivienda al 10 %, que es el caso más común de factura reducida en reforma —
 * el mismo tipo que ya usa `iva-reforma.ts`.
 */
export const TIPOS_IVA = {
  general: 0.21,
  reducido: 0.10,
  superreducido: 0.04,
  exento: 0,
} as const;

export interface DatosFactura {
  /** Base imponible de la factura, en EUR (≥ 0). */
  base: number;
  /** Tipo de IVA aplicable, en tanto por uno (p. ej. 0.21 general o 0 exento). */
  tipoIva: number;
  /**
   * Tipo de retención de IRPF, en tanto por uno (p. ej. 0.15 o 0.07).
   *
   * **0 es un valor legítimo y frecuente, no un caso degenerado**: no hay
   * retención cuando el pagador es un particular (no actúa como retenedor,
   * art. 76.1 RD 439/2007), cuando se factura una entrega de bienes en lugar de
   * una actividad profesional, o cuando el destinatario está fuera del ámbito
   * de retención. Hasta el 3-ago la interfaz no permitía este caso y devolvía un
   * total incorrecto para quien simplemente quería base + IVA.
   */
  tipoRetencion: number;
}

export interface ResultadoFactura {
  /** Base imponible, en EUR. */
  base: number;
  /** Cuota de IVA repercutido (base × tipoIva), en EUR. */
  cuotaIva: number;
  /** Retención de IRPF practicada (base × tipoRetencion), en EUR. */
  retencion: number;
  /** Total a cobrar: base + cuotaIva − retencion, en EUR. */
  totalACobrar: number;
}

/**
 * Calcula el desglose de una factura con IVA y retención de IRPF.
 *
 * @throws RangeError si la base o los tipos no son números finitos válidos.
 */
export function calcularFactura({ base, tipoIva, tipoRetencion }: DatosFactura): ResultadoFactura {
  if (!isFinite(base) || base < 0) {
    throw new RangeError('La base imponible debe ser un número ≥ 0');
  }
  if (!isFinite(tipoIva) || tipoIva < 0) {
    throw new RangeError('El tipo de IVA debe ser un número ≥ 0');
  }
  if (!isFinite(tipoRetencion) || tipoRetencion < 0) {
    throw new RangeError('El tipo de retención debe ser un número ≥ 0');
  }

  const cuotaIva = base * tipoIva;
  const retencion = base * tipoRetencion;
  const totalACobrar = base + cuotaIva - retencion;

  return { base, cuotaIva, retencion, totalACobrar };
}
