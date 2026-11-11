/**
 * Tipo de IVA aplicable a una reforma (10 % reducido o 21 % general), cuota y total con IVA.
 *
 * Cifra normativa: los tipos 10 % y 21 % y los tres requisitos del tipo reducido están fijados
 * por el art. 91.Uno.2.10º (tipo reducido a renovación/reparación de vivienda) y el art. 91.Uno.3
 * (límite del 40 % de materiales aportados por el ejecutor) de la Ley 37/1992 del IVA. El tipo
 * general del 21 % es el del art. 90.Uno. Estas referencias se citan en tests/iva-reforma.test.ts
 * y en la metodología de la propia página.
 *
 * El tipo reducido (10 %) se aplica si y solo si se cumplen a la vez los tres requisitos:
 *  1. vivienda de un particular destinada a uso particular,
 *  2. construida/rehabilitada hace más de 2 años,
 *  3. materiales aportados por la empresa ejecutora ≤ 40 % de la base imponible.
 * Si falla cualquiera, toda la operación tributa al 21 %.
 *
 * Regla del repo: toda modificación de este archivo exige actualizar
 * tests/iva-reforma.test.ts con el ejemplo resuelto de la página y la fuente oficial de los tipos.
 */

/** Tipo reducido de IVA para reforma de vivienda que cumple los 3 requisitos (art. 91.Uno.2.10º LIVA). */
export const IVA_REDUCIDO = 0.10;

/** Tipo general de IVA (art. 90.Uno LIVA). */
export const IVA_GENERAL = 0.21;

export interface DatosIvaReforma {
  /** Base imponible de la operación (sin IVA), en EUR. */
  base: number;
  /** ¿Es vivienda de un particular destinada a uso particular? */
  esViviendaParticular: boolean;
  /** ¿La vivienda se construyó o rehabilitó hace más de 2 años? */
  masDeDosAnios: boolean;
  /** ¿Los materiales aportados por la empresa ejecutora son ≤ 40 % de la base? */
  materialesHasta40: boolean;
}

export interface ResultadoIvaReforma {
  /** Tipo de IVA aplicable, como fracción (0,10 o 0,21). */
  tipo: number;
  /** true si se aplica el tipo reducido del 10 %. */
  aplicaReducido: boolean;
  /** Cuota de IVA, en EUR. */
  cuota: number;
  /** Total con IVA (base + cuota), en EUR. */
  total: number;
}

/**
 * Determina el tipo de IVA de la reforma y calcula la cuota y el total con IVA.
 *
 * @throws RangeError si la base imponible no es finita y > 0.
 */
export function calcularIvaReforma(datos: DatosIvaReforma): ResultadoIvaReforma {
  const { base, esViviendaParticular, masDeDosAnios, materialesHasta40 } = datos;

  if (!isFinite(base) || base <= 0) {
    throw new RangeError('La base imponible debe ser un número > 0');
  }

  const aplicaReducido = esViviendaParticular && masDeDosAnios && materialesHasta40;
  const tipo = aplicaReducido ? IVA_REDUCIDO : IVA_GENERAL;
  const cuota = base * tipo;

  return {
    tipo,
    aplicaReducido,
    cuota,
    total: base + cuota,
  };
}
