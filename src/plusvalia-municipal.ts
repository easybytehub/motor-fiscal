/**
 * Plusvalía municipal (IIVTNU) 2026: método objetivo y método real, con elección
 * automática del método menos gravoso, como permite la ley desde el RDL 26/2021.
 *
 * Fuente oficial:
 *  - Impuesto sobre el Incremento de Valor de los Terrenos de Naturaleza Urbana:
 *    arts. 104-110 del Texto Refundido de la Ley Reguladora de las Haciendas Locales
 *    (Real Decreto Legislativo 2/2004, de 5 de marzo, BOE-A-2004-4214).
 *  - Doble método de determinación de la base imponible (objetivo y real) y derecho
 *    del contribuyente a elegir el más favorable: art. 107 TRLHL en la redacción dada
 *    por el Real Decreto-ley 26/2021, de 8 de noviembre (BOE-A-2021-18276), que adaptó
 *    la ley a la STC 182/2021. La no sujeción cuando no hay incremento real de valor
 *    también deriva de esa reforma.
 *  - Tipo de gravamen: lo fija cada ayuntamiento en su ordenanza fiscal, con un máximo
 *    legal del 30 % (art. 108.1 TRLHL).
 *  - COEFICIENTES máximos del método objetivo (art. 107.4 TRLHL): son los aprobados por
 *    el Real Decreto-ley 8/2023, de 27 de diciembre (BOE-A-2023-26452), la "tabla 2024".
 *    Siguen VIGENTES en 2026: el RDL 16/2025, de 23 de diciembre, que pretendía subirlos
 *    hasta un 40 % en algunos tramos, NO fue convalidado por el Congreso y fue derogado
 *    el 27 de enero de 2026 (Resolución de 27-01-2026, BOE de 28-01-2026); tampoco se
 *    convalidó el intento previo (RDL 9/2024, para 2025). Cada ayuntamiento puede aplicar
 *    coeficientes iguales o inferiores a estos máximos en su ordenanza fiscal.
 *
 *  - Método real (art. 107.5 TRLHL): base = (precio de transmisión − precio de adquisición)
 *    × (valor catastral del suelo / valor catastral total del inmueble), ambos valores del
 *    recibo del IBI en la fecha de devengo. Sin el valor catastral total no se calcula el
 *    método real (no se aproxima la proporción con otros datos).
 *
 * Regla del repo: toda modificación de este archivo exige actualizar
 * tests/plusvalia-municipal.test.ts con la fuente oficial citada.
 */

/**
 * Coeficientes máximos del método objetivo por años (completos) de tenencia del terreno,
 * art. 107.4 TRLHL, tabla vigente en 2026 (aprobada por el RDL 8/2023). La clave es el
 * número de años completos transcurridos; 20 años o más usa COEFICIENTE_20_ANIOS_O_MAS.
 */
export const COEFICIENTES: Record<number, number> = {
  0: 0.15,
  1: 0.15,
  2: 0.14,
  3: 0.14,
  4: 0.16,
  5: 0.18,
  6: 0.19,
  7: 0.2,
  8: 0.19,
  9: 0.15,
  10: 0.12,
  11: 0.1,
  12: 0.09,
  13: 0.09,
  14: 0.09,
  15: 0.09,
  16: 0.1,
  17: 0.13,
  18: 0.17,
  19: 0.23,
};

/** Coeficiente aplicable a 20 o más años de tenencia (art. 107.4 TRLHL, tabla 2026). */
export const COEFICIENTE_20_ANIOS_O_MAS = 0.4;

/** Tipo de gravamen máximo legal, en porcentaje (art. 108.1 TRLHL). */
export const TIPO_GRAVAMEN_MAXIMO_LEGAL = 30;

/**
 * Coeficiente del método objetivo para unos años de tenencia dados.
 * Con 1 año o más se toman los años completos (parte entera); 20 o más → último tramo.
 *
 * Menos de 1 año (art. 107.4 TRLHL): «En el caso de que el periodo de generación sea
 * inferior a un año, se prorrateará el coeficiente anual teniendo en cuenta el número de
 * meses completos». Coeficiente = COEFICIENTES[0] × mesesCompletos / 12; 0 meses → 0.
 * Los meses completos se toman de `mesesTenencia` si se indica (parte entera, 0-11); si
 * no, de la fracción de año de `aniosTenencia` (p. ej. 0,5 años → 6 meses).
 */
export function coeficientePorAnios(aniosTenencia: number, mesesTenencia?: number): number {
  if (!isFinite(aniosTenencia) || aniosTenencia < 0) {
    throw new RangeError('Los años de tenencia deben ser un número ≥ 0');
  }
  const a = Math.floor(aniosTenencia);
  if (a >= 20) return COEFICIENTE_20_ANIOS_O_MAS;
  if (a >= 1) return COEFICIENTES[a];
  let meses: number;
  if (mesesTenencia != null) {
    if (!isFinite(mesesTenencia) || mesesTenencia < 0) {
      throw new RangeError('Los meses de tenencia deben ser un número ≥ 0');
    }
    meses = Math.floor(mesesTenencia);
  } else {
    // Tolerancia para fracciones como 0,5 × 12 que en coma flotante quedan en 5,999…
    meses = Math.floor(aniosTenencia * 12 + 1e-9);
  }
  if (meses >= 12) return COEFICIENTES[1];
  return (COEFICIENTES[0] * meses) / 12;
}

/** Método aplicado en el resultado final. */
export type MetodoPlusvalia = 'objetivo' | 'real' | 'no-sujeto';

export interface DatosPlusvalia {
  /** Valor catastral del suelo en el momento de la transmisión, en EUR. */
  valorCatastralSuelo: number;
  /** Años de tenencia del inmueble (se usan los años completos). */
  aniosTenencia: number;
  /**
   * Meses completos de tenencia, solo relevante si aniosTenencia < 1: el coeficiente se
   * prorratea por meses completos (art. 107.4 TRLHL). Opcional.
   */
  mesesTenencia?: number;
  /** Tipo de gravamen municipal, en PORCENTAJE (p. ej. 30 para el 30 %). */
  tipoGravamen: number;
  /**
   * Valor catastral TOTAL del inmueble (suelo + construcción, recibo del IBI), en EUR.
   * Opcional: sin él no se calcula el método real (art. 107.5 TRLHL).
   */
  valorCatastralTotal?: number;
  /** Precio de compra, en EUR. Opcional: sin él no se calcula el método real. */
  precioCompra?: number;
  /** Precio de venta, en EUR. Opcional: sin él no se calcula el método real. */
  precioVenta?: number;
}

export interface ResultadoPlusvalia {
  /** Coeficiente del método objetivo aplicado (art. 107.4 TRLHL). */
  coeficiente: number;
  /** Base imponible del método objetivo = valor catastral del suelo × coeficiente. */
  baseObjetivo: number;
  /** Cuota del método objetivo = base objetivo × tipo de gravamen. */
  cuotaObjetivo: number;
  /**
   * true si se puede calcular el método real: precio de compra, precio de venta y valor
   * catastral total válidos.
   */
  hayDatosReal: boolean;
  /**
   * true si hay compraventa con ganancia pero falta el valor catastral total: el método real
   * no se calcula y el resultado sale solo por el objetivo.
   */
  faltaCatastralTotal: boolean;
  /** true si no hay incremento real de valor (venta ≤ compra) → no sujeción. */
  sinIncrementoReal: boolean;
  /** Proporción del suelo del método real: catastral suelo / catastral total, acotada a 1. */
  proporcionSuelo: number;
  /** Base imponible del método real = ganancia × proporción del suelo. */
  baseReal: number;
  /** Cuota del método real = base real × tipo de gravamen. */
  cuotaReal: number;
  /** Método aplicado (el menos gravoso, o no sujeción). */
  metodo: MetodoPlusvalia;
  /** Cuota final a pagar, en EUR. */
  cuotaFinal: number;
}

/**
 * Calcula la plusvalía municipal por ambos métodos y devuelve el resultado con el
 * método menos gravoso aplicado (o no sujeción si no hay incremento real de valor).
 */
export function calcularPlusvalia(datos: DatosPlusvalia): ResultadoPlusvalia {
  const {
    valorCatastralSuelo,
    valorCatastralTotal,
    aniosTenencia,
    mesesTenencia,
    tipoGravamen,
    precioCompra,
    precioVenta,
  } = datos;

  if (!isFinite(valorCatastralSuelo) || valorCatastralSuelo < 0) {
    throw new RangeError('El valor catastral del suelo debe ser un número ≥ 0');
  }
  if (!isFinite(tipoGravamen) || tipoGravamen < 0) {
    throw new RangeError('El tipo de gravamen debe ser un número ≥ 0');
  }

  const tipo = tipoGravamen / 100;

  // --- Método objetivo (art. 107.4 TRLHL) ---
  const coeficiente = coeficientePorAnios(aniosTenencia, mesesTenencia);
  const baseObjetivo = valorCatastralSuelo * coeficiente;
  const cuotaObjetivo = baseObjetivo * tipo;

  // --- Método real (art. 107.5 TRLHL) ---
  const hayCompraventa =
    precioCompra != null &&
    isFinite(precioCompra) &&
    precioCompra > 0 &&
    precioVenta != null &&
    isFinite(precioVenta) &&
    precioVenta > 0;
  const hayCatastralTotal =
    valorCatastralTotal != null && isFinite(valorCatastralTotal) && valorCatastralTotal > 0;

  let proporcionSuelo = 0;
  let baseReal = 0;
  let cuotaReal = 0;
  let sinIncrementoReal = false;
  let hayDatosReal = false;
  let faltaCatastralTotal = false;

  if (hayCompraventa) {
    const ganancia = (precioVenta as number) - (precioCompra as number);
    if (ganancia <= 0) {
      // No sujeción por inexistencia de incremento de valor (art. 104.5 TRLHL, RDL 26/2021).
      // No necesita el valor catastral total.
      sinIncrementoReal = true;
    } else if (hayCatastralTotal) {
      hayDatosReal = true;
      // Art. 107.5: proporción del valor catastral del suelo sobre el valor catastral total.
      proporcionSuelo = Math.min(1, valorCatastralSuelo / (valorCatastralTotal as number));
      baseReal = ganancia * proporcionSuelo;
      cuotaReal = baseReal * tipo;
    } else {
      faltaCatastralTotal = true;
    }
  }

  // --- Elección del método menos gravoso ---
  let metodo: MetodoPlusvalia;
  let cuotaFinal: number;

  if (sinIncrementoReal) {
    metodo = 'no-sujeto';
    cuotaFinal = 0;
  } else if (hayDatosReal) {
    if (cuotaReal <= cuotaObjetivo) {
      metodo = 'real';
      cuotaFinal = cuotaReal;
    } else {
      metodo = 'objetivo';
      cuotaFinal = cuotaObjetivo;
    }
  } else {
    metodo = 'objetivo';
    cuotaFinal = cuotaObjetivo;
  }

  return {
    coeficiente,
    baseObjetivo,
    cuotaObjetivo,
    hayDatosReal,
    faltaCatastralTotal,
    sinIncrementoReal,
    proporcionSuelo,
    baseReal,
    cuotaReal,
    metodo,
    cuotaFinal,
  };
}
