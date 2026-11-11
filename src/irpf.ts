/**
 * IRPF 2026: cuota íntegra estimada sobre la base liquidable general, tipo medio y tipo marginal.
 *
 * Fuentes oficiales:
 *  - Escala general (art. 63 LIRPF, gravamen estatal, y art. 74 LIRPF, gravamen autonómico de
 *    referencia). La escala ESTATAL 2026 es 9,50 / 12,00 / 15,00 / 18,50 / 22,50 / 24,50 % con
 *    tramos 12.450 / 20.200 / 35.200 / 60.000 / 300.000 € (AEAT, "Gravamen estatal", manual IRPF
 *    2025, vigente 2026 sin cambios estatales:
 *    https://sede.agenciatributaria.gob.es/Sede/ayuda/manuales-videos-folletos/manuales-practicos/irpf-2025/c15-calculo-impuesto-determinacion-cuotas-integras/gravamen-base-liquidable-general/gravamen-estatal.html).
 *    Esta calculadora usa la ESCALA GENERAL DE REFERENCIA agregada = estatal + autonómica ≈
 *    estatal × 2 = 19 / 24 / 30 / 37 / 45 / 47 % sobre los mismos tramos, una aproximación
 *    divulgativa estándar (la escala autonómica real de cada comunidad puede variar el resultado).
 *  - Mínimo del contribuyente (art. 57 LIRPF): 5.550 € general; 6.700 € si > 65 años
 *    (+1.150 €); 8.100 € si > 75 años (+1.400 € adicionales). AEAT, "Mínimo del contribuyente".
 *  - Tratamiento del mínimo personal y familiar (art. 63.1.2.º LIRPF): la cuota NO se obtiene
 *    restando el mínimo de la base y aplicando después la escala. Se aplica la escala a la base
 *    liquidable general y "la cuantía resultante se minorará en el importe derivado de aplicar a la
 *    parte de la base liquidable general correspondiente al mínimo personal y familiar esta misma
 *    escala" (AEAT, "Gravamen estatal"). Es decir: cuota = escala(base) − escala(mínimo). Para una
 *    escala progresiva NO es equivalente a escala(base − mínimo): esta última infravalora la cuota.
 *
 * Es una ESTIMACIÓN de la cuota sobre la base liquidable general: no incluye deducciones estatales
 * ni autonómicas, la base del ahorro, ni la escala autonómica exacta de la comunidad de residencia.
 * Esta aproximación de alcance se preserva; lo corregido respecto a la lógica inline previa de la
 * página es el tratamiento del mínimo (ver arriba) y el cálculo del tipo marginal sobre la base
 * liquidable general completa, no sobre "base − mínimo".
 *
 * Regla del repo: toda modificación de este archivo exige actualizar
 * tests/irpf.test.ts con la fuente oficial citada.
 */

import { calcularNomina } from './nomina.js';

export interface TramoIRPF {
  /** Límite superior de la base del tramo (Infinity en el último). */
  hasta: number;
  /** Tipo marginal del tramo (escala general de referencia = estatal + autonómica). */
  tipo: number;
}

/** Escala general de IRPF 2026 (estatal + autonómica de referencia), arts. 63 + 74 LIRPF. */
export const TRAMOS_IRPF: TramoIRPF[] = [
  { hasta: 12450, tipo: 0.19 },
  { hasta: 20200, tipo: 0.24 },
  { hasta: 35200, tipo: 0.3 },
  { hasta: 60000, tipo: 0.37 },
  { hasta: 300000, tipo: 0.45 },
  { hasta: Infinity, tipo: 0.47 },
];

/**
 * Tipos de la escala ESTATAL del art. 63.1 LIRPF, tramo a tramo con TRAMOS_IRPF (que es el
 * agregado estatal + autonómico de referencia). Contrastados en el BOE el 1-oct-2026: hasta el
 * 1-oct la página de cifras oficiales presentaba el agregado (19-47 %) como «la parte estatal», y no
 * lo es. Vivía dentro de esa página; desde el 11-nov-2026 está aquí para que la página y el dataset
 * de /datos/cifras-oficiales-2026/ lean la misma cifra.
 */
export const TIPOS_ESTATALES_ART63 = [0.095, 0.12, 0.15, 0.185, 0.225, 0.245];

/** Mínimo del contribuyente 2026 por edad (art. 57 LIRPF). */
export const MINIMOS_CONTRIBUYENTE = {
  /** General. */
  general: 5550,
  /** Mayor de 65 años (5.550 + 1.150). */
  mayor65: 6700,
  /** Mayor de 75 años (6.700 + 1.400). */
  mayor75: 8100,
} as const;

/**
 * Cuota íntegra por aplicación de la escala general sobre una base (importe ≥ 0).
 * Cada tramo tributa a su tipo solo por la parte de base que cae dentro de él.
 */
export function cuotaEscala(base: number): number {
  let cuota = 0;
  let anterior = 0;
  for (const tramo of TRAMOS_IRPF) {
    if (base <= anterior) break;
    cuota += (Math.min(base, tramo.hasta) - anterior) * tramo.tipo;
    anterior = tramo.hasta;
  }
  return cuota;
}

/** Tipo marginal aplicable a una base: el tipo del tramo más alto que alcanza. */
export function tipoMarginal(base: number): number {
  let marginal = 0;
  let anterior = 0;
  for (const tramo of TRAMOS_IRPF) {
    if (base <= anterior) break;
    marginal = tramo.tipo;
    anterior = tramo.hasta;
  }
  return marginal;
}

export interface EntradaIRPF {
  /** Base liquidable general en EUR (> 0). */
  baseLiquidable: number;
  /** Mínimo personal y familiar aplicable en EUR (≥ 0). Por defecto, el mínimo general. */
  minimoPersonal?: number;
}

export interface ResultadoIRPF {
  /** Mínimo efectivamente aplicado (acotado a la base liquidable general). */
  minimoAplicado: number;
  /** Cuota de aplicar la escala a la base liquidable general. */
  cuotaEscalaBase: number;
  /** Cuota de aplicar la escala al mínimo personal y familiar (parte exenta). */
  cuotaEscalaMinimo: number;
  /** Cuota íntegra estimada = escala(base) − escala(mínimo), nunca negativa. */
  cuota: number;
  /** Tipo medio = cuota / base liquidable general, en tanto por uno. */
  tipoMedio: number;
  /** Tipo marginal sobre la base liquidable general, en tanto por uno. */
  tipoMarginal: number;
}

export function calcularIRPF({
  baseLiquidable,
  minimoPersonal = MINIMOS_CONTRIBUYENTE.general,
}: EntradaIRPF): ResultadoIRPF {
  if (!isFinite(baseLiquidable) || baseLiquidable <= 0) {
    throw new RangeError('La base liquidable general debe ser un número > 0');
  }
  if (!isFinite(minimoPersonal) || minimoPersonal < 0) {
    throw new RangeError('El mínimo personal debe ser un número ≥ 0');
  }

  // Art. 63.1.2.º LIRPF: el mínimo se aplica sobre "la parte de la base liquidable general
  // correspondiente al mínimo", por lo que se acota a la propia base (si base < mínimo, cuota = 0).
  const minimoAplicado = Math.min(minimoPersonal, baseLiquidable);
  const cuotaEscalaBase = cuotaEscala(baseLiquidable);
  const cuotaEscalaMinimo = cuotaEscala(minimoAplicado);
  const cuota = Math.max(0, cuotaEscalaBase - cuotaEscalaMinimo);

  return {
    minimoAplicado,
    cuotaEscalaBase,
    cuotaEscalaMinimo,
    cuota,
    tipoMedio: cuota / baseLiquidable,
    tipoMarginal: tipoMarginal(baseLiquidable),
  };
}

/**
 * Qué tipo de retención pedir en la nómina para que la renta salga a cero.
 *
 * Por qué existe (14-oct-2026): la pregunta habitual es «qué % de IRPF me corresponde para dar
 * saldo 0». El tipo medio de arriba es cuota ÷ BASE LIQUIDABLE, pero la retención de la nómina se
 * aplica sobre el BRUTO, que siempre es mayor (antes de la base se restan cotizaciones, 2.000 € de
 * gastos y la reducción del art. 20 LIRPF). Poner en la nómina el tipo medio retiene de más.
 *
 * Fuente: RIRPF (RD 439/2007), art. 88.5, texto consolidado del BOE (última actualización
 * 07-10-2026, leído el 14-10-2026, https://www.boe.es/buscar/act.php?id=BOE-A-2007-6820): «Los
 * contribuyentes podrán solicitar en cualquier momento de sus correspondientes pagadores la
 * aplicación de tipos de retención superiores a los que resulten de lo previsto en los artículos
 * anteriores». Solo SUPERIORES: por eso `puedePedirse` es falso cuando el tipo necesario no supera
 * el que ya te aplican (la renta sale a devolver y no hay rebaja que pedir).
 *
 * Mismo alcance que `calcularIRPF`: sin deducciones, así que el tipo necesario es un techo.
 */
export interface EntradaSaldoCero {
  /** Cuota estimada del año en EUR (la de `calcularIRPF`). */
  cuota: number;
  /** Salario bruto anual en EUR (> 0), sobre el que se aplica la retención. */
  brutoAnual: number;
  /** Tipo de retención que figura en la nómina, en tanto por uno (0,15 = 15 %). */
  tipoRetencion: number;
}

export interface ResultadoSaldoCero {
  /** Lo que te retienen en el año: bruto × tipo. */
  retenido: number;
  /** Cuota − retenido. Positivo: la renta sale a pagar; negativo: a devolver. */
  saldo: number;
  /** Tipo exacto que deja el saldo en cero, en tanto por uno: cuota ÷ bruto. */
  tipoNecesario: number;
  /** El tipo necesario redondeado al punto entero superior (lo que se pide por escrito). */
  tipoAPedir: number;
  /** Art. 88.5 RIRPF: solo se pueden pedir tipos superiores al que ya se aplica. */
  puedePedirse: boolean;
}

export function retencionParaSaldoCero({ cuota, brutoAnual, tipoRetencion }: EntradaSaldoCero): ResultadoSaldoCero {
  if (!isFinite(cuota) || cuota < 0) throw new RangeError('La cuota debe ser un número ≥ 0');
  if (!isFinite(brutoAnual) || brutoAnual <= 0) throw new RangeError('El bruto anual debe ser un número > 0');
  if (!isFinite(tipoRetencion) || tipoRetencion < 0 || tipoRetencion >= 1) {
    throw new RangeError('El tipo de retención debe estar entre 0 y 1');
  }
  const retenido = brutoAnual * tipoRetencion;
  const tipoNecesario = cuota / brutoAnual;
  // Redondeo al entero superior con tolerancia: 18,00 % no debe convertirse en 19 % por coma flotante.
  const tipoAPedir = Math.ceil(tipoNecesario * 100 - 1e-9) / 100;
  return {
    retenido,
    saldo: cuota - retenido,
    tipoNecesario,
    tipoAPedir,
    puedePedirse: tipoAPedir > tipoRetencion,
  };
}

/**
 * Tabla «cuánto gano → qué tipo de IRPF pago», por salario BRUTO de un asalariado sin hijos.
 *
 * Por qué existe (17-oct-2026): la mayoría de las preguntas sobre el tipo son
 * según lo que se gana («tipo medio irpf para 54.000 brutos», «tipo marginal de irpf 70000 euros
 * anuales»). La gente pregunta por el BRUTO, no por la base liquidable, así que la fila es el
 * bruto y la base sale de `calcularNomina` (cotizaciones, 2.000 € de gastos del art. 19 y
 * reducción del art. 20 LIRPF). La cuota es la de `calcularIRPF`, la misma función de la
 * calculadora: la tabla y la herramienta no pueden dar cifras distintas.
 *
 * Si la base no supera el mínimo personal, la cuota es 0 y el euro siguiente tampoco tributa:
 * el marginal se da como 0 y `tributa` como falso (decir «19 %» con cuota cero confunde).
 */
export const BRUTOS_TABLA_IRPF = [
  15000, 18000, 20000, 25000, 30000, 35000, 40000, 50000, 60000, 70000, 100000, 300000,
];

export interface FilaTablaBruto {
  bruto: number;
  baseLiquidable: number;
  cuota: number;
  /** Cuota ÷ base liquidable, en tanto por uno. */
  tipoMedio: number;
  /** Tipo del último euro de base; 0 si la base no supera el mínimo. */
  tipoMarginal: number;
  /** Cuota ÷ bruto, en tanto por uno: lo que de verdad se lleva el IRPF del salario. */
  sobreBruto: number;
  tributa: boolean;
}

export function filaPorBruto(bruto: number, minimoPersonal: number = MINIMOS_CONTRIBUYENTE.general): FilaTablaBruto {
  const { baseLiquidableIRPF: baseLiquidable } = calcularNomina({ brutoAnual: bruto, pagas: 14 });
  const tributa = baseLiquidable > minimoPersonal;
  if (!tributa) {
    return { bruto, baseLiquidable, cuota: 0, tipoMedio: 0, tipoMarginal: 0, sobreBruto: 0, tributa };
  }
  const r = calcularIRPF({ baseLiquidable, minimoPersonal });
  return {
    bruto,
    baseLiquidable,
    cuota: r.cuota,
    tipoMedio: r.tipoMedio,
    tipoMarginal: r.tipoMarginal,
    sobreBruto: r.cuota / bruto,
    tributa,
  };
}

export function tablaPorBruto(brutos: number[] = BRUTOS_TABLA_IRPF): FilaTablaBruto[] {
  return brutos.map((b) => filaPorBruto(b));
}
