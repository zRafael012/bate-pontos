export function normalizarNumero(valor) {
  if (valor === null || valor === undefined || valor === '') {
    return null;
  }

  const numero = Number(String(valor).replace(',', '.'));

  return Number.isNaN(numero) ? null : numero;
}
