/**
 * Formateo de números en español (es-ES).
 *
 * Por qué existe: `Number.prototype.toFixed()` emite SIEMPRE punto decimal
 * anglosajón ("1.44"), y en español el punto es el separador de millares.
 * Un "1.44 m³" en la cifra de resultado se lee como ambiguo con 144 — en un
 * sitio cuyo argumento es el rigor de los números, es el peor sitio para
 * fallar. Este helper centraliza el formato correcto ("1,44 m³").
 *
 * Los importes en euros van con `Intl.NumberFormat` + `style: 'currency'`
 * en cada página (ya correcto); esto cubre el resto: cantidades, porcentajes,
 * medidas y coeficientes.
 */

/**
 * Formatea un número con `decimals` decimales fijos, en convención es-ES.
 * Devuelve cadena vacía para valores no finitos (evita "NaN" en pantalla).
 *
 * num(1.44, 2)  → "1,44"
 * num(15.6, 1)  → "15,6"
 * num(21, 0)    → "21"
 * num(1234.5, 1)→ "1.234,5"  (`useGrouping`: es-ES por defecto no agrupa 4 dígitos)
 * num(12345, 0) → "12.345"
 */
export function num(value: number, decimals = 0): string {
  if (!Number.isFinite(value)) return '';
  return new Intl.NumberFormat('es-ES', { useGrouping: true,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * Igual que `num`, con el símbolo de porcentaje y el espacio fino que exige
 * la norma tipográfica española (espacio antes del %).
 *
 * pct(15.6, 1) → "15,6 %"
 * pct(6.5, 2)  → "6,50 %"
 */
export function pct(value: number, decimals = 0): string {
  const n = num(value, decimals);
  return n === '' ? '' : `${n} %`;
}
