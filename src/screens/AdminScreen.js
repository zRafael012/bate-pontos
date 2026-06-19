import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { Asset } from 'expo-asset';

import { supabase } from '../lib/supabase';

const logoRelatorio = require('../../assets/logo.png');

export default function AdminScreen({ session, navigation, sair }) {
  const [jornadas, setJornadas] = useState([]);
  const [motoristas, setMotoristas] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [exportando, setExportando] = useState(false);
  const [logoBase64, setLogoBase64] = useState(null);

  const [motoristaSelecionado, setMotoristaSelecionado] = useState('todos');
  const [statusSelecionado, setStatusSelecionado] = useState('todos');
  const [periodoSelecionado, setPeriodoSelecionado] = useState('hoje');

  useEffect(() => {
    buscarDadosAdmin();
    carregarLogoParaRelatorio();
  }, []);

  const jornadasFiltradas = useMemo(() => {
    return jornadas.filter((jornada) => {
      const passaMotorista =
        motoristaSelecionado === 'todos' ||
        jornada.motorista_id === motoristaSelecionado;

      const passaStatus =
        statusSelecionado === 'todos' || jornada.status === statusSelecionado;

      const passaPeriodo = verificarPeriodo(jornada.inicio, periodoSelecionado);

      return passaMotorista && passaStatus && passaPeriodo;
    });
  }, [jornadas, motoristaSelecionado, statusSelecionado, periodoSelecionado]);

  const statusMotoristas = useMemo(() => {
    return motoristas.map((motorista) => obterStatusAtualMotorista(motorista));
  }, [motoristas, jornadas]);

  async function carregarLogoParaRelatorio() {
    try {
      const asset = Asset.fromModule(logoRelatorio);
      await asset.downloadAsync();

      const uri = asset.localUri || asset.uri;

      if (!uri) return;

      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      setLogoBase64(base64);
    } catch (error) {
      console.log('Não foi possível carregar a logo do relatório:', error);
      setLogoBase64(null);
    }
  }

  async function buscarDadosAdmin() {
    setCarregando(true);

    const { data: motoristasData, error: motoristasError } = await supabase
      .from('profiles')
      .select('*')
      .eq('tipo', 'motorista')
      .order('nome', { ascending: true });

    if (motoristasError) {
      setCarregando(false);
      Alert.alert('Erro ao buscar motoristas', motoristasError.message);
      return;
    }

    setMotoristas(motoristasData || []);

    const { data: jornadasData, error: jornadasError } = await supabase
      .from('jornadas')
      .select('*')
      .order('inicio', { ascending: false })
      .limit(200);

    if (jornadasError) {
      setCarregando(false);
      Alert.alert('Erro ao buscar jornadas', jornadasError.message);
      return;
    }

    const jornadasEncontradas = jornadasData || [];
    const idsJornadas = jornadasEncontradas.map((jornada) => jornada.id);

    if (idsJornadas.length === 0) {
      setJornadas([]);
      setCarregando(false);
      return;
    }

    const { data: eventosData, error: eventosError } = await supabase
      .from('eventos_jornada')
      .select('*')
      .in('jornada_id', idsJornadas)
      .order('horario', { ascending: true });

    setCarregando(false);

    if (eventosError) {
      Alert.alert('Erro ao buscar eventos', eventosError.message);
      return;
    }

    const eventosEncontrados = eventosData || [];

    const jornadasComResumo = jornadasEncontradas.map((jornada) => {
      const motorista = (motoristasData || []).find(
        (item) => item.id === jornada.motorista_id
      );

      const eventosDaJornada = eventosEncontrados.filter(
        (evento) => evento.jornada_id === jornada.id
      );

      const resumo = calcularResumoJornada(jornada, eventosDaJornada);
      const resumoViagem = obterResumoUltimaViagem(eventosDaJornada);
      const alertas = verificarInconsistencias(jornada, eventosDaJornada);
      const statusAtual = obterStatusOperacionalJornada(jornada, eventosDaJornada);

      return {
        ...jornada,
        motorista_nome: motorista?.nome || 'Motorista não encontrado',
        motorista_email: motorista?.email || '',
        eventos: eventosDaJornada,
        resumo,
        resumoViagem,
        alertas,
        statusAtual,
      };
    });

    setJornadas(jornadasComResumo);
  }

  function limparFiltros() {
    setMotoristaSelecionado('todos');
    setStatusSelecionado('todos');
    setPeriodoSelecionado('hoje');
  }

  function criarResumoVazio() {
    return {
      minutosBrutos: 0,
      minutosPausa: 0,
      minutosViagem: 0,
      minutosTrabalhados: 0,
      totalViagens: 0,
      totalEventos: 0,
    };
  }

  function calcularResumoJornada(jornada, eventos) {
    const inicio = jornada.inicio ? new Date(jornada.inicio) : null;
    const fim = jornada.fim ? new Date(jornada.fim) : null;

    let minutosBrutos = 0;

    if (inicio && fim && fim > inicio) {
      minutosBrutos = diferencaEmMinutos(inicio, fim);
    }

    const minutosPausa = calcularTempoEntreEventos(eventos, 'pausa', 'retorno');
    const minutosViagem = calcularTempoEntreEventos(
      eventos,
      'inicio_viagem',
      'fim_viagem'
    );

    const totalViagens = eventos.filter(
      (evento) => evento.tipo === 'inicio_viagem'
    ).length;

    const minutosTrabalhados =
      minutosBrutos > 0 ? Math.max(minutosBrutos - minutosPausa, 0) : 0;

    return {
      minutosBrutos,
      minutosPausa,
      minutosViagem,
      minutosTrabalhados,
      totalViagens,
      totalEventos: eventos.length,
    };
  }

  function calcularTempoEntreEventos(eventos, tipoInicio, tipoFim) {
    let totalMinutos = 0;
    let inicioAberto = null;

    for (const evento of eventos) {
      if (evento.tipo === tipoInicio && !inicioAberto) {
        inicioAberto = new Date(evento.horario);
      }

      if (evento.tipo === tipoFim && inicioAberto) {
        const fim = new Date(evento.horario);

        if (fim > inicioAberto) {
          totalMinutos += diferencaEmMinutos(inicioAberto, fim);
        }

        inicioAberto = null;
      }
    }

    return totalMinutos;
  }

  function diferencaEmMinutos(inicio, fim) {
    return Math.floor((fim - inicio) / 1000 / 60);
  }

  function verificarPeriodo(dataISO, periodo) {
    if (periodo === 'todas') return true;
    if (!dataISO) return false;

    const data = new Date(dataISO);
    const agora = new Date();

    const inicioHoje = new Date(
      agora.getFullYear(),
      agora.getMonth(),
      agora.getDate(),
      0,
      0,
      0,
      0
    );

    const fimHoje = new Date(
      agora.getFullYear(),
      agora.getMonth(),
      agora.getDate(),
      23,
      59,
      59,
      999
    );

    const inicioOntem = new Date(inicioHoje);
    inicioOntem.setDate(inicioOntem.getDate() - 1);

    const fimOntem = new Date(fimHoje);
    fimOntem.setDate(fimOntem.getDate() - 1);

    const inicioSemana = new Date(inicioHoje);
    const diaSemana = inicioSemana.getDay();
    const diasDesdeSegunda = diaSemana === 0 ? 6 : diaSemana - 1;
    inicioSemana.setDate(inicioSemana.getDate() - diasDesdeSegunda);

    const inicioMes = new Date(
      agora.getFullYear(),
      agora.getMonth(),
      1,
      0,
      0,
      0,
      0
    );

    if (periodo === 'hoje') return data >= inicioHoje && data <= fimHoje;
    if (periodo === 'ontem') return data >= inicioOntem && data <= fimOntem;
    if (periodo === 'semana') return data >= inicioSemana && data <= fimHoje;
    if (periodo === 'mes') return data >= inicioMes && data <= fimHoje;

    return true;
  }

  function obterNomePeriodo(periodo) {
    const nomes = {
      hoje: 'Hoje',
      ontem: 'Ontem',
      semana: 'Esta semana',
      mes: 'Este mês',
      todas: 'Todas',
    };

    return nomes[periodo] || 'Hoje';
  }

  function verificarInconsistencias(jornada, eventos) {
    const alertas = [];

    const eventosOrdenados = [...(eventos || [])].sort((a, b) => {
      return new Date(a.horario) - new Date(b.horario);
    });

    const agora = new Date();
    const inicio = jornada.inicio ? new Date(jornada.inicio) : null;
    const fim = jornada.fim ? new Date(jornada.fim) : null;

    if (jornada.status === 'aberta' && inicio) {
      const minutosAberta = diferencaEmMinutos(inicio, agora);

      if (minutosAberta >= 720) {
        alertas.push({
          tipo: 'grave',
          texto: `Jornada aberta há ${formatarDuracao(minutosAberta)}.`,
        });
      }
    }

    if (eventosOrdenados.length === 0) {
      alertas.push({ tipo: 'medio', texto: 'Jornada sem eventos registrados.' });
    }

    const temInicioJornada = eventosOrdenados.some(
      (evento) => evento.tipo === 'inicio_jornada'
    );

    const temFimJornada = eventosOrdenados.some(
      (evento) => evento.tipo === 'fim_jornada'
    );

    if (!temInicioJornada) {
      alertas.push({ tipo: 'medio', texto: 'Jornada sem evento de início.' });
    }

    if (jornada.status === 'encerrada' && !temFimJornada) {
      alertas.push({
        tipo: 'medio',
        texto: 'Jornada encerrada sem evento de fim.',
      });
    }

    let pausaAberta = false;
    let horarioPausaAberta = null;
    let viagemAberta = false;
    let horarioViagemAberta = null;

    for (const evento of eventosOrdenados) {
      if (evento.tipo === 'pausa') {
        pausaAberta = true;
        horarioPausaAberta = evento.horario;
      }

      if (evento.tipo === 'retorno') {
        pausaAberta = false;
        horarioPausaAberta = null;
      }

      if (evento.tipo === 'inicio_viagem') {
        viagemAberta = true;
        horarioViagemAberta = evento.horario;
      }

      if (evento.tipo === 'fim_viagem') {
        viagemAberta = false;
        horarioViagemAberta = null;
      }

      if (
        jornada.status === 'encerrada' &&
        fim &&
        evento.horario &&
        new Date(evento.horario) > fim
      ) {
        alertas.push({
          tipo: 'leve',
          texto: 'Existe evento registrado depois do fim da jornada.',
        });
        break;
      }
    }

    if (pausaAberta) {
      const dataPausa = horarioPausaAberta ? new Date(horarioPausaAberta) : null;
      const minutosPausa = dataPausa ? diferencaEmMinutos(dataPausa, agora) : 0;

      alertas.push({
        tipo: 'grave',
        texto:
          minutosPausa > 0
            ? `Pausa sem retorno há ${formatarDuracao(minutosPausa)}.`
            : 'Pausa sem retorno.',
      });
    }

    if (viagemAberta) {
      const dataViagem = horarioViagemAberta
        ? new Date(horarioViagemAberta)
        : null;

      const minutosViagem = dataViagem
        ? diferencaEmMinutos(dataViagem, agora)
        : 0;

      alertas.push({
        tipo: 'grave',
        texto:
          minutosViagem > 0
            ? `Viagem sem finalização há ${formatarDuracao(minutosViagem)}.`
            : 'Viagem sem finalização.',
      });
    }

    return alertas;
  }

  function obterResumoUltimaViagem(eventos) {
    const eventosOrdenados = [...(eventos || [])].sort((a, b) => {
      return new Date(a.horario) - new Date(b.horario);
    });

    const iniciosViagem = eventosOrdenados.filter(
      (evento) => evento.tipo === 'inicio_viagem'
    );

    const finsViagem = eventosOrdenados.filter(
      (evento) => evento.tipo === 'fim_viagem'
    );

    const ultimoInicio = iniciosViagem[iniciosViagem.length - 1] || null;
    const ultimoFim = finsViagem[finsViagem.length - 1] || null;

    const dadosInicio = extrairDadosDaObservacao(ultimoInicio?.observacao);
    const dadosFim = extrairDadosDaObservacao(ultimoFim?.observacao);

    return {
      cliente: dadosInicio.cliente || null,
      destino: dadosInicio.destino || null,
      observacaoInicio: dadosInicio.observacao || null,
      observacaoFim: dadosFim.finalizacao || dadosFim.observacao || null,
      horarioInicio: ultimoInicio?.horario || null,
      horarioFim: ultimoFim?.horario || null,
      temDados:
        Boolean(dadosInicio.cliente) ||
        Boolean(dadosInicio.destino) ||
        Boolean(dadosInicio.observacao) ||
        Boolean(dadosFim.finalizacao) ||
        Boolean(dadosFim.observacao),
    };
  }

  function extrairDadosDaObservacao(observacao) {
    const dados = {
      cliente: null,
      destino: null,
      observacao: null,
      finalizacao: null,
    };

    if (!observacao) return dados;

    const partes = observacao.split('|').map((parte) => parte.trim());

    for (const parte of partes) {
      const parteMinuscula = parte.toLowerCase();

      if (parteMinuscula.startsWith('cliente:')) {
        dados.cliente = parte.replace(/cliente:/i, '').trim();
      } else if (parteMinuscula.startsWith('destino:')) {
        dados.destino = parte.replace(/destino:/i, '').trim();
      } else if (parteMinuscula.startsWith('observação:')) {
        dados.observacao = parte.replace(/observação:/i, '').trim();
      } else if (parteMinuscula.startsWith('observacao:')) {
        dados.observacao = parte.replace(/observacao:/i, '').trim();
      } else if (parteMinuscula.startsWith('finalização:')) {
        dados.finalizacao = parte.replace(/finalização:/i, '').trim();
      } else if (parteMinuscula.startsWith('finalizacao:')) {
        dados.finalizacao = parte.replace(/finalizacao:/i, '').trim();
      }
    }

    return dados;
  }

  function obterStatusOperacionalJornada(jornada, eventos) {
    if (!jornada || jornada.status !== 'aberta') {
      return {
        texto: 'Sem jornada aberta',
        tipo: 'sem_jornada',
        ultimoEvento: null,
      };
    }

    let pausado = false;
    let emViagem = false;
    let ultimoEvento = null;

    const eventosOrdenados = [...(eventos || [])].sort((a, b) => {
      return new Date(a.horario) - new Date(b.horario);
    });

    for (const evento of eventosOrdenados) {
      ultimoEvento = evento;

      if (evento.tipo === 'pausa') pausado = true;
      if (evento.tipo === 'retorno') pausado = false;
      if (evento.tipo === 'inicio_viagem') emViagem = true;
      if (evento.tipo === 'fim_viagem') emViagem = false;
      if (evento.tipo === 'fim_jornada') {
        pausado = false;
        emViagem = false;
      }
    }

    if (pausado) {
      return { texto: 'Em pausa', tipo: 'pausa', ultimoEvento };
    }

    if (emViagem) {
      return { texto: 'Em viagem', tipo: 'viagem', ultimoEvento };
    }

    return { texto: 'Em jornada', tipo: 'jornada', ultimoEvento };
  }

  function obterStatusAtualMotorista(motorista) {
    const jornadasDoMotorista = jornadas.filter(
      (jornada) => jornada.motorista_id === motorista.id
    );

    const jornadaAberta = jornadasDoMotorista.find(
      (jornada) => jornada.status === 'aberta'
    );

    if (!jornadaAberta) {
      return {
        motorista,
        jornada: null,
        texto: 'Sem jornada aberta',
        tipo: 'sem_jornada',
        ultimoEvento: null,
      };
    }

    const status = obterStatusOperacionalJornada(
      jornadaAberta,
      jornadaAberta.eventos || []
    );

    return {
      motorista,
      jornada: jornadaAberta,
      ...status,
    };
  }

  function formatarData(dataISO) {
    if (!dataISO) return '-';
    return new Date(dataISO).toLocaleString('pt-BR');
  }

  function formatarApenasData(dataISO) {
    if (!dataISO) return '-';
    return new Date(dataISO).toLocaleDateString('pt-BR');
  }

  function formatarDuracao(minutos) {
    if (!minutos || minutos <= 0) return '0h 00min';

    const horas = Math.floor(minutos / 60);
    const mins = minutos % 60;

    return `${horas}h ${String(mins).padStart(2, '0')}min`;
  }

  function getResumoGeral() {
    const totalBruto = jornadasFiltradas.reduce((total, jornada) => {
      const resumo = jornada.resumo || criarResumoVazio();
      return total + resumo.minutosBrutos;
    }, 0);

    const totalPausas = jornadasFiltradas.reduce((total, jornada) => {
      const resumo = jornada.resumo || criarResumoVazio();
      return total + resumo.minutosPausa;
    }, 0);

    const totalTrabalhado = jornadasFiltradas.reduce((total, jornada) => {
      const resumo = jornada.resumo || criarResumoVazio();
      return total + resumo.minutosTrabalhados;
    }, 0);

    const totalViagens = jornadasFiltradas.reduce((total, jornada) => {
      const resumo = jornada.resumo || criarResumoVazio();
      return total + resumo.totalViagens;
    }, 0);

    const abertas = jornadasFiltradas.filter(
      (jornada) => jornada.status === 'aberta'
    ).length;

    const encerradas = jornadasFiltradas.filter(
      (jornada) => jornada.status === 'encerrada'
    ).length;

    const jornadasComAlertas = jornadasFiltradas.filter(
      (jornada) => (jornada.alertas || []).length > 0
    ).length;

    const totalAlertas = jornadasFiltradas.reduce((total, jornada) => {
      return total + (jornada.alertas || []).length;
    }, 0);

    return {
      totalBruto,
      totalPausas,
      totalTrabalhado,
      totalViagens,
      abertas,
      encerradas,
      jornadasComAlertas,
      totalAlertas,
    };
  }

  function getResumoStatusMotoristas() {
    return {
      emJornada: statusMotoristas.filter((item) => item.tipo === 'jornada').length,
      emViagem: statusMotoristas.filter((item) => item.tipo === 'viagem').length,
      emPausa: statusMotoristas.filter((item) => item.tipo === 'pausa').length,
      semJornada: statusMotoristas.filter((item) => item.tipo === 'sem_jornada')
        .length,
    };
  }

  function escaparHtml(texto) {
    if (!texto) return '';

    return String(texto)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function gerarHtmlRelatorio() {
    const resumo = getResumoGeral();
    const resumoStatus = getResumoStatusMotoristas();
    const dataGeracao = new Date().toLocaleString('pt-BR');

    const nomeMotorista =
      motoristaSelecionado === 'todos'
        ? 'Todos'
        : motoristas.find((m) => m.id === motoristaSelecionado)?.nome ||
          'Selecionado';

    const logoHtml = logoBase64
      ? `<img class="logo" src="data:image/png;base64,${logoBase64}" />`
      : '';

    const linhasJornadas = jornadasFiltradas
      .map((jornada) => {
        const resumoJornada = jornada.resumo || criarResumoVazio();
        const resumoViagem = jornada.resumoViagem || {};
        const alertas = jornada.alertas || [];

        return `
          <tr>
            <td>${escaparHtml(formatarApenasData(jornada.inicio))}</td>
            <td>${escaparHtml(jornada.motorista_nome)}</td>
            <td>${escaparHtml(jornada.statusAtual?.texto || jornada.status)}</td>
            <td>${escaparHtml(jornada.veiculo || '-')}</td>
            <td>${escaparHtml(jornada.placa || '-')}</td>
            <td>${escaparHtml(jornada.km_inicial ?? '-')}</td>
            <td>${escaparHtml(jornada.km_final ?? '-')}</td>
            <td>${escaparHtml(formatarData(jornada.inicio))}</td>
            <td>${escaparHtml(formatarData(jornada.fim))}</td>
            <td>${escaparHtml(formatarDuracao(resumoJornada.minutosTrabalhados))}</td>
            <td>${escaparHtml(formatarDuracao(resumoJornada.minutosPausa))}</td>
            <td>${escaparHtml(formatarDuracao(resumoJornada.minutosViagem))}</td>
            <td>${resumoJornada.totalViagens}</td>
            <td>${escaparHtml(resumoViagem.cliente || '-')}</td>
            <td>${escaparHtml(resumoViagem.destino || '-')}</td>
            <td>${escaparHtml(alertas.map((alerta) => alerta.texto).join(' | ') || '-')}</td>
          </tr>
        `;
      })
      .join('');

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8" />

          <style>
            body { font-family: Arial, sans-serif; color: #222; padding: 24px; }
            .cabecalho { display: flex; align-items: center; gap: 16px; border-bottom: 3px solid #0b2f66; padding-bottom: 14px; }
            .logo { width: 150px; height: auto; object-fit: contain; }
            h1 { color: #0b2f66; margin: 0; }
            h2 { color: #0b2f66; margin-top: 24px; }
            .info { color: #555; margin-top: 10px; margin-bottom: 16px; line-height: 20px; }
            .resumo { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 16px; }
            .box { border: 1px solid #d9e6f7; border-radius: 8px; padding: 10px; width: 172px; background: #f4f8ff; }
            .box strong { display: block; color: #0b2f66; font-size: 13px; }
            .box span { font-size: 17px; font-weight: bold; }
            .alerta { color: #b00020; font-weight: bold; }
            table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 9px; }
            th { background: #0b2f66; color: #fff; padding: 7px; text-align: left; }
            td { border: 1px solid #ddd; padding: 6px; vertical-align: top; }
            tr:nth-child(even) { background: #f7f7f7; }
          </style>
        </head>

        <body>
          <div class="cabecalho">
            ${logoHtml}
            <div>
              <h1>Relatório de Jornadas</h1>
              <div class="info">
                Período: ${escaparHtml(obterNomePeriodo(periodoSelecionado))}<br />
                Motorista: ${escaparHtml(nomeMotorista)}<br />
                Status: ${escaparHtml(statusSelecionado)}<br />
                Gerado em: ${escaparHtml(dataGeracao)}
              </div>
            </div>
          </div>

          <h2>Resumo do período</h2>

          <div class="resumo">
            <div class="box"><strong>Jornadas</strong><span>${jornadasFiltradas.length}</span></div>
            <div class="box"><strong>Abertas</strong><span>${resumo.abertas}</span></div>
            <div class="box"><strong>Encerradas</strong><span>${resumo.encerradas}</span></div>
            <div class="box"><strong>Tempo bruto</strong><span>${escaparHtml(formatarDuracao(resumo.totalBruto))}</span></div>
            <div class="box"><strong>Trabalhado</strong><span>${escaparHtml(formatarDuracao(resumo.totalTrabalhado))}</span></div>
            <div class="box"><strong>Pausas</strong><span>${escaparHtml(formatarDuracao(resumo.totalPausas))}</span></div>
            <div class="box"><strong>Viagens</strong><span>${resumo.totalViagens}</span></div>
            <div class="box"><strong>Alertas</strong><span class="alerta">${resumo.totalAlertas}</span></div>
          </div>

          <h2>Status atual dos motoristas</h2>
          <div class="resumo">
            <div class="box"><strong>Em jornada</strong><span>${resumoStatus.emJornada}</span></div>
            <div class="box"><strong>Em viagem</strong><span>${resumoStatus.emViagem}</span></div>
            <div class="box"><strong>Em pausa</strong><span>${resumoStatus.emPausa}</span></div>
            <div class="box"><strong>Sem jornada</strong><span>${resumoStatus.semJornada}</span></div>
          </div>

          <h2>Jornadas</h2>

          <table>
            <thead>
              <tr>
                <th>Data</th><th>Motorista</th><th>Status atual</th><th>Veículo</th><th>Placa</th><th>KM inicial</th><th>KM final</th>
                <th>Início</th><th>Fim</th><th>Trabalhado</th><th>Pausas</th><th>Tempo viagem</th><th>Viagens</th><th>Cliente</th><th>Destino</th><th>Alertas</th>
              </tr>
            </thead>
            <tbody>${linhasJornadas}</tbody>
          </table>
        </body>
      </html>
    `;
  }

  async function exportarPDF() {
    if (jornadasFiltradas.length === 0) {
      Alert.alert('Sem dados', 'Não há jornadas para exportar neste filtro.');
      return;
    }

    try {
      setExportando(true);

      const html = gerarHtmlRelatorio();

      const arquivo = await Print.printToFileAsync({ html, base64: true });

      if (!arquivo.base64) {
        throw new Error('O PDF foi gerado sem conteúdo base64.');
      }

      const nomeArquivo = `relatorio_jornadas_${Date.now()}.pdf`;
      const caminho = `${FileSystem.documentDirectory}${nomeArquivo}`;

      const infoArquivo = await FileSystem.getInfoAsync(caminho);

      if (infoArquivo.exists) {
        await FileSystem.deleteAsync(caminho, { idempotent: true });
      }

      await FileSystem.writeAsStringAsync(caminho, arquivo.base64, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const compartilhamentoDisponivel = await Sharing.isAvailableAsync();

      if (!compartilhamentoDisponivel) {
        setExportando(false);

        Alert.alert(
          'PDF gerado',
          `O PDF foi gerado, mas o compartilhamento não está disponível neste dispositivo.\n\nArquivo:\n${caminho}`
        );

        return;
      }

      await Sharing.shareAsync(caminho, {
        mimeType: 'application/pdf',
        UTI: 'com.adobe.pdf',
        dialogTitle: 'Compartilhar relatório PDF',
      });

      setExportando(false);
    } catch (error) {
      setExportando(false);
      console.log('Erro ao exportar PDF:', error);

      Alert.alert(
        'Erro ao exportar PDF',
        error?.message || 'Não foi possível gerar ou compartilhar o relatório em PDF.'
      );
    }
  }

  const resumoGeral = getResumoGeral();
  const resumoStatus = getResumoStatusMotoristas();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        <Text style={styles.titulo}>Painel Administrativo</Text>

        <Text style={styles.usuario}>Admin: {session.user.email}</Text>

        <View style={styles.logoArea}>
          <Image source={logoRelatorio} style={styles.logo} resizeMode="contain" />
        </View>

        <View style={styles.cardResumo}>
          <Text style={styles.resumoTexto}>Motoristas cadastrados: {motoristas.length}</Text>
          <Text style={styles.resumoTexto}>Jornadas carregadas: {jornadas.length}</Text>
          <Text style={styles.resumoTexto}>Jornadas filtradas: {jornadasFiltradas.length}</Text>
          <Text style={styles.periodoAtual}>Período atual: {obterNomePeriodo(periodoSelecionado)}</Text>
        </View>

        <View style={styles.cardResumo}>
          <Text style={styles.subtitulo}>Status atual dos motoristas</Text>

          <View style={styles.statusResumoLinha}>
            <View style={styles.statusResumoBox}><Text style={styles.statusResumoLabel}>Em jornada</Text><Text style={styles.statusResumoValor}>{resumoStatus.emJornada}</Text></View>
            <View style={styles.statusResumoBox}><Text style={styles.statusResumoLabel}>Em viagem</Text><Text style={styles.statusResumoValor}>{resumoStatus.emViagem}</Text></View>
            <View style={styles.statusResumoBox}><Text style={styles.statusResumoLabel}>Em pausa</Text><Text style={styles.statusResumoValor}>{resumoStatus.emPausa}</Text></View>
            <View style={styles.statusResumoBox}><Text style={styles.statusResumoLabel}>Sem jornada</Text><Text style={styles.statusResumoValor}>{resumoStatus.semJornada}</Text></View>
          </View>

          {statusMotoristas.map((item) => (
            <View key={item.motorista.id} style={styles.statusMotoristaItem}>
              <Text style={styles.statusMotoristaNome}>{item.motorista.nome}</Text>
              <Text
                style={[
                  styles.statusMotoristaTexto,
                  item.tipo === 'viagem' && styles.statusAzul,
                  item.tipo === 'pausa' && styles.statusLaranja,
                  item.tipo === 'sem_jornada' && styles.statusCinza,
                ]}
              >
                {item.texto}
              </Text>
              {item.jornada && (
                <Text style={styles.statusMotoristaDetalhe}>
                  Desde: {formatarData(item.jornada.inicio)}
                </Text>
              )}
            </View>
          ))}
        </View>

        <View style={styles.cardResumo}>
          <Text style={styles.subtitulo}>Relatório do período</Text>

          <View style={styles.linha}><Text style={styles.label}>Abertas:</Text><Text style={styles.valor}>{resumoGeral.abertas}</Text></View>
          <View style={styles.linha}><Text style={styles.label}>Encerradas:</Text><Text style={styles.valor}>{resumoGeral.encerradas}</Text></View>
          <View style={styles.linha}><Text style={styles.label}>Tempo bruto:</Text><Text style={styles.valor}>{formatarDuracao(resumoGeral.totalBruto)}</Text></View>
          <View style={styles.linha}><Text style={styles.label}>Pausas:</Text><Text style={styles.valor}>{formatarDuracao(resumoGeral.totalPausas)}</Text></View>
          <View style={styles.linha}><Text style={styles.label}>Trabalhado:</Text><Text style={styles.valorDestaque}>{formatarDuracao(resumoGeral.totalTrabalhado)}</Text></View>
          <View style={styles.linha}><Text style={styles.label}>Viagens:</Text><Text style={styles.valor}>{resumoGeral.totalViagens}</Text></View>
          <View style={styles.linha}><Text style={styles.label}>Jornadas com alerta:</Text><Text style={resumoGeral.jornadasComAlertas > 0 ? styles.valorAlerta : styles.valor}>{resumoGeral.jornadasComAlertas}</Text></View>
          <View style={styles.linha}><Text style={styles.label}>Total de alertas:</Text><Text style={resumoGeral.totalAlertas > 0 ? styles.valorAlerta : styles.valor}>{resumoGeral.totalAlertas}</Text></View>

          <View style={styles.exportacoes}>
            <TouchableOpacity
              style={[styles.botaoExportar, exportando && styles.botaoExportarDesabilitado]}
              onPress={exportarPDF}
              disabled={exportando}
            >
              <Text style={styles.botaoExportarTexto}>{exportando ? 'Gerando...' : 'Exportar PDF'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.cardFiltro}>
          <Text style={styles.subtitulo}>Filtrar por período</Text>
          <View style={styles.filtrosLinha}>
            {[
              ['hoje', 'Hoje'],
              ['ontem', 'Ontem'],
              ['semana', 'Semana'],
              ['mes', 'Mês'],
              ['todas', 'Todas'],
            ].map(([valor, texto]) => (
              <TouchableOpacity
                key={valor}
                style={[styles.filtroBotao, periodoSelecionado === valor && styles.filtroBotaoAtivo]}
                onPress={() => setPeriodoSelecionado(valor)}
              >
                <Text style={[styles.filtroTexto, periodoSelecionado === valor && styles.filtroTextoAtivo]}>{texto}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.cardFiltro}>
          <Text style={styles.subtitulo}>Filtrar por motorista</Text>

          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <TouchableOpacity
              style={[styles.filtroBotao, motoristaSelecionado === 'todos' && styles.filtroBotaoAtivo]}
              onPress={() => setMotoristaSelecionado('todos')}
            >
              <Text style={[styles.filtroTexto, motoristaSelecionado === 'todos' && styles.filtroTextoAtivo]}>Todos</Text>
            </TouchableOpacity>

            {motoristas.map((motorista) => (
              <TouchableOpacity
                key={motorista.id}
                style={[styles.filtroBotao, motoristaSelecionado === motorista.id && styles.filtroBotaoAtivo]}
                onPress={() => setMotoristaSelecionado(motorista.id)}
              >
                <Text style={[styles.filtroTexto, motoristaSelecionado === motorista.id && styles.filtroTextoAtivo]}>{motorista.nome}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={styles.cardFiltro}>
          <Text style={styles.subtitulo}>Filtrar por status</Text>
          <View style={styles.filtrosLinha}>
            {[
              ['todos', 'Todas'],
              ['aberta', 'Abertas'],
              ['encerrada', 'Encerradas'],
            ].map(([valor, texto]) => (
              <TouchableOpacity
                key={valor}
                style={[styles.filtroBotao, statusSelecionado === valor && styles.filtroBotaoAtivo]}
                onPress={() => setStatusSelecionado(valor)}
              >
                <Text style={[styles.filtroTexto, statusSelecionado === valor && styles.filtroTextoAtivo]}>{texto}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.espaco}>
            <Button title="Limpar filtros" onPress={limparFiltros} />
          </View>
        </View>

        <View style={styles.espaco}><Button title="Atualizar" onPress={buscarDadosAdmin} /></View>
        <View style={styles.espaco}><Button title="Configurações" onPress={() => navigation.navigate('Configuracoes')} /></View>
        <View style={styles.espaco}><Button title="Sair" onPress={sair} /></View>

        {carregando && <Text style={styles.info}>Carregando dados...</Text>}
        {!carregando && jornadasFiltradas.length === 0 && <Text style={styles.info}>Nenhuma jornada encontrada neste filtro.</Text>}

        {jornadasFiltradas.map((jornada) => {
          const resumo = jornada.resumo || criarResumoVazio();
          const resumoViagem = jornada.resumoViagem || {};
          const alertas = jornada.alertas || [];

          return (
            <TouchableOpacity
              key={jornada.id}
              style={[styles.card, alertas.length > 0 && styles.cardComAlerta]}
              activeOpacity={0.8}
              onPress={() => navigation.navigate('DetalhesJornada', { jornada })}
            >
              <Text style={styles.dataJornada}>{formatarApenasData(jornada.inicio)}</Text>
              <Text style={styles.motoristaNome}>{jornada.motorista_nome}</Text>

              <Text
                style={[
                  styles.statusCard,
                  jornada.statusAtual?.tipo === 'viagem' && styles.statusAzul,
                  jornada.statusAtual?.tipo === 'pausa' && styles.statusLaranja,
                  jornada.statusAtual?.tipo === 'sem_jornada' && styles.statusCinza,
                ]}
              >
                Status atual: {jornada.statusAtual?.texto || jornada.status}
              </Text>

              {alertas.length > 0 && (
                <View style={styles.caixaAlertas}>
                  <Text style={styles.caixaAlertasTitulo}>Atenção: {alertas.length} alerta(s)</Text>
                  {alertas.map((alerta, index) => (
                    <Text
                      key={`${jornada.id}-alerta-${index}`}
                      style={alerta.tipo === 'grave' ? styles.alertaGrave : alerta.tipo === 'medio' ? styles.alertaMedio : styles.alertaLeve}
                    >
                      ⚠ {alerta.texto}
                    </Text>
                  ))}
                </View>
              )}

              <View style={styles.divisor} />

              <View style={styles.linha}><Text style={styles.label}>Início:</Text><Text style={styles.valor}>{formatarData(jornada.inicio)}</Text></View>
              <View style={styles.linha}><Text style={styles.label}>Fim:</Text><Text style={styles.valor}>{formatarData(jornada.fim)}</Text></View>
              <View style={styles.linha}><Text style={styles.label}>Trabalhado:</Text><Text style={styles.valorDestaque}>{formatarDuracao(resumo.minutosTrabalhados)}</Text></View>
              <View style={styles.linha}><Text style={styles.label}>Pausas:</Text><Text style={styles.valor}>{formatarDuracao(resumo.minutosPausa)}</Text></View>
              <View style={styles.linha}><Text style={styles.label}>Viagens:</Text><Text style={styles.valor}>{resumo.totalViagens}</Text></View>

              {(jornada.veiculo || jornada.placa || jornada.km_inicial || jornada.km_final) && (
                <View style={styles.caixaVeiculo}>
                  <Text style={styles.caixaVeiculoTitulo}>Veículo</Text>
                  {jornada.veiculo && <Text style={styles.caixaVeiculoTexto}>Veículo: {jornada.veiculo}</Text>}
                  {jornada.placa && <Text style={styles.caixaVeiculoTexto}>Placa: {jornada.placa}</Text>}
                  {jornada.km_inicial !== null && jornada.km_inicial !== undefined && <Text style={styles.caixaVeiculoTexto}>KM inicial: {jornada.km_inicial}</Text>}
                  {jornada.km_final !== null && jornada.km_final !== undefined && <Text style={styles.caixaVeiculoTexto}>KM final: {jornada.km_final}</Text>}
                </View>
              )}

              {resumoViagem.temDados && (
                <View style={styles.caixaViagem}>
                  <Text style={styles.caixaViagemTitulo}>Última viagem</Text>
                  {resumoViagem.cliente && <Text style={styles.caixaViagemTexto}>Cliente: {resumoViagem.cliente}</Text>}
                  {resumoViagem.destino && <Text style={styles.caixaViagemTexto}>Destino: {resumoViagem.destino}</Text>}
                  {resumoViagem.observacaoInicio && <Text style={styles.caixaViagemTexto}>Obs. início: {resumoViagem.observacaoInicio}</Text>}
                  {resumoViagem.observacaoFim && <Text style={styles.caixaViagemTexto}>Obs. fim: {resumoViagem.observacaoFim}</Text>}
                </View>
              )}

              <Text style={styles.dica}>Toque para ver detalhes</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#f4f8ff' },
  titulo: { fontSize: 26, fontWeight: 'bold', marginBottom: 10, marginTop: 20, textAlign: 'center', color: '#0b2f66' },
  subtitulo: { fontSize: 18, fontWeight: 'bold', marginBottom: 8, color: '#0b2f66' },
  usuario: { marginBottom: 12, textAlign: 'center', color: '#5f6f86' },
  logoArea: { alignItems: 'center', marginBottom: 12 },
  logo: { width: '100%', height: 90 },
  cardResumo: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#d9e6f7' },
  cardFiltro: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#d9e6f7' },
  resumoTexto: { fontWeight: 'bold', marginBottom: 4, color: '#0b2f66' },
  periodoAtual: { marginTop: 8, color: '#0066cc', fontWeight: 'bold' },
  filtrosLinha: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filtroBotao: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20, backgroundColor: '#eaf2ff', marginRight: 8, marginTop: 8, borderWidth: 1, borderColor: '#d9e6f7' },
  filtroBotaoAtivo: { backgroundColor: '#0066cc', borderColor: '#0066cc' },
  filtroTexto: { color: '#0b2f66', fontWeight: 'bold' },
  filtroTextoAtivo: { color: '#fff' },
  exportacoes: { marginTop: 16, gap: 10 },
  botaoExportar: { backgroundColor: '#0066cc', padding: 13, borderRadius: 10, alignItems: 'center' },
  botaoExportarDesabilitado: { opacity: 0.6 },
  botaoExportarTexto: { color: '#fff', fontWeight: 'bold' },
  statusResumoLinha: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statusResumoBox: { width: '47%', backgroundColor: '#f4f8ff', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: '#d9e6f7' },
  statusResumoLabel: { color: '#5f6f86', fontSize: 12 },
  statusResumoValor: { color: '#0b2f66', fontSize: 18, fontWeight: 'bold' },
  statusMotoristaItem: { borderTopWidth: 1, borderTopColor: '#eef3fb', paddingTop: 10, marginTop: 10 },
  statusMotoristaNome: { color: '#0b2f66', fontWeight: 'bold' },
  statusMotoristaTexto: { color: '#008000', fontWeight: 'bold', marginTop: 2 },
  statusMotoristaDetalhe: { color: '#5f6f86', fontSize: 12, marginTop: 2 },
  statusAzul: { color: '#0066cc' },
  statusLaranja: { color: '#b26a00' },
  statusCinza: { color: '#666' },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginTop: 16, borderWidth: 1, borderColor: '#d9e6f7' },
  cardComAlerta: { borderColor: '#f0ad4e', borderWidth: 2 },
  dataJornada: { fontSize: 16, fontWeight: 'bold', color: '#5f6f86', marginBottom: 4 },
  motoristaNome: { fontSize: 18, fontWeight: 'bold', color: '#0b2f66' },
  statusCard: { color: '#008000', marginTop: 4, fontWeight: 'bold' },
  caixaAlertas: { backgroundColor: '#fff8e6', borderRadius: 10, padding: 12, marginTop: 12, borderWidth: 1, borderColor: '#f0ad4e' },
  caixaAlertasTitulo: { color: '#8a5a00', fontWeight: 'bold', marginBottom: 6 },
  alertaGrave: { color: '#b00020', fontWeight: 'bold', marginTop: 4, lineHeight: 19 },
  alertaMedio: { color: '#b26a00', fontWeight: 'bold', marginTop: 4, lineHeight: 19 },
  alertaLeve: { color: '#666', marginTop: 4, lineHeight: 19 },
  divisor: { height: 1, backgroundColor: '#eef3fb', marginVertical: 12 },
  linha: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginTop: 6 },
  label: { fontWeight: 'bold', color: '#333', flex: 1 },
  valor: { color: '#333', flex: 1, textAlign: 'right' },
  valorDestaque: { color: '#008000', fontWeight: 'bold', flex: 1, textAlign: 'right' },
  valorAlerta: { color: '#b00020', fontWeight: 'bold', flex: 1, textAlign: 'right' },
  caixaViagem: { backgroundColor: '#f4f8ff', borderRadius: 10, padding: 12, marginTop: 12, borderWidth: 1, borderColor: '#d9e6f7' },
  caixaViagemTitulo: { fontWeight: 'bold', color: '#0b2f66', marginBottom: 4 },
  caixaViagemTexto: { color: '#333', marginTop: 3, lineHeight: 19 },
  caixaVeiculo: { backgroundColor: '#eef7ff', borderRadius: 10, padding: 12, marginTop: 12, borderWidth: 1, borderColor: '#d9e6f7' },
  caixaVeiculoTitulo: { fontWeight: 'bold', color: '#0b2f66', marginBottom: 4 },
  caixaVeiculoTexto: { color: '#333', marginTop: 3, lineHeight: 19 },
  espaco: { marginTop: 10 },
  info: { textAlign: 'center', marginTop: 20, color: '#5f6f86' },
  dica: { marginTop: 12, textAlign: 'center', color: '#0066cc', fontWeight: 'bold' },
});
