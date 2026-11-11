/**
 * Coste total de un trabajador para la empresa (régimen general) — tipos 2026.
 *
 * El coste de empresa es el salario bruto anual MÁS la cotización a la Seguridad Social a
 * cargo de la empresa, que corre íntegramente por cuenta del empleador (no se descuenta de
 * la nómina del trabajador) y se calcula sobre la base de cotización.
 *
 * Fuente oficial: Orden PJC/297/2026, de 30 de marzo, por la que se desarrollan las normas
 * legales de cotización a la Seguridad Social, desempleo, protección por cese de actividad,
 * FOGASA y formación profesional para 2026 (BOE-A-2026-7296, BOE de 31 de marzo de 2026).
 * Tipos a cargo de la EMPRESA en régimen general, 2026:
 *  - Contingencias comunes: 23,60 % (tipo total 28,30 %; 4,70 % a cargo del trabajador).
 *  - Desempleo: 5,50 % en contrato indefinido y 6,70 % en contrato de duración determinada
 *    (tipos totales 7,05 % y 8,30 % respectivamente).
 *  - FOGASA (Fondo de Garantía Salarial): 0,20 % (íntegro a cargo de la empresa).
 *  - Formación profesional: 0,60 % (tipo total 0,70 %; 0,10 % a cargo del trabajador).
 *  - MEI (Mecanismo de Equidad Intergeneracional): 0,75 % (tipo total 0,90 %; 0,15 % del
 *    trabajador) — art. 127 bis LGSS, cuantía fijada en la Orden PJC/297/2026 para 2026.
 *  - AT/EP (accidentes de trabajo y enfermedades profesionales): NO tiene tipo único; depende
 *    de la tarifa de primas asociada al epígrafe CNAE de la actividad (DA 4.ª Ley 42/2006, en
 *    su redacción vigente). Aquí se aplica un valor ORIENTATIVO del 1,50 % (tarifa media
 *    aproximada); el tipo real de cada empresa lo fija la TGSS según su código CNAE.
 *
 * Base de cotización: el salario bruto anual total (incluidas pagas extra), TOPADO a la base
 * máxima 2026 de 5.101,20 €/mes (61.214,40 €/año, Orden PJC/297/2026). Sobre la parte de la
 * retribución mensual que excede ese tope no se cotiza por los conceptos ordinarios sino la
 * cotización adicional de solidaridad (art. 19 bis LGSS; Orden PJC/297/2026, art. 17.1), cuya
 * parte empresarial es 0,96 % / 1,04 % / 1,22 % por tramos (ver TRAMOS_SOLIDARIDAD en nomina.ts).
 * Supuesto: 12 mensualidades iguales (pagas extra prorrateadas): se calcula sobre bruto ÷ 12.
 * No se aplica la base mínima: depende del grupo de cotización, que la página no pide.
 *
 * FIX 1-oct-2026: antes los tipos se aplicaban al bruto entero sin tope. Con 80.000 € la
 * cotización empresarial salía 25.720 € en vez de ~19.871 €.
 *
 * Regla del repo: toda modificación de este archivo exige actualizar
 * tests/coste-empresa.test.ts con la fuente oficial citada.
 */
import { pct as pctES } from './format.js';
import { BASE_MAX_ANUAL, cuotaSolidaridadAnual } from './nomina.js';

export type TipoContrato = 'indefinido' | 'temporal';

/** Tipos de cotización a cargo de la EMPRESA, régimen general 2026 (fracción, no %). */
export const TIPOS_EMPRESA = {
  /** Contingencias comunes: 23,60 %. */
  contingenciasComunes: 0.236,
  /** Desempleo, contrato indefinido: 5,50 %. */
  desempleoIndefinido: 0.055,
  /** Desempleo, contrato de duración determinada: 6,70 %. */
  desempleoTemporal: 0.067,
  /** FOGASA (Fondo de Garantía Salarial): 0,20 %. */
  fogasa: 0.002,
  /** Formación profesional: 0,60 %. */
  formacion: 0.006,
  /** MEI (Mecanismo de Equidad Intergeneracional): 0,75 %. */
  mei: 0.0075,
  /** AT/EP orientativo (varía por epígrafe CNAE): 1,50 %. */
  atEp: 0.015,
} as const;

/** Formatea una fracción de cotización como porcentaje es-ES, p. ej. 0,236 → "23,60 %". */
function pct(fraccion: number): string {
  return pctES(fraccion * 100, 2);
}

/** Tipo de cotización a cargo de la empresa por desempleo según el tipo de contrato. */
export function tipoDesempleoEmpresa(tipoContrato: TipoContrato): number {
  return tipoContrato === 'temporal'
    ? TIPOS_EMPRESA.desempleoTemporal
    : TIPOS_EMPRESA.desempleoIndefinido;
}

/** Suma de los tipos de cotización empresarial aplicables según el tipo de contrato. */
export function tipoTotalEmpresa(tipoContrato: TipoContrato): number {
  return (
    TIPOS_EMPRESA.contingenciasComunes +
    tipoDesempleoEmpresa(tipoContrato) +
    TIPOS_EMPRESA.fogasa +
    TIPOS_EMPRESA.formacion +
    TIPOS_EMPRESA.mei +
    TIPOS_EMPRESA.atEp
  );
}

export interface ConceptoCoste {
  /** Etiqueta descriptiva del concepto, con su porcentaje. */
  label: string;
  /** Tipo de cotización aplicado (fracción). */
  tipo: number;
  /** Importe del concepto en EUR (base topada × tipo; en solidaridad, suma por tramos del exceso). */
  importe: number;
}

export interface ResultadoCosteEmpresa {
  /** Salario bruto anual (base sobre la que se aplican los tipos), en EUR. */
  bruto: number;
  /** Desglose de la cotización empresarial por concepto. */
  conceptos: ConceptoCoste[];
  /** Base de cotización anual: el bruto topado a la base máxima (61.214,40 €). */
  baseCotizacion: number;
  /** Suma de tipos empresariales aplicados sobre la base de cotización (fracción). */
  tipoTotalEmpresa: number;
  /** Cuota de solidaridad a cargo de la empresa sobre el exceso de la base máxima (0 si no hay exceso). */
  solidaridadEmpresa: number;
  /** Cotización empresarial total ÷ bruto (fracción): igual a tipoTotalEmpresa por debajo del tope. */
  tipoEfectivo: number;
  /** Total de la cotización a cargo de la empresa, en EUR. */
  ssEmpresa: number;
  /** Coste total anual para la empresa (bruto + cotización empresarial), en EUR. */
  costeTotal: number;
  /** Coste mensual equivalente (coste total ÷ 12), en EUR. */
  costeMensual: number;
}

/**
 * Calcula el coste total anual de un trabajador para la empresa a partir del salario bruto
 * anual y el tipo de contrato, aplicando los tipos de cotización empresarial 2026.
 *
 * @param brutoAnual salario bruto anual (EUR); se cotiza hasta la base máxima y, por encima, la solidaridad
 * @param tipoContrato 'indefinido' o 'temporal' (afecta solo al tipo de desempleo)
 */
export function calcularCosteEmpresa(
  brutoAnual: number,
  tipoContrato: TipoContrato,
): ResultadoCosteEmpresa {
  if (!isFinite(brutoAnual) || brutoAnual <= 0) {
    throw new RangeError('El salario bruto anual debe ser un número > 0');
  }

  const tipoDesempleo = tipoDesempleoEmpresa(tipoContrato);
  const base = Math.min(brutoAnual, BASE_MAX_ANUAL);
  const conceptos: ConceptoCoste[] = [
    {
      label: `Contingencias comunes (${pct(TIPOS_EMPRESA.contingenciasComunes)})`,
      tipo: TIPOS_EMPRESA.contingenciasComunes,
      importe: base * TIPOS_EMPRESA.contingenciasComunes,
    },
    {
      label: `Desempleo (${pct(tipoDesempleo)})`,
      tipo: tipoDesempleo,
      importe: base * tipoDesempleo,
    },
    {
      label: `FOGASA (${pct(TIPOS_EMPRESA.fogasa)})`,
      tipo: TIPOS_EMPRESA.fogasa,
      importe: base * TIPOS_EMPRESA.fogasa,
    },
    {
      label: `Formación profesional (${pct(TIPOS_EMPRESA.formacion)})`,
      tipo: TIPOS_EMPRESA.formacion,
      importe: base * TIPOS_EMPRESA.formacion,
    },
    {
      label: `MEI empresa (${pct(TIPOS_EMPRESA.mei)})`,
      tipo: TIPOS_EMPRESA.mei,
      importe: base * TIPOS_EMPRESA.mei,
    },
    {
      label: `AT/EP (orientativo ${pct(TIPOS_EMPRESA.atEp)})`,
      tipo: TIPOS_EMPRESA.atEp,
      importe: base * TIPOS_EMPRESA.atEp,
    },
  ];

  const solidaridadEmpresa = cuotaSolidaridadAnual(brutoAnual, 'empresa');
  if (solidaridadEmpresa > 0) {
    conceptos.push({
      label: 'Cotización de solidaridad (exceso sobre la base máxima)',
      tipo: solidaridadEmpresa / (brutoAnual - BASE_MAX_ANUAL),
      importe: solidaridadEmpresa,
    });
  }

  const ssEmpresa = conceptos.reduce((suma, c) => suma + c.importe, 0);
  const costeTotal = brutoAnual + ssEmpresa;

  return {
    bruto: brutoAnual,
    conceptos,
    baseCotizacion: base,
    tipoTotalEmpresa: tipoTotalEmpresa(tipoContrato),
    solidaridadEmpresa,
    tipoEfectivo: ssEmpresa / brutoAnual,
    ssEmpresa,
    costeTotal,
    costeMensual: costeTotal / 12,
  };
}
