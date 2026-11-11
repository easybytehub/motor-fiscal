# motor-fiscal

[![tests](https://github.com/easybytehub/motor-fiscal/actions/workflows/tests.yml/badge.svg)](https://github.com/easybytehub/motor-fiscal/actions/workflows/tests.yml)

Cálculo fiscal y laboral de España en funciones puras de TypeScript: IRPF, nómina, paro, indemnización por despido, finiquito y paga extra, cuota de autónomos, baja laboral, coste de un trabajador para la empresa, vacaciones, horas extra, pensión de jubilación, retención en factura, plusvalía municipal e IVA de una reforma.

Cada cifra legal lleva en el código la norma y el artículo de donde sale, y un test que la contrasta con el texto publicado en el BOE. Son 439 tests en 15 ficheros.

Es el motor de las calculadoras fiscales y laborales de **javiermiralles.tech**: <https://javiermiralles.tech/fiscal/>. Cada función de abajo enlaza a la calculadora que la usa, que sirve de demo.

## Qué es, y qué no es

- **Son estimaciones con las cifras de 2026**: bases y topes de cotización, IPREM, escala del IRPF, pensión máxima, coeficientes de la plusvalía. Las cifras cambian cada año y el paquete se versiona con ellas.
- **No sustituye** al cálculo de la AEAT, el SEPE, el INSS o tu ayuntamiento, ni al de un asesor. Cada módulo declara en su cabecera lo que simplifica; por ejemplo, el IRPF usa la escala estatal más una autonómica de referencia y no aplica deducciones.
- **Sin dependencias en tiempo de ejecución** y sin estado: mismas entradas, mismo resultado. Ninguna función lee la fecha del sistema.
- Las entradas inválidas lanzan `RangeError` con el motivo en español.

## Instalación

Todavía no está publicado en npm. Desde GitHub:

```sh
npm install github:easybytehub/motor-fiscal
```

Cada módulo se importa por su ruta:

```ts
import { calcularIRPF } from 'motor-fiscal/irpf';
import { calcularNomina } from 'motor-fiscal/nomina';
```

Necesita Node 20 o posterior (ESM). Los tipos van incluidos.

## Funciones

Los importes van en euros. Los tipos van en tanto por uno (`0.15` es el 15 %) salvo donde se indica.

### IRPF — `motor-fiscal/irpf`

`calcularIRPF` estima la cuota íntegra sobre la base liquidable general, con el tipo medio y el marginal. El mínimo personal se descuenta como manda el art. 63.1.2.º LIRPF: escala sobre la base menos escala sobre el mínimo, no escala sobre «base − mínimo».

```ts
calcularIRPF({ baseLiquidable: 30000 });
// { minimoAplicado: 5550, cuotaEscalaBase: 7165.5, cuotaEscalaMinimo: 1054.5,
//   cuota: 6111, tipoMedio: 0.2037, tipoMarginal: 0.30 }
```

También: `retencionParaSaldoCero` (qué retención pedir en la nómina para que la renta salga a cero, art. 88.5 RIRPF), `filaPorBruto` y `tablaPorBruto` (tipo medio y marginal partiendo del salario bruto), `cuotaEscala`, `tipoMarginal`, `TRAMOS_IRPF`, `TIPOS_ESTATALES_ART63` y `MINIMOS_CONTRIBUYENTE`.

- **Fuentes**: Ley 35/2006 del IRPF (BOE-A-2006-20764), arts. 57, 63 y 74; RD 439/2007, Reglamento del IRPF (BOE-A-2007-6820), art. 88.5.
- **Demo**: [Calculadora de IRPF](https://javiermiralles.tech/fiscal/calculadora-irpf/)

### Nómina — `motor-fiscal/nomina`

`calcularNomina` va del bruto anual al neto: cotización del trabajador a la Seguridad Social (con la cuota de solidaridad por encima de la base máxima), reducción por rendimientos del trabajo, retención de IRPF con sus límites y neto por paga. `brutoDesdeNeto` hace el camino inverso.

```ts
calcularNomina({ brutoAnual: 30000, pagas: 14 });
// { cotizacionSeguridadSocial: 1950, baseLiquidableIRPF: 26050, retencionIRPF: 4926,
//   tipoEfectivoIRPF: 16.42 /* en % */, netoAnual: 23124, netoPorPaga: 1651.71 }

brutoDesdeNeto({ netoPorPaga: 1500, pagas: 14 });
// { brutoAnual: 26754.78, brutoPorPaga: 1911.06, netoPorPaga: 1500.00, ... }
```

También: `cotizacionSeguridadSocial`, `cuotaSolidaridadAnual`, `reduccionRendimientosTrabajo`, `aplicarLimitesRetencion`, `franjaLimite43` y las constantes de cotización (`SS_TOTAL`, `BASE_MAX_MENSUAL`, `BASE_MAX_ANUAL`, `TRAMOS_SOLIDARIDAD`…).

- **Fuentes**: Orden PJC/297/2026 de cotización (BOE-A-2026-7296); Ley 35/2006 del IRPF, arts. 19, 20, 57, 58 y 63; RD 439/2007, arts. 81 y 85.3.
- **Demos**: [Calculadora de nómina](https://javiermiralles.tech/fiscal/calculadora-nomina/), [paga extra proporcional o prorrateada](https://javiermiralles.tech/fiscal/paga-extra-proporcional-o-prorrateada/)

### Paro — `motor-fiscal/paro`

`calcularParo` da la prestación contributiva mensual: 70 % de la base reguladora los primeros 180 días y 60 % después, con los topes del IPREM según los hijos a cargo y prorrateados por la parcialidad. `duracionPrestacion` aplica la escala de duración, `totalPrestacion` suma todo el periodo y `netoParo` descuenta la cotización.

```ts
calcularParo(1800, 0); // base reguladora 1.800 €/mes, sin hijos
// { cuantiaPrimeros180: 1225 /* topada al 175 % del IPREM + 1/6 */, cuantiaDesde181: 1080, ... }

duracionPrestacion(1080); // 1.080 días cotizados → 360 días de paro
totalPrestacion(1800, 0, 1080); // { meses: 12, total: 13830, totalNeto: 12782.4, ... }
```

- **Fuentes**: Real Decreto Legislativo 8/2015, LGSS (BOE-A-2015-11724), arts. 269.1, 270 y 273.1; IPREM de la Ley 31/2022 de PGE, prorrogada; Orden PJC/297/2026 (BOE-A-2026-7296).
- **Demos**: [Calculadora del paro](https://javiermiralles.tech/fiscal/calculadora-paro/), [paro con media jornada](https://javiermiralles.tech/fiscal/paro-media-jornada/)

### Indemnización por despido — `motor-fiscal/indemnizacion-despido`

`calcularIndemnizacionDespido` aplica 33 días por año con tope de 24 mensualidades (improcedente) o 20 días por año con tope de 12 (objetivo). El resultado es bruto.

```ts
calcularIndemnizacionDespido({ salarioBrutoAnual: 30000, antiguedadAnios: 5, tipoDespido: 'improcedente' });
// { salarioDiario: 82.19, diasPorAnio: 33, topeImporte: 60000, topeAplicado: false,
//   indemnizacion: 13561.64 }
```

No modela el régimen transitorio de los contratos anteriores al 12-feb-2012.

- **Fuentes**: Real Decreto Legislativo 2/2015, Estatuto de los Trabajadores (BOE-A-2015-11430), arts. 52, 53.1.b y 56.1; Ley 3/2012 (BOE-A-2012-2076).
- **Demos**: [Calculadora de indemnización por despido](https://javiermiralles.tech/fiscal/calculadora-indemnizacion-despido/), [indemnización con media jornada](https://javiermiralles.tech/fiscal/indemnizacion-despido-media-jornada/)

### Finiquito y paga extra — `motor-fiscal/finiquito`

`calcularFiniquito` suma los días trabajados del último mes, las vacaciones no disfrutadas y la parte devengada de las pagas extra. `importePagaExtraProporcional` calcula lo devengado de las dos pagas extra en cualquier periodo.

```ts
calcularFiniquito({
  salarioBrutoAnual: 24000, diasTrabajadosMes: 15, vacacionesPendientes: 8,
  pagasProrrateadas: false, diasDesdeUltimaPaga: 182,
});
// { salarioDiario: 56.36, importeDiasTrabajados: 845.40, importeVacaciones: 450.88,
//   importePagasExtra: 1709.59, total: 3005.87 }

importePagaExtraProporcional(28000, 90); // 986.30 € devengados en 90 días
```

- **Fuentes**: Estatuto de los Trabajadores (BOE-A-2015-11430), arts. 31 y 38.
- **Demos**: [Calculadora de finiquito](https://javiermiralles.tech/fiscal/calculadora-finiquito/), [paga extra proporcional o prorrateada](https://javiermiralles.tech/fiscal/paga-extra-proporcional-o-prorrateada/)

### Cuota de autónomos — `motor-fiscal/cuota-autonomos`

`calcularCuotaAutonomos` sitúa el rendimiento neto mensual en uno de los 15 tramos del RETA y deriva la cuota de la base mínima del tramo por el tipo total del 31,50 %. Las cuotas no se escriben a mano: salen de la base que publica el BOE.

```ts
calcularCuotaAutonomos(1500);
// { tramo: { tramo: 5, baseMinima: 960.78, cuota: 302.65, ... }, cuotaMensual: 302.65, cuotaAnual: 3631.8 }

calcularCuotaAutonomos(1166.70).tramo.tramo; // 4: el art. 18.1 deja 1.166,70 € fuera del tramo 3
```

- **Fuentes**: Orden PJC/297/2026 (BOE-A-2026-7296), arts. 18.1 (bases por tramo), 18.2, 37.5.a y 37.6 (tipos).
- **Demo**: [Calculadora de cuota de autónomos](https://javiermiralles.tech/fiscal/calculadora-cuota-autonomos/)

### Baja laboral — `motor-fiscal/baja-laboral`

`calcularBajaLaboral` estima la prestación por incapacidad temporal por tramos: en enfermedad común, días 1-3 sin prestación, 4-20 al 60 % y desde el 21 al 75 %; en accidente de trabajo, 75 % desde el día siguiente, con las horas extra del año anterior en la base. `calendarioBaja` reparte la misma baja en fechas, con quién paga cada día.

```ts
calcularBajaLaboral(1800, 'comun', 30);
// { baseDiaria: 60, total: 1062, tramos: [
//   { label: 'Días 1-3 (3 días, 0 %)', importe: 0 },
//   { label: 'Días 4-20 (17 días, 60 %)', importe: 612 },
//   { label: 'Día 21 en adelante (10 días, 75 %)', importe: 450 } ] }
```

- **Fuentes**: LGSS (BOE-A-2015-11724), arts. 169.2, 171 y 173.1; Real Decreto 53/1980 (porcentajes de la base reguladora).
- **Demo**: [Calculadora de baja laboral](https://javiermiralles.tech/fiscal/calculadora-baja-laboral/)

### Coste de un trabajador para la empresa — `motor-fiscal/coste-empresa`

`calcularCosteEmpresa` suma al bruto la cotización empresarial de 2026 por conceptos (contingencias comunes, desempleo, FOGASA, formación, MEI, AT/EP orientativo) y la cuota de solidaridad por encima de la base máxima.

```ts
calcularCosteEmpresa(30000, 'indefinido');
// { ssEmpresa: 9645, tipoTotalEmpresa: 0.3215, costeTotal: 39645, costeMensual: 3303.75, conceptos: [...] }
```

- **Fuentes**: Orden PJC/297/2026 (BOE-A-2026-7296); Ley 42/2006, DA 4.ª (tarifa de AT/EP).
- **Demo**: [Calculadora de coste de empresa](https://javiermiralles.tech/fiscal/calculadora-coste-empresa/)

### Coste de una baja para la empresa — `motor-fiscal/coste-baja-empresa`

`calcularCosteBajaEmpresa` separa lo que una baja le cuesta de verdad a la empresa (la cotización, que no se interrumpe, y el tramo que paga directamente) de lo que solo adelanta en nómina y recupera por pago delegado. Contempla la reducción del 75 % de la cuota por contingencias comunes con trabajadores de 62 años o más.

```ts
calcularCosteBajaEmpresa(1800, 'indefinido', 30);
// { cotizacionSS: 578.7, subsidioDirecto: 432 /* días 4-15 */, subsidioDelegadoInformativo: 630,
//   costeReal: 1010.7, ... }
```

- **Fuentes**: LGSS (BOE-A-2015-11724), arts. 144.4 y 173.1; Orden PJC/297/2026 (BOE-A-2026-7296).
- **Demos**: [Coste para la empresa de un trabajador de baja](https://javiermiralles.tech/fiscal/coste-empresa-trabajador-de-baja/), [coste de un accidente laboral](https://javiermiralles.tech/fiscal/coste-empresa-accidente-laboral/)

### Vacaciones — `motor-fiscal/vacaciones`

`calcularVacaciones` prorratea los días de vacaciones por los días trabajados; `vacacionesPorMeses`, por meses; `calcularPagaVacaciones` da lo que se cobra por ellas con el salario ordinario; `diasDesdeAlta` y `mesesCompletosDesdeAlta` cuentan desde una fecha de alta hasta el 31 de diciembre.

```ts
calcularVacaciones({ diasAnuales: 30, diasTrabajados: 182 });
// { proporcion: 0.4986, diasExactos: 14.96, diasCorresponden: 15 }

vacacionesPorMeses(6); // 15 días con el mínimo legal de 30
```

- **Fuentes**: Estatuto de los Trabajadores (BOE-A-2015-11430), art. 38.1; Convenio 132 de la OIT, art. 7.1 (BOE-A-1974-1055).
- **Demos**: [Calculadora de vacaciones](https://javiermiralles.tech/fiscal/calculadora-vacaciones/), [vacaciones con media jornada](https://javiermiralles.tech/fiscal/vacaciones-media-jornada/)

### Horas extra — `motor-fiscal/horas-extra`

`calcularHorasExtra` da el valor de la hora extra con su recargo, el total, la cotización adicional de trabajador y empresa, y el tope anual proporcional a los meses de contrato.

```ts
calcularHorasExtra({ salarioBrutoAnual: 24000, horasAnuales: 1800, numHoras: 10, recargoPorcentaje: 0 });
// { valorHoraExtra: 13.33, total: 133.33, tipoTrabajador: 4.7, tipoEmpresa: 23.6 /* en % */,
//   cotizacionTrabajador: 6.27, cotizacionEmpresa: 31.47, limiteAnual: 80 }
```

- **Fuentes**: Estatuto de los Trabajadores (BOE-A-2015-11430), arts. 34 y 35; Orden PJC/297/2026 (BOE-A-2026-7296), art. 5.
- **Demo**: [Calculadora de horas extra](https://javiermiralles.tech/fiscal/calculadora-horas-extra/)

### Pensión de jubilación — `motor-fiscal/pension-jubilacion`

`calcularPension` aplica a la base reguladora el porcentaje por años cotizados (50 % con 15 años, 100 % con 36 años y 6 meses, según la escala transitoria de 2026) y el tope de la pensión máxima de 2026.

```ts
calcularPension(2000, 30);
// { porcentaje: 85.18, pensionMensual: 1703.6, pensionAnual: 23850.4, topeAplicado: false }
```

- **Fuentes**: LGSS (BOE-A-2015-11724), arts. 209 y 210 y DT 9.ª; Real Decreto 241/2026 (BOE-A-2026-6977), pensión máxima.
- **Demo**: [Calculadora de pensión de jubilación](https://javiermiralles.tech/fiscal/calculadora-pension-jubilacion/)

### Retención de IRPF en factura — `motor-fiscal/retencion-irpf-factura`

`calcularFactura` desglosa una factura: IVA repercutido, retención de IRPF y total a cobrar. La retención 0 es un caso legítimo (pagador particular, entrega de bienes).

```ts
calcularFactura({ base: 1000, tipoIva: 0.21, tipoRetencion: 0.15 });
// { cuotaIva: 210, retencion: 150, totalACobrar: 1060 }
```

- **Fuentes**: Ley 37/1992 del IVA (BOE-A-1992-28740), arts. 90.Uno y 91; Ley 35/2006 del IRPF, art. 101.5.a; RD 439/2007, arts. 76.1 y 95.
- **Demo**: [Calculadora de retención de IRPF en factura](https://javiermiralles.tech/fiscal/calculadora-retencion-irpf-factura/)

### Plusvalía municipal — `motor-fiscal/plusvalia-municipal`

`calcularPlusvalia` calcula el impuesto por el método objetivo y, si hay datos, por el real, y aplica el menos gravoso, como permite la ley desde el RDL 26/2021. Sin incremento real de valor, no hay sujeción.

```ts
calcularPlusvalia({
  valorCatastralSuelo: 50000, aniosTenencia: 10, tipoGravamen: 30 /* en % */,
  valorCatastralTotal: 100000, precioCompra: 200000, precioVenta: 250000,
});
// { coeficiente: 0.12, cuotaObjetivo: 1800, cuotaReal: 7500, metodo: 'objetivo', cuotaFinal: 1800 }
```

- **Fuentes**: Real Decreto Legislativo 2/2004, TRLHL (BOE-A-2004-4214), arts. 104 a 110; Real Decreto-ley 26/2021 (BOE-A-2021-18276); coeficientes del Real Decreto-ley 8/2023 (BOE-A-2023-26452), vigentes en 2026.
- **Demo**: [Calculadora de plusvalía municipal](https://javiermiralles.tech/fiscal/calculadora-plusvalia-municipal/)

### IVA de una reforma — `motor-fiscal/iva-reforma`

`calcularIvaReforma` aplica el 10 % solo si se cumplen a la vez los tres requisitos del tipo reducido (vivienda particular, más de 2 años, materiales de la empresa hasta el 40 % de la base); si falla uno, toda la obra va al 21 %.

```ts
calcularIvaReforma({ base: 10000, esViviendaParticular: true, masDeDosAnios: true, materialesHasta40: true });
// { tipo: 0.10, aplicaReducido: true, cuota: 1000, total: 11000 }
```

- **Fuentes**: Ley 37/1992 del IVA (BOE-A-1992-28740), arts. 90.Uno y 91.Uno.2.10.º y 91.Uno.3.
- **Demo**: [Calculadora de IVA de reforma](https://javiermiralles.tech/reforma/calculadora-iva-reforma/)

### Formato — `motor-fiscal/format`

`num` y `pct` formatean números en convención es-ES (`num(1234.5, 1)` → `"1.234,5"`, `pct(15.6, 1)` → `"15,6 %"`). Los usan las etiquetas que devuelven algunos módulos.

## Las cifras de 2026 en una página

Las cifras oficiales de 2026 que usa este motor (escala del IRPF, cuotas de autónomos, tipos de cotización, IPREM, IVA) están reunidas en [Cifras oficiales 2026](https://javiermiralles.tech/cifras-oficiales-2026/), que las lee de este mismo código.

## Tests

```sh
npm install
npm test
```

Cada fichero de `tests/` cita la norma que contrasta y, cuando la calculadora publica un ejemplo resuelto, lo reproduce. Regla del repositorio: quien cambie una cifra de `src/` actualiza su test con la fuente oficial.

Si encuentras una cifra que no coincide con el BOE, abre una issue con el enlace al artículo.

## Licencia

[Apache-2.0](LICENSE). Copyright 2026 EasyByte Hub, S. Coop. Mad. (véase [NOTICE](NOTICE)); autor y mantenedor, Javier Miralles.

## Quién lo mantiene

**Javier Miralles**, autor de **javiermiralles.tech** (<https://javiermiralles.tech>), calculadoras fiscales, laborales y de reforma con la fuente oficial de cada cifra. Este paquete es el mismo código que hace los cálculos de esas páginas.

Para citarlo, usa [`CITATION.cff`](CITATION.cff).
