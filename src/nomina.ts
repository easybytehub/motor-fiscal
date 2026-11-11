/**
 * Nómina 2026: del salario bruto anual al neto (cotización del trabajador + retención IRPF estimada).
 *
 * Fuentes oficiales 2026:
 *  - Cotización del trabajador (régimen general, contrato indefinido): Orden PJC/297/2026, de 30 de
 *    marzo (BOE-A-2026-7296): contingencias comunes 4,70 % + desempleo 1,55 % + formación 0,10 %
 *    + MEI 0,15 % (parte del trabajador del 0,90 % total del MEI 2026) = 6,50 %. Base máxima de
 *    cotización 2026: 5.101,20 €/mes → 61.214,40 €/año.
 *  - IRPF: escala general de referencia (estatal + autonómica estándar) 19/24/30/37/45/47 %
 *    vigente desde 2021 y sin cambios para 2026 (art. 63 LIRPF + escala autonómica de referencia,
 *    art. 65). Gastos deducibles generales 2.000 €/año (art. 19.2.f LIRPF). Reducción por obtención
 *    de rendimientos del trabajo por tramos (art. 20 LIRPF, redacción vigente 2025-2026). Mínimo del
 *    contribuyente 5.550 € (art. 57) y mínimo por primer descendiente 2.400 € (art. 58).
 *
 *  - Límites del algoritmo de retención (AEAT, ALGORITMO_2026.pdf): límite excluyente de la Tabla 1,
 *    situación 3 (15.876 € sin hijos, 16.342 € con 1 hijo; art. 81 RIRPF) y límite del 43 % para
 *    retribuciones hasta 35.200 € (art. 85.3 RIRPF). Sin ellos la retención salía inflada en
 *    salarios bajos: 591 € en vez de ~524 € con el SMI (17.094 €), 1.034 € en vez de ~913 € con
 *    18.000 €, 2.044 € en vez de ~1.773 € con 20.000 € (auditoría del 1-oct-2026).
 *  - Cotización adicional de solidaridad 2026 sobre el exceso de la base máxima (Orden PJC/297/2026,
 *    art. 17.1), parte del trabajador 0,19/0,21/0,24 %.
 *
 * Es una ESTIMACIÓN del algoritmo de retención, no una réplica del programa de la AEAT: aplica la
 * escala general de referencia sobre una base simplificada y no recoge todas las circunstancias
 * personales ni la escala autonómica exacta. Esta aproximación se preserva deliberadamente; lo único
 * corregido respecto a la lógica inline previa de la página es la reducción del art. 20, que debe
 * aplicar tres tramos (ver REDUCCION_TRABAJO). La versión inline usaba el coeficiente 1,75 en todo el
 * rango 14.852-19.747,5 €, lo que producía reducciones demasiado pequeñas e incluso negativas
 * (sobrestimando el IRPF) para rendimientos previos de ~17.673,52 a 19.747,5 €.
 *
 * Regla del repo: toda modificación de este archivo exige actualizar
 * tests/nomina.test.ts con la fuente oficial citada.
 */

/** Tipos de cotización a cargo del trabajador (régimen general, contrato indefinido), 2026. */
export const SS_CONTINGENCIAS_COMUNES = 0.047;
export const SS_DESEMPLEO = 0.0155;
export const SS_FORMACION = 0.001;
export const SS_MEI = 0.0015;
/** Total cotización del trabajador: 6,50 %. */
export const SS_TOTAL = SS_CONTINGENCIAS_COMUNES + SS_DESEMPLEO + SS_FORMACION + SS_MEI;

/** Base máxima de cotización 2026: 5.101,20 €/mes (Orden PJC/297/2026, art. 3). */
export const BASE_MAX_MENSUAL = 5101.2;
/** Base máxima de cotización 2026: 5.101,20 €/mes × 12 = 61.214,40 €/año (Orden PJC/297/2026). */
export const BASE_MAX_ANUAL = 61214.4;

export interface TramoSolidaridad {
  /** Límite superior MENSUAL de retribución del tramo (Infinity en el último). */
  hasta: number;
  /** Tipo a cargo de la empresa (fracción). */
  empresa: number;
  /** Tipo a cargo del trabajador (fracción). */
  trabajador: number;
}

/**
 * Cotización adicional de solidaridad 2026 (art. 19 bis LGSS; Orden PJC/297/2026, art. 17.1):
 * se aplica sobre la parte de la retribución MENSUAL que excede la base máxima (5.101,20 €):
 *  - de 5.101,21 a 5.611,32 € (hasta el 110 % de la base máxima): 1,15 % → 0,96 % empresa + 0,19 % trabajador
 *  - de 5.611,33 a 7.651,80 € (hasta el 150 %):                    1,25 % → 1,04 % empresa + 0,21 % trabajador
 *  - por encima de 7.651,80 €:                                      1,46 % → 1,22 % empresa + 0,24 % trabajador
 */
export const TRAMOS_SOLIDARIDAD: TramoSolidaridad[] = [
  { hasta: 5611.32, empresa: 0.0096, trabajador: 0.0019 },
  { hasta: 7651.8, empresa: 0.0104, trabajador: 0.0021 },
  { hasta: Infinity, empresa: 0.0122, trabajador: 0.0024 },
];

/**
 * Cuota de solidaridad ANUAL (empresa o trabajador) para un bruto anual. Supuesto: el bruto se
 * cobra en 12 mensualidades iguales (pagas extra prorrateadas), así que se calcula sobre
 * bruto ÷ 12 y se multiplica por 12. Con pagas extra sin prorratear o retribuciones variables la
 * cuota real puede diferir algo, porque el exceso se mide mes a mes.
 */
export function cuotaSolidaridadAnual(brutoAnual: number, parte: 'empresa' | 'trabajador'): number {
  const mensual = brutoAnual / 12;
  let cuota = 0;
  let anterior = BASE_MAX_MENSUAL;
  for (const tramo of TRAMOS_SOLIDARIDAD) {
    if (mensual <= anterior) break;
    cuota += (Math.min(mensual, tramo.hasta) - anterior) * tramo[parte];
    anterior = tramo.hasta;
  }
  return cuota * 12;
}

/** Gastos deducibles generales del trabajo, art. 19.2.f LIRPF. */
export const GASTOS_DEDUCIBLES = 2000;

/** Mínimo del contribuyente (art. 57 LIRPF). */
export const MINIMO_CONTRIBUYENTE = 5550;
/** Mínimo por el primer descendiente (art. 58 LIRPF). */
export const MINIMO_PRIMER_DESCENDIENTE = 2400;

/**
 * Límite excluyente de retención 2026 (art. 81 RIRPF; algoritmo AEAT 2026, Tabla 1, situación 3:
 * contribuyente sin cónyuge a cargo ni situación monoparental): por debajo de esta retribución
 * íntegra anual NO se practica retención. 'general' = 0 hijos; 'hijos' = 1 hijo.
 */
export const LIMITE_EXCLUYENTE: Record<SituacionPersonal, number> = {
  general: 15876,
  hijos: 16342,
};

/**
 * Límite del 43 % (art. 85.3 RIRPF; algoritmo AEAT 2026): si la retribución íntegra no supera
 * 35.200 €, la cuota de retención no puede exceder el 43 % de la diferencia entre esa retribución
 * y el límite excluyente que corresponda.
 */
export const LIMITE_43_RETRIB = 35200;
export const LIMITE_43_TIPO = 0.43;

export interface TramoIRPF {
  /** Límite superior de base liquidable del tramo (Infinity en el último). */
  hasta: number;
  /** Tipo marginal del tramo (escala general de referencia). */
  tipo: number;
}

/** Escala general de IRPF 2026 (estatal + autonómica de referencia), art. 63 + 65 LIRPF. */
export const TRAMOS_IRPF: TramoIRPF[] = [
  { hasta: 12450, tipo: 0.19 },
  { hasta: 20200, tipo: 0.24 },
  { hasta: 35200, tipo: 0.3 },
  { hasta: 60000, tipo: 0.37 },
  { hasta: 300000, tipo: 0.45 },
  { hasta: Infinity, tipo: 0.47 },
];

export type SituacionPersonal = 'general' | 'hijos';

/**
 * Reducción por obtención de rendimientos del trabajo (art. 20 LIRPF, vigente 2025-2026), por tramos:
 *  - RN ≤ 14.852 €:                 7.302 €
 *  - 14.852 < RN ≤ 17.673,52 €:     7.302 − 1,75 × (RN − 14.852)
 *  - 17.673,52 < RN ≤ 19.747,5 €:   2.364,34 − 1,14 × (RN − 17.673,52)
 *  - RN > 19.747,5 €:               0 €
 * Los tramos encajan por continuidad: en 17.673,52 el segundo tramo da 2.364,34 y en 19.747,5 el
 * tercero da 0. Nunca es negativa.
 */
export function reduccionRendimientosTrabajo(rendimientoNeto: number): number {
  if (rendimientoNeto <= 14852) return 7302;
  if (rendimientoNeto <= 17673.52) return 7302 - 1.75 * (rendimientoNeto - 14852);
  if (rendimientoNeto <= 19747.5) return 2364.34 - 1.14 * (rendimientoNeto - 17673.52);
  return 0;
}

/** Cuota íntegra por aplicación de la escala general de IRPF sobre una base liquidable. */
export function irpfPorTramos(base: number): number {
  let cuota = 0;
  let anterior = 0;
  for (const tramo of TRAMOS_IRPF) {
    if (base <= anterior) break;
    const tramoBase = Math.min(base, tramo.hasta) - anterior;
    cuota += tramoBase * tramo.tipo;
    anterior = tramo.hasta;
  }
  return cuota;
}

export interface EntradaNomina {
  /** Salario bruto anual en EUR. */
  brutoAnual: number;
  /** Número de pagas (habitualmente 12 o 14). */
  pagas: number;
  /** Situación personal: 'general' o 'hijos' (aplica el mínimo por primer descendiente). */
  situacion?: SituacionPersonal;
}

export interface ResultadoNomina {
  /** Cotización a la Seguridad Social a cargo del trabajador (6,50 % de la base topada + cuota de solidaridad). */
  cotizacionSeguridadSocial: number;
  /** Base sujeta a IRPF tras gastos deducibles y reducción por rendimientos del trabajo. */
  baseLiquidableIRPF: number;
  /** Retención de IRPF estimada (nunca negativa). */
  retencionIRPF: number;
  /** Tipo efectivo de IRPF sobre el bruto, en %. */
  tipoEfectivoIRPF: number;
  /** Neto anual (bruto − SS − IRPF). */
  netoAnual: number;
  /** Neto por paga (neto anual ÷ nº de pagas). */
  netoPorPaga: number;
}

/**
 * Cotización a la Seguridad Social del trabajador sobre el bruto anual: 6,50 % de la base topada a
 * la base máxima, más su parte de la cotización adicional de solidaridad sobre el exceso
 * (0,19/0,21/0,24 %, ver TRAMOS_SOLIDARIDAD; supuesto de 12 mensualidades iguales). No se modela la
 * base mínima: depende del grupo de cotización, que la página no pide.
 */
export function cotizacionSeguridadSocial(brutoAnual: number): number {
  return Math.min(brutoAnual, BASE_MAX_ANUAL) * SS_TOTAL + cuotaSolidaridadAnual(brutoAnual, 'trabajador');
}

/**
 * Límites de la cuota de retención del algoritmo AEAT 2026: 0 si la retribución no supera el límite
 * excluyente (art. 81 RIRPF) y, hasta 35.200 €, como máximo el 43 % del exceso sobre ese límite
 * (art. 85.3 RIRPF).
 */
export function aplicarLimitesRetencion(cuota: number, retrib: number, situacion: SituacionPersonal): number {
  const excluyente = LIMITE_EXCLUYENTE[situacion];
  if (retrib <= excluyente) return 0;
  if (retrib <= LIMITE_43_RETRIB) return Math.min(cuota, (retrib - excluyente) * LIMITE_43_TIPO);
  return cuota;
}

export function calcularNomina({ brutoAnual, pagas, situacion = 'general' }: EntradaNomina): ResultadoNomina {
  if (!isFinite(brutoAnual) || brutoAnual <= 0) {
    throw new RangeError('El salario bruto anual debe ser un número > 0');
  }
  if (!isFinite(pagas) || pagas <= 0) {
    throw new RangeError('El número de pagas debe ser un número > 0');
  }

  const cotizacion = cotizacionSeguridadSocial(brutoAnual);

  // Estimación cercana al algoritmo de retención (método de las dos bases): el rendimiento neto
  // previo (bruto − SS) determina la reducción del art. 20; la base liquidable resta también los
  // 2.000 € de gastos (art. 19). La cuota íntegra se minora en la cuota del mínimo personal/familiar.
  const rendimientoPrevio = brutoAnual - cotizacion;
  const reduccion = reduccionRendimientosTrabajo(rendimientoPrevio);
  const baseLiquidable = Math.max(0, brutoAnual - cotizacion - GASTOS_DEDUCIBLES - reduccion);

  const minimo =
    situacion === 'hijos'
      ? MINIMO_CONTRIBUYENTE + MINIMO_PRIMER_DESCENDIENTE
      : MINIMO_CONTRIBUYENTE;

  const cuota = Math.max(0, irpfPorTramos(baseLiquidable) - irpfPorTramos(minimo));
  const retencion = aplicarLimitesRetencion(cuota, brutoAnual, situacion);

  const netoAnual = brutoAnual - cotizacion - retencion;

  return {
    cotizacionSeguridadSocial: cotizacion,
    baseLiquidableIRPF: baseLiquidable,
    retencionIRPF: retencion,
    tipoEfectivoIRPF: (retencion / brutoAnual) * 100,
    netoAnual,
    netoPorPaga: netoAnual / pagas,
  };
}

/* ------------------------------------------------------------------------------------------
 * Del neto al bruto (19-oct-2026). «Cuál es el importe bruto para una nómina de 600 euros»,
 * «cuánto es en bruto 1500 euros netos» y sus variantes: la pregunta inversa. No hay fórmula cerrada (la reducción del art. 20, el mínimo y el
 * límite del 43 % hacen la retención a trozos), así que se invierte `calcularNomina` buscando el
 * bruto: con las mismas tablas, la ida y la vuelta no pueden discrepar. El neto anual crece con el
 * bruto en todo el rango (la pendiente más baja, dentro del límite del 43 %, es 1 − 0,065 − 0,43),
 * así que la bisección converge a un único bruto.
 * ---------------------------------------------------------------------------------------- */

export interface EntradaNetoABruto {
  /** Neto que se quiere cobrar en cada paga, en EUR. */
  netoPorPaga: number;
  pagas: number;
  situacion?: SituacionPersonal;
}

export interface ResultadoNetoABruto extends ResultadoNomina {
  brutoAnual: number;
  /** Bruto de cada paga (bruto anual ÷ nº de pagas). */
  brutoPorPaga: number;
}

/**
 * Bruto anual que deja `netoPorPaga` netos en cada una de `pagas` pagas, con el mismo cálculo que
 * `calcularNomina`. Precisión: un céntimo de neto anual.
 */
export function brutoDesdeNeto({ netoPorPaga, pagas, situacion = 'general' }: EntradaNetoABruto): ResultadoNetoABruto {
  if (!isFinite(netoPorPaga) || netoPorPaga <= 0) {
    throw new RangeError('El neto por paga debe ser un número > 0');
  }
  if (!isFinite(pagas) || pagas <= 0) {
    throw new RangeError('El número de pagas debe ser un número > 0');
  }
  const objetivo = netoPorPaga * pagas;
  // El bruto nunca es menor que el neto, y por debajo del 53 % de tipo marginal conjunto (47 % de
  // IRPF + cotización solo hasta la base máxima) el doble del neto + 100.000 € siempre lo cubre.
  let lo = objetivo;
  let hi = objetivo * 2 + 100000;
  const neto = (b: number) => calcularNomina({ brutoAnual: b, pagas, situacion }).netoAnual;
  for (let i = 0; i < 200 && hi - lo > 0.001; i++) {
    const mid = (lo + hi) / 2;
    if (neto(mid) < objetivo) lo = mid;
    else hi = mid;
  }
  const brutoAnual = Math.round(hi * 100) / 100;
  return { ...calcularNomina({ brutoAnual, pagas, situacion }), brutoAnual, brutoPorPaga: brutoAnual / pagas };
}

/**
 * Franja de bruto anual en la que manda el límite del 43 % (art. 85.3 RIRPF): la retención es
 * exactamente el 43 % del exceso sobre el límite excluyente. Se busca euro a euro con la misma
 * cuenta de `calcularNomina`; devuelve [primer, último] bruto entero de la franja.
 */
export function franjaLimite43(situacion: SituacionPersonal = 'general'): [number, number] {
  const excl = LIMITE_EXCLUYENTE[situacion];
  let desde = 0;
  let hasta = 0;
  for (let b = Math.ceil(excl) + 1; b <= LIMITE_43_RETRIB; b++) {
    const r = calcularNomina({ brutoAnual: b, pagas: 12, situacion });
    const manda = Math.abs(r.retencionIRPF - (b - excl) * LIMITE_43_TIPO) < 0.005;
    if (manda && !desde) desde = b;
    if (manda) hasta = b;
  }
  return [desde, hasta];
}
