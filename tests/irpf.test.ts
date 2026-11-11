import { describe, it, expect } from 'vitest';
import {
  TRAMOS_IRPF,
  MINIMOS_CONTRIBUYENTE,
  TIPOS_ESTATALES_ART63,
  cuotaEscala,
  tipoMarginal,
  calcularIRPF,
  retencionParaSaldoCero,
  filaPorBruto,
  tablaPorBruto,
  BRUTOS_TABLA_IRPF,
} from '../src/irpf.js';

/**
 * Casos verificados contra fuente oficial 2026:
 *  - Escala general de referencia (estatal + autonómica ≈ estatal × 2) 19/24/30/37/45/47 % con
 *    tramos 12.450/20.200/35.200/60.000/300.000 €. Escala ESTATAL 2026 (9,50–24,50 %) sin cambios
 *    respecto a 2025: AEAT, manual IRPF 2025, "Gravamen estatal"
 *    (https://sede.agenciatributaria.gob.es/Sede/ayuda/manuales-videos-folletos/manuales-practicos/irpf-2025/c15-calculo-impuesto-determinacion-cuotas-integras/gravamen-base-liquidable-general/gravamen-estatal.html).
 *  - Mínimo del contribuyente (art. 57 LIRPF): 5.550 / 6.700 / 8.100 €. AEAT, "Mínimo del
 *    contribuyente".
 *  - Método del mínimo (art. 63.1.2.º LIRPF): cuota = escala(base) − escala(mínimo). AEAT,
 *    "Gravamen estatal": "La cuantía resultante se minorará en el importe derivado de aplicar a la
 *    parte de la base liquidable general correspondiente al mínimo personal y familiar esta misma
 *    escala." NO es escala(base − mínimo).
 */

describe('estructura de la escala general de referencia 2026', () => {
  it('tiene los 6 tramos oficiales con tipos 19/24/30/37/45/47 %', () => {
    expect(TRAMOS_IRPF).toHaveLength(6);
    expect(TRAMOS_IRPF.map((t) => t.tipo)).toEqual([0.19, 0.24, 0.3, 0.37, 0.45, 0.47]);
    expect(TRAMOS_IRPF.map((t) => t.hasta)).toEqual([12450, 20200, 35200, 60000, 300000, Infinity]);
  });

  it('escala ESTATAL del art. 63.1 LIRPF: 9,5/12/15/18,5/22,5/24,5 %, un tipo por tramo', () => {
    // BOE, Ley 35/2006 consolidada, art. 63.1.1.º: https://www.boe.es/buscar/act.php?id=BOE-A-2006-20764#a63
    expect(TIPOS_ESTATALES_ART63).toEqual([0.095, 0.12, 0.15, 0.185, 0.225, 0.245]);
    expect(TIPOS_ESTATALES_ART63).toHaveLength(TRAMOS_IRPF.length);
  });

  it('mínimos del contribuyente por edad (art. 57 LIRPF)', () => {
    expect(MINIMOS_CONTRIBUYENTE.general).toBe(5550);
    expect(MINIMOS_CONTRIBUYENTE.mayor65).toBe(6700);
    expect(MINIMOS_CONTRIBUYENTE.mayor75).toBe(8100);
  });
});

describe('cuotaEscala — cuota íntegra por tramos', () => {
  // [base, cuota esperada]
  const casos: Array<[number, number]> = [
    [0, 0],
    [12450, 2365.5], // 12.450 × 19 %
    [20200, 4225.5], // 2.365,50 + 7.750 × 24 %
    [35200, 8725.5], // 4.225,50 + 15.000 × 30 %
    [5550, 1054.5], // mínimo general, todo en el primer tramo
    [6700, 1273.0], // mínimo > 65 años
    [8100, 1539.0], // mínimo > 75 años
  ];
  it.each(casos)('escala(%s €) = %s €', (base, cuota) => {
    expect(cuotaEscala(base)).toBeCloseTo(cuota, 2);
  });
});

describe('tipoMarginal — tramo más alto alcanzado por la base', () => {
  // [base, tipo marginal esperado]
  const casos: Array<[number, number]> = [
    [12450, 0.19], // límite superior del primer tramo
    [12451, 0.24],
    [20200, 0.24],
    [20201, 0.3],
    [30000, 0.3],
    [60000, 0.37],
    [60001, 0.45],
    [300000, 0.45],
    [300001, 0.47],
  ];
  it.each(casos)('marginal(%s €) = %s', (base, tipo) => {
    expect(tipoMarginal(base)).toBeCloseTo(tipo, 4);
  });
});

describe('ejemplo resuelto de la página (Marta, base 30.000 €, mínimo 5.550 €)', () => {
  it('cuota = escala(30.000) − escala(5.550) = 7.165,50 − 1.054,50 = 6.111,00 €', () => {
    const r = calcularIRPF({ baseLiquidable: 30000, minimoPersonal: 5550 });
    expect(r.cuotaEscalaBase).toBeCloseTo(7165.5, 2);
    expect(r.cuotaEscalaMinimo).toBeCloseTo(1054.5, 2);
    expect(r.cuota).toBeCloseTo(6111.0, 2);
    expect(r.tipoMedio).toBeCloseTo(0.2037, 4); // 6.111 / 30.000
    expect(r.tipoMarginal).toBeCloseTo(0.3, 4); // 30.000 cae en el tercer tramo
  });

  it('NO es la cifra del método erróneo escala(base − mínimo) = 5.500,50 € (bug corregido)', () => {
    const r = calcularIRPF({ baseLiquidable: 30000, minimoPersonal: 5550 });
    // El método inline previo restaba el mínimo antes de aplicar la escala e infravaloraba la cuota.
    expect(cuotaEscala(30000 - 5550)).toBeCloseTo(5500.5, 2);
    expect(r.cuota).not.toBeCloseTo(5500.5, 2);
  });
});

describe('calcularIRPF — otros casos y límites de tramo', () => {
  it('base 20.000 €, mínimo 5.550 € → 3.123,00 €, marginal 24 %', () => {
    const r = calcularIRPF({ baseLiquidable: 20000, minimoPersonal: 5550 });
    expect(r.cuota).toBeCloseTo(3123.0, 2);
    expect(r.tipoMarginal).toBeCloseTo(0.24, 4);
  });

  it('base 60.000 €, mínimo 5.550 € → 16.847,00 €, marginal 37 %', () => {
    const r = calcularIRPF({ baseLiquidable: 60000, minimoPersonal: 5550 });
    expect(r.cuota).toBeCloseTo(16847.0, 2);
    expect(r.tipoMarginal).toBeCloseTo(0.37, 4);
  });

  it('base 100.000 €, mínimo 6.700 € (> 65) → 34.628,50 €, marginal 45 %', () => {
    const r = calcularIRPF({ baseLiquidable: 100000, minimoPersonal: 6700 });
    expect(r.cuota).toBeCloseTo(34628.5, 2);
    expect(r.tipoMarginal).toBeCloseTo(0.45, 4);
  });

  it('sin mínimo (0 €): cuota = escala(base) íntegra', () => {
    const r = calcularIRPF({ baseLiquidable: 30000, minimoPersonal: 0 });
    expect(r.cuota).toBeCloseTo(cuotaEscala(30000), 2);
    expect(r.cuota).toBeCloseTo(7165.5, 2);
  });

  it('mínimo por defecto es el general (5.550 €)', () => {
    const conDefecto = calcularIRPF({ baseLiquidable: 30000 });
    const explicito = calcularIRPF({ baseLiquidable: 30000, minimoPersonal: 5550 });
    expect(conDefecto.cuota).toBeCloseTo(explicito.cuota, 2);
  });

  it('base ≤ mínimo → cuota 0 (el mínimo se acota a la base)', () => {
    const r = calcularIRPF({ baseLiquidable: 4000, minimoPersonal: 5550 });
    expect(r.minimoAplicado).toBe(4000);
    expect(r.cuota).toBe(0);
    expect(r.tipoMedio).toBe(0);
  });
});

describe('entradas inválidas', () => {
  it('rechaza base no positiva, NaN e Infinity', () => {
    expect(() => calcularIRPF({ baseLiquidable: 0 })).toThrow(RangeError);
    expect(() => calcularIRPF({ baseLiquidable: -1 })).toThrow(RangeError);
    expect(() => calcularIRPF({ baseLiquidable: NaN })).toThrow(RangeError);
    expect(() => calcularIRPF({ baseLiquidable: Infinity })).toThrow(RangeError);
  });

  it('rechaza mínimo negativo o no finito', () => {
    expect(() => calcularIRPF({ baseLiquidable: 30000, minimoPersonal: -1 })).toThrow(RangeError);
    expect(() => calcularIRPF({ baseLiquidable: 30000, minimoPersonal: NaN })).toThrow(RangeError);
  });
});

/**
 * retencionParaSaldoCero — RIRPF (RD 439/2007), art. 88.5, texto consolidado del BOE
 * (https://www.boe.es/buscar/act.php?id=BOE-A-2007-6820, última actualización 07-10-2026, leído
 * el 14-10-2026): «Los contribuyentes podrán solicitar en cualquier momento de sus correspondientes
 * pagadores la aplicación de tipos de retención superiores a los que resulten de lo previsto en los
 * artículos anteriores». La retención se aplica sobre el bruto; el saldo cero exige cuota ÷ bruto.
 */
describe('retencionParaSaldoCero — tipo a pedir en nómina (art. 88.5 RIRPF)', () => {
  it('base 30.000 € (cuota 6.111 €), bruto 34.000 € al 15 %: sale a pagar 1.011 € y hay que pedir el 18 %', () => {
    const { cuota } = calcularIRPF({ baseLiquidable: 30000, minimoPersonal: 5550 });
    const r = retencionParaSaldoCero({ cuota, brutoAnual: 34000, tipoRetencion: 0.15 });
    expect(r.retenido).toBeCloseTo(5100, 2);
    expect(r.saldo).toBeCloseTo(1011, 2);
    expect(r.tipoNecesario).toBeCloseTo(6111 / 34000, 10); // 17,97 %
    expect(r.tipoAPedir).toBeCloseTo(0.18, 10);
    expect(r.puedePedirse).toBe(true);
    // Con el 18 % la renta ya no sale a pagar: 34.000 × 18 % = 6.120 € ≥ 6.111 €.
    expect(34000 * r.tipoAPedir).toBeGreaterThanOrEqual(cuota);
  });

  it('el tipo medio sobre la base (20,4 %) retendría de más si se pone en la nómina', () => {
    const { cuota, tipoMedio } = calcularIRPF({ baseLiquidable: 30000, minimoPersonal: 5550 });
    const r = retencionParaSaldoCero({ cuota, brutoAnual: 34000, tipoRetencion: tipoMedio });
    expect(r.saldo).toBeLessThan(0); // a devolver: 34.000 × 20,37 % − 6.111 ≈ 815 €
    expect(r.saldo).toBeCloseTo(6111 - 34000 * (6111 / 30000), 2);
  });

  it('si ya te retienen más de lo necesario no hay rebaja que pedir (solo tipos superiores)', () => {
    const r = retencionParaSaldoCero({ cuota: 6111, brutoAnual: 34000, tipoRetencion: 0.2 });
    expect(r.saldo).toBeCloseTo(6111 - 6800, 2); // −689 €: a devolver
    expect(r.puedePedirse).toBe(false);
  });

  it('un tipo necesario entero exacto no sube un punto por coma flotante', () => {
    const r = retencionParaSaldoCero({ cuota: 6120, brutoAnual: 34000, tipoRetencion: 0.15 });
    expect(r.tipoAPedir).toBeCloseTo(0.18, 10);
  });

  it('rechaza bruto ≤ 0 y tipos fuera de [0, 1)', () => {
    expect(() => retencionParaSaldoCero({ cuota: 1000, brutoAnual: 0, tipoRetencion: 0.1 })).toThrow(RangeError);
    expect(() => retencionParaSaldoCero({ cuota: 1000, brutoAnual: 20000, tipoRetencion: 1 })).toThrow(RangeError);
    expect(() => retencionParaSaldoCero({ cuota: -1, brutoAnual: 20000, tipoRetencion: 0.1 })).toThrow(RangeError);
  });
});

/**
 * Tabla por salario bruto (asalariado sin hijos). Fuentes: escala y mínimo citados arriba (arts.
 * 57, 63 y 74 LIRPF, AEAT «Gravamen estatal»); base liquidable = bruto − cotización del trabajador
 * (6,50 %, Orden PJC/297/2026) − 2.000 € de gastos (art. 19.2.f LIRPF) − reducción del art. 20
 * LIRPF (0 por encima de 19.747,50 € de rendimiento neto). Casos hechos a mano:
 *  - 25.000 €: cotización 1.625 €; rendimiento 23.375 € > 19.747,50 € → reducción 0; base =
 *    25.000 − 1.625 − 2.000 = 21.375 €. Escala(21.375) = 4.225,50 + 1.175 × 30 % = 4.578,00 €;
 *    − 1.054,50 € = 3.523,50 €. Medio 16,48 %, marginal 30 %, sobre el bruto 14,09 %.
 *  - 54.000 €: cotización 3.510 €; base = 48.490 €. Escala = 8.725,50 + 13.290 × 37 % =
 *    13.642,80 €; − 1.054,50 € = 12.588,30 €. Medio 25,96 %, marginal 37 %, sobre el bruto 23,31 %.
 */
describe('tablaPorBruto — tipo de IRPF según lo que se gana', () => {
  it('25.000 € brutos → base 21.375 €, cuota 3.523,50 €, marginal 30 %', () => {
    const f = filaPorBruto(25000);
    expect(f.baseLiquidable).toBeCloseTo(21375, 2);
    expect(f.cuota).toBeCloseTo(3523.5, 2);
    expect(f.tipoMedio).toBeCloseTo(3523.5 / 21375, 6);
    expect(f.tipoMarginal).toBeCloseTo(0.3, 6);
    expect(f.sobreBruto).toBeCloseTo(3523.5 / 25000, 6);
  });

  it('54.000 € brutos → base 48.490 €, cuota 12.588,30 €, marginal 37 %', () => {
    const f = filaPorBruto(54000);
    expect(f.baseLiquidable).toBeCloseTo(48490, 2);
    expect(f.cuota).toBeCloseTo(12588.3, 2);
    expect(f.tipoMarginal).toBeCloseTo(0.37, 6);
    expect(f.sobreBruto).toBeCloseTo(0.2331, 4);
  });

  it('70.000 € brutos: la base pasa de 60.000 € y el marginal es el 45 %', () => {
    const f = filaPorBruto(70000);
    expect(f.baseLiquidable).toBeGreaterThan(60000);
    expect(f.tipoMarginal).toBeCloseTo(0.45, 6);
  });

  it('15.000 € brutos: la base no supera el mínimo, no tributa y el marginal es 0', () => {
    const f = filaPorBruto(15000);
    expect(f.baseLiquidable).toBeLessThan(5550);
    expect(f.tributa).toBe(false);
    expect(f.cuota).toBe(0);
    expect(f.tipoMarginal).toBe(0);
  });

  it('la cuota de la tabla es la de la calculadora sobre la misma base', () => {
    for (const f of tablaPorBruto()) {
      if (!f.tributa) continue;
      expect(f.cuota).toBeCloseTo(calcularIRPF({ baseLiquidable: f.baseLiquidable }).cuota, 6);
    }
  });

  it('el tipo medio nunca supera el marginal y crece con el bruto', () => {
    const filas = tablaPorBruto();
    expect(filas).toHaveLength(BRUTOS_TABLA_IRPF.length);
    for (const f of filas) expect(f.tipoMedio).toBeLessThanOrEqual(f.tipoMarginal);
    for (let i = 1; i < filas.length; i++) expect(filas[i].tipoMedio).toBeGreaterThanOrEqual(filas[i - 1].tipoMedio);
  });
});
