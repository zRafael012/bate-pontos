import { EVENTO_TIPOS } from '../constants/eventoTipos';
import { minutosEntre } from './dateUtils';

function ordenarEventosPorHorario(eventos = []) {
  return [...eventos].sort((a, b) => {
    return new Date(a.horario).getTime() - new Date(b.horario).getTime();
  });
}

export function calcularResumoJornada(jornada, eventos = []) {
  if (!jornada) {
    return {
      totalJornadaMinutos: 0,
      totalPausaMinutos: 0,
      totalViagemMinutos: 0,
      totalTrabalhadoMinutos: 0,
    };
  }

  const eventosOrdenados = ordenarEventosPorHorario(eventos);
  const fimJornada = jornada.fim || new Date().toISOString();

  let totalPausaMinutos = 0;
  let totalViagemMinutos = 0;
  let pausaAberta = null;
  let viagemAberta = null;

  eventosOrdenados.forEach((evento) => {
    if (evento.tipo === EVENTO_TIPOS.PAUSA) {
      pausaAberta = evento.horario;
    }

    if (evento.tipo === EVENTO_TIPOS.RETORNO && pausaAberta) {
      totalPausaMinutos += minutosEntre(pausaAberta, evento.horario);
      pausaAberta = null;
    }

    if (evento.tipo === EVENTO_TIPOS.INICIO_VIAGEM) {
      viagemAberta = evento.horario;
    }

    if (evento.tipo === EVENTO_TIPOS.FIM_VIAGEM && viagemAberta) {
      totalViagemMinutos += minutosEntre(viagemAberta, evento.horario);
      viagemAberta = null;
    }
  });

  if (pausaAberta) {
    totalPausaMinutos += minutosEntre(pausaAberta, fimJornada);
  }

  if (viagemAberta) {
    totalViagemMinutos += minutosEntre(viagemAberta, fimJornada);
  }

  const totalJornadaMinutos = minutosEntre(jornada.inicio, fimJornada);
  const totalTrabalhadoMinutos = Math.max(0, totalJornadaMinutos - totalPausaMinutos);

  return {
    totalJornadaMinutos,
    totalPausaMinutos,
    totalViagemMinutos,
    totalTrabalhadoMinutos,
  };
}

export function calcularKmRodado(jornada) {
  if (!jornada?.km_inicial || !jornada?.km_final) {
    return null;
  }

  const kmInicial = Number(jornada.km_inicial);
  const kmFinal = Number(jornada.km_final);

  if (Number.isNaN(kmInicial) || Number.isNaN(kmFinal)) {
    return null;
  }

  return Math.max(0, kmFinal - kmInicial);
}
