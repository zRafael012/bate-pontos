import React, { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
} from 'react-native';

import { supabase } from '../lib/supabase';

export default function HistoricoScreen({ session, navigation }) {
  const [jornadas, setJornadas] = useState([]);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    buscarHistorico();
  }, []);

  async function buscarHistorico() {
    if (!session?.user) return;

    setCarregando(true);

    const { data: jornadasData, error: jornadasError } = await supabase
      .from('jornadas')
      .select('*')
      .eq('motorista_id', session.user.id)
      .order('inicio', { ascending: false })
      .limit(30);

    if (jornadasError) {
      setCarregando(false);
      Alert.alert('Erro ao buscar histórico', jornadasError.message);
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

      const jornadasSemEventos = jornadasEncontradas.map((jornada) => ({
        ...jornada,
        eventos: [],
        resumo: criarResumoVazio(),
      }));

      setJornadas(jornadasSemEventos);
      return;
    }

    const eventosEncontrados = eventosData || [];

    const jornadasComResumo = jornadasEncontradas.map((jornada) => {
      const eventosDaJornada = eventosEncontrados.filter(
        (evento) => evento.jornada_id === jornada.id
      );

      const resumo = calcularResumoJornada(jornada, eventosDaJornada);

      return {
        ...jornada,
        eventos: eventosDaJornada,
        resumo,
      };
    });

    setJornadas(jornadasComResumo);
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

    const minutosPausa = calcularTempoEntreEventos(
      eventos,
      'pausa',
      'retorno'
    );

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

  function formatarData(dataISO) {
    if (!dataISO) return '-';
    return new Date(dataISO).toLocaleString('pt-BR');
  }

  function formatarApenasData(dataISO) {
    if (!dataISO) return '-';
    return new Date(dataISO).toLocaleDateString('pt-BR');
  }

  function formatarDuracao(minutos) {
    if (!minutos || minutos <= 0) {
      return '0h 00min';
    }

    const horas = Math.floor(minutos / 60);
    const mins = minutos % 60;

    return `${horas}h ${String(mins).padStart(2, '0')}min`;
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        <Text style={styles.titulo}>Histórico de Jornadas</Text>

        <View style={styles.espaco}>
          <Button title="Atualizar" onPress={buscarHistorico} />
        </View>

        <View style={styles.espaco}>
          <Button title="Voltar" onPress={() => navigation.goBack()} />
        </View>

        {carregando && (
          <Text style={styles.info}>Carregando histórico...</Text>
        )}

        {!carregando && jornadas.length === 0 && (
          <Text style={styles.info}>Nenhuma jornada encontrada.</Text>
        )}

        {jornadas.map((jornada) => {
          const resumo = jornada.resumo || criarResumoVazio();
          const eventos = jornada.eventos || [];

          return (
            <TouchableOpacity
              key={jornada.id}
              style={styles.card}
              activeOpacity={0.8}
              onPress={() =>
                navigation.navigate('DetalhesJornada', {
                  jornada: {
                    ...jornada,
                    resumo,
                    eventos,
                  },
                })
              }
            >
              <Text style={styles.dataJornada}>
                {formatarApenasData(jornada.inicio)}
              </Text>

              <Text style={styles.subtitulo}>
                {jornada.status === 'aberta'
                  ? 'Jornada aberta'
                  : 'Jornada encerrada'}
              </Text>

              <View style={styles.linha}>
                <Text style={styles.label}>Início:</Text>
                <Text style={styles.valor}>{formatarData(jornada.inicio)}</Text>
              </View>

              <View style={styles.linha}>
                <Text style={styles.label}>Fim:</Text>
                <Text style={styles.valor}>{formatarData(jornada.fim)}</Text>
              </View>

              <View style={styles.divisor} />

              <View style={styles.linha}>
                <Text style={styles.label}>Tempo bruto:</Text>
                <Text style={styles.valor}>
                  {formatarDuracao(resumo.minutosBrutos)}
                </Text>
              </View>

              <View style={styles.linha}>
                <Text style={styles.label}>Pausas:</Text>
                <Text style={styles.valor}>
                  {formatarDuracao(resumo.minutosPausa)}
                </Text>
              </View>

              <View style={styles.linha}>
                <Text style={styles.label}>Trabalhado real:</Text>
                <Text style={styles.valorDestaque}>
                  {formatarDuracao(resumo.minutosTrabalhados)}
                </Text>
              </View>

              <View style={styles.linha}>
                <Text style={styles.label}>Tempo em viagem:</Text>
                <Text style={styles.valor}>
                  {formatarDuracao(resumo.minutosViagem)}
                </Text>
              </View>

              <View style={styles.linha}>
                <Text style={styles.label}>Viagens:</Text>
                <Text style={styles.valor}>{resumo.totalViagens}</Text>
              </View>

              <View style={styles.linha}>
                <Text style={styles.label}>Eventos:</Text>
                <Text style={styles.valor}>{resumo.totalEventos}</Text>
              </View>

              <Text style={styles.dica}>Toque para ver detalhes</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f4f4f4',
  },
  titulo: {
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 20,
    marginTop: 20,
    textAlign: 'center',
  },
  subtitulo: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  dataJornada: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#555',
    marginBottom: 4,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  espaco: {
    marginTop: 10,
  },
  info: {
    textAlign: 'center',
    marginTop: 20,
  },
  linha: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 6,
  },
  label: {
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  valor: {
    color: '#333',
    flex: 1,
    textAlign: 'right',
  },
  valorDestaque: {
    color: '#008000',
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'right',
  },
  divisor: {
    height: 1,
    backgroundColor: '#eee',
    marginVertical: 12,
  },
  dica: {
    marginTop: 12,
    textAlign: 'center',
    color: '#0066cc',
    fontWeight: 'bold',
  },
});