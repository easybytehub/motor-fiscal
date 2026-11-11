/**
 * Coste REAL para la empresa de un trabajador de baja por incapacidad temporal (IT) —
 * enfermedad común / accidente no laboral, o accidente de trabajo / enfermedad profesional —
 * vigente en 2026.
 *
 * Combina dos obligaciones distintas que casi nunca se juntan en una sola cuenta:
 *
 *  1. La cotización a la Seguridad Social a cargo de la empresa NO se interrumpe durante la
 *     baja: sigue devengándose sobre la misma base, esté el trabajador produciendo o no
 *     (art. 144.4 del texto refundido de la LGSS, Real Decreto Legislativo 8/2015).
 *  2. El subsidio por IT tiene dos pagadores distintos según el tramo, y solo uno es coste real
 *     de la empresa (art. 173.1 LGSS) — y el reparto es DISTINTO según la contingencia:
 *       - Enfermedad común / accidente no laboral: del día 4 al 15 lo paga la empresa a su
 *         cargo, sin posibilidad de recuperarlo; desde el día 16 lo paga el INSS o la mutua.
 *       - Accidente de trabajo / enfermedad profesional: el día del accidente lo paga la
 *         empresa como salario íntegro (no como subsidio, y no se recupera); desde el día
 *         SIGUIENTE lo paga directamente la mutua colaboradora (o el INSS), sin el tramo de
 *         días 4-15 a cargo de la empresa que sí existe en la contingencia común.
 *     En ambos casos, la empresa puede seguir adelantando en nómina el tramo que no es suyo
 *     como pago delegado, pero lo compensa después en la liquidación de cuotas a la Seguridad
 *     Social (TC1/RLC): no es un coste neto adicional, solo un desfase de caja.
 *
 * Los porcentajes del subsidio por tramo en contingencia común (60 % días 4-20, 75 % desde el
 * 21) y el 75 % de la contingencia profesional son los mismos que en baja-laboral.ts (RD
 * 53/1980, art. 171 LGSS); lo que aporta este módulo es separar, dentro de esos tramos, qué
 * parte paga la empresa sin recuperación y qué parte es solo un adelanto de caja compensable.
 *
 * Tope de la base (FIX 1-oct-2026): la base de cotización no puede superar la base máxima de
 * 2026, 5.101,20 €/mes (Orden PJC/297/2026). Antes se aceptaba cualquier cifra y, con una base
 * introducida por encima del tope, la cotización y el subsidio salían inflados. Ahora se topa
 * antes de calcular. No se modela la cotización adicional de solidaridad: se devenga sobre la
 * retribución que excede la base máxima, y este módulo recibe la BASE de cotización (que por
 * definición no la excede), no el salario. Tampoco se aplica la base mínima: depende del grupo
 * de cotización, que la página no pide.
 *
 * Trabajador de 62 años o más (añadido 18-oct-2026): el párrafo segundo del art. 144.4 LGSS
 * (introducido por la Ley 21/2021 y vigente en el texto consolidado del BOE, actualización del
 * 3-oct-2026) da a la empresa una «reducción del 75 por ciento de las cuotas empresariales a la
 * Seguridad Social por contingencias comunes durante la situación de incapacidad temporal» de
 * esos trabajadores. Solo contingencias comunes (23,60 %): desempleo, FOGASA, formación, MEI y
 * AT/EP se siguen pagando enteros. Es la cifra que más cambia la cuenta y la que no daba la
 * página: con 62 años, la cotización que corre durante la baja baja del 32,15 % al 14,45 %.
 *
 * Regla del repo: toda modificación de este archivo exige actualizar
 * tests/coste-baja-empresa.test.ts con la fuente oficial citada.
 */
import { PORCENTAJES, baseReguladoraDiaria, type TipoBaja } from './baja-laboral.js';
import { TIPOS_EMPRESA, tipoTotalEmpresa, type TipoContrato } from './coste-empresa.js';

/** Reducción de la cuota empresarial por contingencias comunes durante la IT de un trabajador de 62 años o más (art. 144.4 LGSS). */
export const REDUCCION_CC_MAYOR_62 = 0.75;

/** Tipo de cotización empresarial que sigue corriendo durante la baja, con o sin la reducción de 62 años. */
export function tipoEmpresaDuranteBaja(tipoContrato: TipoContrato, mayor62 = false): number {
  const reduccion = mayor62 ? TIPOS_EMPRESA.contingenciasComunes * REDUCCION_CC_MAYOR_62 : 0;
  return tipoTotalEmpresa(tipoContrato) - reduccion;
}
import { BASE_MAX_MENSUAL } from './nomina.js';

export interface ResultadoCosteBajaEmpresa {
  /** Tipo de baja calculada. */
  tipoBaja: TipoBaja;
  /** Base de cotización mensual aplicada: la introducida, topada a la base máxima (5.101,20 €). */
  baseCotizacionAplicada: number;
  /** true si la base introducida superaba la base máxima y se ha topado. */
  baseTopada: boolean;
  /** Base reguladora diaria (base de cotización mensual aplicada ÷ 30), en EUR. */
  baseDiaria: number;
  /** Días de baja introducidos. */
  diasBaja: number;
  /** Cotización SS a cargo de la empresa durante TODOS los días de baja (no se interrumpe). */
  cotizacionSS: number;
  /** Tipo de cotización empresarial aplicado (fracción): 0,3215 indefinido, 0,1445 con la reducción de 62 años. */
  tipoCotizacion: number;
  /** Lo que se ahorra la empresa en cuotas por la reducción de 62 años (0 si no aplica). */
  ahorroMayor62: number;
  /**
   * Días del tramo a cargo directo de la empresa: 4-15 (tope 12) en contingencia común, o
   * solo el día del accidente (1) en contingencia profesional.
   */
  diasTramoDirecto: number;
  /**
   * Importe a cargo directo de la empresa, sin recuperación posible: subsidio al 60 % en
   * común, o salario íntegro del día del accidente (art. 173.1 LGSS) en profesional.
   */
  subsidioDirecto: number;
  /** Días desde que el pago pasa a la mutua/INSS (pagador vía pago delegado). */
  diasTramoDelegado: number;
  /** Subsidio del tramo delegado: lo adelanta la empresa en nómina pero lo compensa después — informativo, no forma parte del coste real. */
  subsidioDelegadoInformativo: number;
  /** Coste real para la empresa: cotización SS + tramo directo (excluye el pago delegado, que se compensa). */
  costeReal: number;
}

/**
 * Calcula el coste real para la empresa de un periodo de baja por incapacidad temporal,
 * separando lo que es coste directo de lo que es solo adelanto de caja. El reparto de tramos
 * cambia según `tipoBaja` (art. 173.1 LGSS).
 *
 * @param baseCotizacionMensual base de cotización del mes anterior a la baja (EUR/mes); se topa a 5.101,20 €
 * @param tipoContrato 'indefinido' o 'temporal' (afecta al tipo de cotización empresarial)
 * @param diasBaja número de días de baja
 * @param tipoBaja 'comun' (enfermedad común / accidente no laboral, por defecto) o 'laboral'
 *   (accidente de trabajo / enfermedad profesional)
 * @param mayor62 true si el trabajador ha cumplido 62 años: reducción del 75 % de la cuota
 *   empresarial por contingencias comunes durante la baja (art. 144.4 LGSS). Por defecto false,
 *   y entonces el resultado es idéntico al de antes de añadir el parámetro.
 */
export function calcularCosteBajaEmpresa(
  baseCotizacionMensual: number,
  tipoContrato: TipoContrato,
  diasBaja: number,
  tipoBaja: TipoBaja = 'comun',
  mayor62 = false,
): ResultadoCosteBajaEmpresa {
  if (!isFinite(diasBaja) || diasBaja <= 0) {
    throw new RangeError('Los días de baja deben ser un número > 0');
  }
  if (!isFinite(baseCotizacionMensual) || baseCotizacionMensual <= 0) {
    throw new RangeError('La base de cotización mensual debe ser un número > 0');
  }
  const baseCotizacionAplicada = Math.min(baseCotizacionMensual, BASE_MAX_MENSUAL);
  const baseTopada = baseCotizacionMensual > BASE_MAX_MENSUAL;
  const baseDiaria = baseReguladoraDiaria(baseCotizacionAplicada);

  // 1. Cotización empresarial: continúa sobre TODOS los días de baja (art. 144.4 LGSS),
  //    sea cual sea la contingencia.
  //    Con 62 años o más, la parte de contingencias comunes se reduce un 75 % (mismo artículo).
  const tipoCotizacion = tipoEmpresaDuranteBaja(tipoContrato, mayor62);
  const cotizacionSS = baseDiaria * tipoCotizacion * diasBaja;
  const ahorroMayor62 = baseDiaria * (tipoTotalEmpresa(tipoContrato) - tipoCotizacion) * diasBaja;

  if (tipoBaja === 'laboral') {
    // Accidente de trabajo / enfermedad profesional (art. 173.1 LGSS): el día del accidente
    // lo paga la empresa como SALARIO ÍNTEGRO (aproximado aquí por la base diaria, misma
    // simplificación que el resto del sitio); desde el día siguiente paga la mutua/INSS
    // directamente al 75 %, sin tramo de días 4-15 a cargo de la empresa.
    const diasTramoDirecto = 1;
    const subsidioDirecto = baseDiaria; // salario íntegro del día del accidente
    const diasTramoDelegado = Math.max(0, diasBaja - 1);
    const subsidioDelegadoInformativo = diasTramoDelegado * baseDiaria * PORCENTAJES.laboral;
    const costeReal = cotizacionSS + subsidioDirecto;

    return {
      tipoBaja,
      baseCotizacionAplicada,
      baseTopada,
      baseDiaria,
      diasBaja,
      cotizacionSS,
      tipoCotizacion,
      ahorroMayor62,
      diasTramoDirecto,
      subsidioDirecto,
      diasTramoDelegado,
      subsidioDelegadoInformativo,
      costeReal,
    };
  }

  // 2. Enfermedad común / accidente no laboral (art. 173.1 LGSS): subsidio por tramos.
  const diasTramoDirecto = Math.max(0, Math.min(diasBaja, 15) - 3); // días 4-15, a cargo empresa
  const dias4a20 = Math.max(0, Math.min(diasBaja, 20) - 3);
  const dias16a20 = Math.max(0, dias4a20 - diasTramoDirecto); // parte del tramo 60% que ya es delegado
  const dias21mas = Math.max(0, diasBaja - 20);
  const diasTramoDelegado = dias16a20 + dias21mas;

  const subsidioDirecto = diasTramoDirecto * baseDiaria * PORCENTAJES.comunDias4a20;
  const subsidioDelegadoInformativo =
    dias16a20 * baseDiaria * PORCENTAJES.comunDias4a20 + dias21mas * baseDiaria * PORCENTAJES.comunDias21mas;

  const costeReal = cotizacionSS + subsidioDirecto;

  return {
    tipoBaja,
    baseCotizacionAplicada,
    baseTopada,
    baseDiaria,
    diasBaja,
    cotizacionSS,
    tipoCotizacion,
    ahorroMayor62,
    diasTramoDirecto,
    subsidioDirecto,
    diasTramoDelegado,
    subsidioDelegadoInformativo,
    costeReal,
  };
}
