import { describe, it, expect } from 'vitest';
import {
  TIPOS_EMPRESA,
  tipoDesempleoEmpresa,
  tipoTotalEmpresa,
  calcularCosteEmpresa,
} from '../src/coste-empresa.js';

/**
 * Casos verificados contra la Orden PJC/297/2026, de 30 de marzo (BOE-A-2026-7296),
 * tipos de cotización a cargo de la EMPRESA en régimen general para 2026:
 *  - Contingencias comunes 23,60 % (tipo total 28,30 %).
 *  - Desempleo 5,50 % indefinido / 6,70 % duración determinada.
 *  - FOGASA 0,20 %; formación profesional 0,60 %; MEI empresa 0,75 % (MEI total 0,90 %).
 *  - AT/EP: orientativo 1,50 % (varía por epígrafe CNAE; lo fija la TGSS).
 * Verificación cruzada: Iberley (nota Orden 2026), laboral-social.com y Sage (tablas 2026),
 * concordantes con la Orden. El ejemplo resuelto de la página (24.000 €, indefinido) se fija
 * como test céntimo a céntimo.
 */

describe('tipos oficiales de cotización empresarial 2026', () => {
  it('coinciden con la Orden PJC/297/2026', () => {
    expect(TIPOS_EMPRESA.contingenciasComunes).toBeCloseTo(0.236, 5);
    expect(TIPOS_EMPRESA.desempleoIndefinido).toBeCloseTo(0.055, 5);
    expect(TIPOS_EMPRESA.desempleoTemporal).toBeCloseTo(0.067, 5);
    expect(TIPOS_EMPRESA.fogasa).toBeCloseTo(0.002, 5);
    expect(TIPOS_EMPRESA.formacion).toBeCloseTo(0.006, 5);
    expect(TIPOS_EMPRESA.mei).toBeCloseTo(0.0075, 5);
    expect(TIPOS_EMPRESA.atEp).toBeCloseTo(0.015, 5);
  });

  it('el desempleo empresarial depende del tipo de contrato', () => {
    expect(tipoDesempleoEmpresa('indefinido')).toBeCloseTo(0.055, 5);
    expect(tipoDesempleoEmpresa('temporal')).toBeCloseTo(0.067, 5);
  });

  it('el tipo total empresa es 32,15 % (indefinido) y 33,35 % (temporal)', () => {
    // 23,60 + 5,50 + 0,20 + 0,60 + 0,75 + 1,50 = 32,15 %
    expect(tipoTotalEmpresa('indefinido')).toBeCloseTo(0.3215, 5);
    // 23,60 + 6,70 + 0,20 + 0,60 + 0,75 + 1,50 = 33,35 %
    expect(tipoTotalEmpresa('temporal')).toBeCloseTo(0.3335, 5);
    // El único concepto que cambia entre contratos es el desempleo: 1,20 puntos.
    expect(tipoTotalEmpresa('temporal') - tipoTotalEmpresa('indefinido')).toBeCloseTo(0.012, 5);
  });
});

describe('ejemplo resuelto de la página (Marta, 24.000 € bruto, indefinido)', () => {
  const r = calcularCosteEmpresa(24000, 'indefinido');

  it('desglosa cada concepto de cotización empresarial', () => {
    const importes = Object.fromEntries(r.conceptos.map((c) => [c.label.split(' (')[0], c.importe]));
    expect(importes['Contingencias comunes']).toBeCloseTo(5664.0, 2); // 24.000 × 23,60 %
    expect(importes['Desempleo']).toBeCloseTo(1320.0, 2);              // 24.000 × 5,50 %
    expect(importes['FOGASA']).toBeCloseTo(48.0, 2);                   // 24.000 × 0,20 %
    expect(importes['Formación profesional']).toBeCloseTo(144.0, 2);   // 24.000 × 0,60 %
    expect(importes['MEI empresa']).toBeCloseTo(180.0, 2);             // 24.000 × 0,75 %
    expect(importes['AT/EP']).toBeCloseTo(360.0, 2);                   // 24.000 × 1,50 %
  });

  it('cotización empresa 7.716,00 €, coste total 31.716,00 € (2.643,00 €/mes)', () => {
    expect(r.ssEmpresa).toBeCloseTo(7716.0, 2);
    expect(r.costeTotal).toBeCloseTo(31716.0, 2);
    expect(r.costeMensual).toBeCloseTo(2643.0, 2);
    expect(r.tipoTotalEmpresa).toBeCloseTo(0.3215, 5);
  });
});

describe('contrato temporal (mismo bruto, solo cambia el desempleo)', () => {
  it('24.000 € temporal → coste total 32.004,00 € (33,35 %)', () => {
    const r = calcularCosteEmpresa(24000, 'temporal');
    // Desempleo temporal: 24.000 × 6,70 % = 1.608,00 € (frente a 1.320,00 € indefinido: +288 €).
    const desempleo = r.conceptos.find((c) => c.label.startsWith('Desempleo'))!;
    expect(desempleo.importe).toBeCloseTo(1608.0, 2);
    expect(r.ssEmpresa).toBeCloseTo(8004.0, 2);   // 7.716 − 1.320 + 1.608
    expect(r.costeTotal).toBeCloseTo(32004.0, 2);
    expect(r.tipoTotalEmpresa).toBeCloseTo(0.3335, 5);
  });
});

describe('proporcionalidad y coherencia', () => {
  it('por debajo de la base máxima, el coste total es bruto × (1 + tipo total empresa)', () => {
    for (const bruto of [12000, 18000, 30000, 45000]) {
      const r = calcularCosteEmpresa(bruto, 'indefinido');
      expect(r.costeTotal).toBeCloseTo(bruto * (1 + tipoTotalEmpresa('indefinido')), 6);
      expect(r.ssEmpresa).toBeCloseTo(bruto * tipoTotalEmpresa('indefinido'), 6);
    }
  });
});

describe('base máxima y cotización de solidaridad (Orden PJC/297/2026, arts. 3 y 17.1)', () => {
  it('justo en la base máxima (61.214,40 €) no hay solidaridad y el tipo efectivo es el nominal', () => {
    const r = calcularCosteEmpresa(61214.4, 'indefinido');
    expect(r.solidaridadEmpresa).toBe(0);
    expect(r.ssEmpresa).toBeCloseTo(61214.4 * 0.3215, 4);
    expect(r.tipoEfectivo).toBeCloseTo(0.3215, 6);
  });

  it('80.000 € indefinido → 19.870,88 € de cotización empresarial (antes 25.720 €, sin tope)', () => {
    const r = calcularCosteEmpresa(80000, 'indefinido');
    // Ordinaria sobre el tope: 61.214,40 × 32,15 % = 19.680,4296 €.
    expect(r.baseCotizacion).toBeCloseTo(61214.4, 2);
    // Solidaridad empresa sobre 6.666,67 €/mes:
    //   (5.611,32 − 5.101,20) × 0,96 % = 4,897152 + (6.666,667 − 5.611,32) × 1,04 % = 10,975609
    //   → 15,872761 €/mes × 12 = 190,4731 €.
    expect(r.solidaridadEmpresa).toBeCloseTo(190.4731, 3);
    expect(r.ssEmpresa).toBeCloseTo(19870.90, 1);
    expect(r.costeTotal).toBeCloseTo(99870.90, 1);
    expect(r.conceptos.at(-1)!.label).toMatch(/solidaridad/i);
  });

  it('tercer tramo de solidaridad (120.000 €: 10.000 €/mes)', () => {
    const r = calcularCosteEmpresa(120000, 'indefinido');
    // 510,12 × 0,96 % + 2.040,48 × 1,04 % + 2.348,20 × 1,22 % = 4,897152 + 21,220992 + 28,64804
    // = 54,766184 €/mes × 12 = 657,1942 €
    expect(r.solidaridadEmpresa).toBeCloseTo(657.194, 2);
    expect(r.ssEmpresa).toBeCloseTo(61214.4 * 0.3215 + 657.194, 1);
  });
});

describe('entradas inválidas', () => {
  it('rechaza cero, negativos, NaN e Infinity', () => {
    expect(() => calcularCosteEmpresa(0, 'indefinido')).toThrow(RangeError);
    expect(() => calcularCosteEmpresa(-1, 'indefinido')).toThrow(RangeError);
    expect(() => calcularCosteEmpresa(NaN, 'indefinido')).toThrow(RangeError);
    expect(() => calcularCosteEmpresa(Infinity, 'temporal')).toThrow(RangeError);
  });
});
