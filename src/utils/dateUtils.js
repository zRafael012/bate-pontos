export function formatarDataHoraBR(valor) {
  if (!valor) {
    return '-';
  }

  const data = new Date(valor);

  if (Number.isNaN(data.getTime())) {
    return '-';
  }

  return data.toLocaleString('pt-BR');
}

export function minutosEntre(inicio, fim) {
  if (!inicio || !fim) {
    return 0;
  }

  const dataInicio = new Date(inicio);
  const dataFim = new Date(fim);

  if (Number.isNaN(dataInicio.getTime()) || Number.isNaN(dataFim.getTime())) {
    return 0;
  }

  return Math.max(0, Math.round((dataFim.getTime() - dataInicio.getTime()) / 60000));
}

export function formatarMinutos(minutos) {
  const total = Math.max(0, Number(minutos) || 0);
  const horas = Math.floor(total / 60);
  const minutosRestantes = total % 60;

  return `${String(horas).padStart(2, '0')}:${String(minutosRestantes).padStart(2, '0')}`;
}
