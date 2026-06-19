import React from 'react';
import {
  Alert,
  Button,
  Linking,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

export default function DetalhesJornadaScreen({ route, navigation }) {
  const { jornada } = route.params || {};

  if (!jornada) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.info}>Jornada não encontrada.</Text>

        <View style={styles.espaco}>
          <Button title="Voltar" onPress={() => navigation.goBack()} />
        </View>
      </SafeAreaView>
    );
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

  const resumo = jornada.resumo || criarResumoVazio();
  const eventos = [...(jornada.eventos || [])].sort((a, b) => {
    return new Date(a.horario) - new Date(b.horario);
  });

  const alertas = jornada.alertas || [];
  const viagens = montarViagens(eventos);
  const ocorrencias = eventos.filter((evento) => evento.tipo === 'observacao');

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

  function calcularDuracao(inicioISO, fimISO) {
    if (!inicioISO || !fimISO) return null;

    const inicio = new Date(inicioISO);
    const fim = new Date(fimISO);

    if (fim <= inicio) return null;

    return Math.floor((fim - inicio) / 1000 / 60);
  }

  function calcularKmRodado() {
    if (
      jornada.km_inicial === null ||
      jornada.km_inicial === undefined ||
      jornada.km_final === null ||
      jornada.km_final === undefined
    ) {
      return null;
    }

    const inicial = Number(jornada.km_inicial);
    const final = Number(jornada.km_final);

    if (Number.isNaN(inicial) || Number.isNaN(final) || final < inicial) {
      return null;
    }

    return final - inicial;
  }

  function formatarTipoEvento(tipo) {
    const nomes = {
      inicio_jornada: 'Início da jornada',
      inicio_viagem: 'Início da viagem',
      fim_viagem: 'Fim da viagem',
      pausa: 'Pausa',
      retorno: 'Retorno',
      fim_jornada: 'Fim da jornada',
      observacao: 'Ocorrência/Observação',
    };

    return nomes[tipo] || tipo;
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

  function montarViagens(listaEventos) {
    const lista = [];
    let viagemAberta = null;

    for (const evento of listaEventos) {
      if (evento.tipo === 'inicio_viagem') {
        if (viagemAberta) {
          lista.push({
            ...viagemAberta,
            fim: null,
            fimEvento: null,
            finalizada: false,
          });
        }

        const dadosInicio = extrairDadosDaObservacao(evento.observacao);

        viagemAberta = {
          inicio: evento.horario,
          inicioEvento: evento,
          cliente: dadosInicio.cliente,
          destino: dadosInicio.destino,
          observacaoInicio: dadosInicio.observacao,
        };
      }

      if (evento.tipo === 'fim_viagem' && viagemAberta) {
        const dadosFim = extrairDadosDaObservacao(evento.observacao);

        lista.push({
          ...viagemAberta,
          fim: evento.horario,
          fimEvento: evento,
          observacaoFim: dadosFim.finalizacao || dadosFim.observacao,
          finalizada: true,
        });

        viagemAberta = null;
      }
    }

    if (viagemAberta) {
      lista.push({
        ...viagemAberta,
        fim: null,
        fimEvento: null,
        finalizada: false,
      });
    }

    return lista;
  }

  async function abrirMapa(latitude, longitude) {
    if (!latitude || !longitude) {
      Alert.alert(
        'Localização indisponível',
        'Este registro não possui coordenadas.'
      );
      return;
    }

    const url = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;

    try {
      const podeAbrir = await Linking.canOpenURL(url);

      if (!podeAbrir) {
        Alert.alert('Erro', 'Não foi possível abrir o mapa.');
        return;
      }

      await Linking.openURL(url);
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível abrir o mapa.');
    }
  }

  const kmRodado = calcularKmRodado();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        <Text style={styles.titulo}>Detalhes da Jornada</Text>

        <View style={styles.cardDestaque}>
          <Text style={styles.dataJornada}>
            {formatarApenasData(jornada.inicio)}
          </Text>

          <Text style={styles.subtitulo}>
            {jornada.status === 'aberta'
              ? 'Jornada aberta'
              : 'Jornada encerrada'}
          </Text>

          <View style={styles.linha}>
            <Text style={styles.label}>Motorista:</Text>
            <Text style={styles.valor}>{jornada.motorista_nome || 'Motorista'}</Text>
          </View>

          <View style={styles.linha}>
            <Text style={styles.label}>Início:</Text>
            <Text style={styles.valor}>{formatarData(jornada.inicio)}</Text>
          </View>

          <View style={styles.linha}>
            <Text style={styles.label}>Fim:</Text>
            <Text style={styles.valor}>{formatarData(jornada.fim)}</Text>
          </View>

          <View style={styles.linha}>
            <Text style={styles.label}>Status:</Text>
            <Text style={styles.valor}>{jornada.status}</Text>
          </View>
        </View>

        {alertas.length > 0 && (
          <View style={styles.cardAlerta}>
            <Text style={styles.subtituloAlerta}>Alertas da jornada</Text>

            {alertas.map((alerta, index) => (
              <Text
                key={`alerta-${index}`}
                style={
                  alerta.tipo === 'grave'
                    ? styles.alertaGrave
                    : alerta.tipo === 'medio'
                      ? styles.alertaMedio
                      : styles.alertaLeve
                }
              >
                ⚠ {alerta.texto}
              </Text>
            ))}
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.subtitulo}>Resumo geral</Text>

          <View style={styles.gradeResumo}>
            <View style={styles.resumoBox}>
              <Text style={styles.resumoLabel}>Trabalhado</Text>
              <Text style={styles.resumoValorDestaque}>
                {formatarDuracao(resumo.minutosTrabalhados)}
              </Text>
            </View>

            <View style={styles.resumoBox}>
              <Text style={styles.resumoLabel}>Tempo bruto</Text>
              <Text style={styles.resumoValor}>{formatarDuracao(resumo.minutosBrutos)}</Text>
            </View>

            <View style={styles.resumoBox}>
              <Text style={styles.resumoLabel}>Pausas</Text>
              <Text style={styles.resumoValor}>{formatarDuracao(resumo.minutosPausa)}</Text>
            </View>

            <View style={styles.resumoBox}>
              <Text style={styles.resumoLabel}>Viagem</Text>
              <Text style={styles.resumoValor}>{formatarDuracao(resumo.minutosViagem)}</Text>
            </View>

            <View style={styles.resumoBox}>
              <Text style={styles.resumoLabel}>Viagens</Text>
              <Text style={styles.resumoValor}>{resumo.totalViagens}</Text>
            </View>

            <View style={styles.resumoBox}>
              <Text style={styles.resumoLabel}>Eventos</Text>
              <Text style={styles.resumoValor}>{resumo.totalEventos}</Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.subtitulo}>Veículo e KM</Text>

          <View style={styles.linha}>
            <Text style={styles.label}>Veículo:</Text>
            <Text style={styles.valor}>{jornada.veiculo || '-'}</Text>
          </View>

          <View style={styles.linha}>
            <Text style={styles.label}>Placa:</Text>
            <Text style={styles.valor}>{jornada.placa || '-'}</Text>
          </View>

          <View style={styles.linha}>
            <Text style={styles.label}>KM inicial:</Text>
            <Text style={styles.valor}>{jornada.km_inicial ?? '-'}</Text>
          </View>

          <View style={styles.linha}>
            <Text style={styles.label}>KM final:</Text>
            <Text style={styles.valor}>{jornada.km_final ?? '-'}</Text>
          </View>

          <View style={styles.linha}>
            <Text style={styles.label}>KM rodado:</Text>
            <Text style={styles.valorDestaque}>{kmRodado !== null ? kmRodado : '-'}</Text>
          </View>

          <View style={styles.linha}>
            <Text style={styles.label}>Combustível inicial:</Text>
            <Text style={styles.valor}>{jornada.combustivel_inicial || '-'}</Text>
          </View>

          <View style={styles.linha}>
            <Text style={styles.label}>Combustível final:</Text>
            <Text style={styles.valor}>{jornada.combustivel_final || '-'}</Text>
          </View>

          {jornada.observacao_veiculo_inicio && (
            <Text style={styles.observacao}>
              Obs. início: {jornada.observacao_veiculo_inicio}
            </Text>
          )}

          {jornada.observacao_veiculo_fim && (
            <Text style={styles.observacao}>
              Obs. fim: {jornada.observacao_veiculo_fim}
            </Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.subtitulo}>Viagens da jornada</Text>

          {viagens.length === 0 && (
            <Text style={styles.infoPequena}>Nenhuma viagem registrada nesta jornada.</Text>
          )}

          {viagens.map((viagem, index) => {
            const duracao = calcularDuracao(viagem.inicio, viagem.fim);

            return (
              <View key={`viagem-${index}`} style={styles.viagemBox}>
                <Text style={styles.viagemTitulo}>Viagem {index + 1}</Text>

                <Text
                  style={
                    viagem.finalizada
                      ? styles.statusViagemFinalizada
                      : styles.statusViagemAberta
                  }
                >
                  {viagem.finalizada ? 'Finalizada' : 'Em andamento'}
                </Text>

                <View style={styles.linha}>
                  <Text style={styles.label}>Início:</Text>
                  <Text style={styles.valor}>{formatarData(viagem.inicio)}</Text>
                </View>

                <View style={styles.linha}>
                  <Text style={styles.label}>Fim:</Text>
                  <Text style={styles.valor}>{formatarData(viagem.fim)}</Text>
                </View>

                <View style={styles.linha}>
                  <Text style={styles.label}>Duração:</Text>
                  <Text style={styles.valor}>{duracao ? formatarDuracao(duracao) : '-'}</Text>
                </View>

                {viagem.cliente && <Text style={styles.viagemTexto}>Cliente: {viagem.cliente}</Text>}
                {viagem.destino && <Text style={styles.viagemTexto}>Destino: {viagem.destino}</Text>}
                {viagem.observacaoInicio && <Text style={styles.viagemTexto}>Obs. início: {viagem.observacaoInicio}</Text>}
                {viagem.observacaoFim && <Text style={styles.viagemTexto}>Obs. fim: {viagem.observacaoFim}</Text>}
              </View>
            );
          })}
        </View>

        <View style={styles.card}>
          <Text style={styles.subtitulo}>Ocorrências</Text>

          {ocorrencias.length === 0 && (
            <Text style={styles.infoPequena}>Nenhuma ocorrência registrada.</Text>
          )}

          {ocorrencias.map((evento, index) => (
            <View key={evento.id} style={styles.ocorrenciaBox}>
              <Text style={styles.ocorrenciaTitulo}>Ocorrência {index + 1}</Text>
              <Text style={styles.eventoHorario}>{formatarData(evento.horario)}</Text>
              {evento.observacao && <Text style={styles.observacao}>{evento.observacao}</Text>}
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.subtitulo}>Localização da Jornada</Text>

          {jornada.latitude_inicio && jornada.longitude_inicio ? (
            <View style={styles.localBox}>
              <Text style={styles.localTitulo}>Local de início</Text>
              <Text style={styles.localTexto}>{jornada.latitude_inicio}, {jornada.longitude_inicio}</Text>

              <View style={styles.espaco}>
                <Button
                  title="Abrir início no mapa"
                  onPress={() => abrirMapa(jornada.latitude_inicio, jornada.longitude_inicio)}
                />
              </View>
            </View>
          ) : (
            <Text style={styles.infoPequena}>Local de início não registrado.</Text>
          )}

          {jornada.latitude_fim && jornada.longitude_fim ? (
            <View style={styles.localBox}>
              <Text style={styles.localTitulo}>Local de fim</Text>
              <Text style={styles.localTexto}>{jornada.latitude_fim}, {jornada.longitude_fim}</Text>

              <View style={styles.espaco}>
                <Button
                  title="Abrir fim no mapa"
                  onPress={() => abrirMapa(jornada.latitude_fim, jornada.longitude_fim)}
                />
              </View>
            </View>
          ) : (
            <Text style={styles.infoPequena}>Local de fim não registrado.</Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.subtitulo}>Linha do tempo de eventos</Text>

          {eventos.length === 0 && <Text style={styles.infoPequena}>Nenhum evento registrado.</Text>}

          {eventos.map((evento, index) => (
            <View key={evento.id} style={styles.evento}>
              <View style={styles.eventoMarcador}>
                <Text style={styles.eventoNumero}>{index + 1}</Text>
              </View>

              <View style={styles.eventoConteudo}>
                <Text style={styles.eventoTipo}>{formatarTipoEvento(evento.tipo)}</Text>
                <Text style={styles.eventoHorario}>{formatarData(evento.horario)}</Text>

                {evento.observacao && <Text style={styles.observacao}>{evento.observacao}</Text>}

                {evento.latitude && evento.longitude ? (
                  <>
                    <Text style={styles.eventoLocal}>Local: {evento.latitude}, {evento.longitude}</Text>

                    <View style={styles.espaco}>
                      <Button
                        title="Abrir evento no mapa"
                        onPress={() => abrirMapa(evento.latitude, evento.longitude)}
                      />
                    </View>
                  </>
                ) : (
                  <Text style={styles.infoPequena}>Evento sem localização.</Text>
                )}
              </View>
            </View>
          ))}
        </View>

        <View style={styles.espaco}>
          <Button title="Voltar" onPress={() => navigation.goBack()} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#f4f8ff' },
  titulo: { fontSize: 26, fontWeight: 'bold', marginBottom: 20, marginTop: 20, textAlign: 'center', color: '#0b2f66' },
  subtitulo: { fontSize: 18, fontWeight: 'bold', marginBottom: 8, color: '#0b2f66' },
  subtituloAlerta: { fontSize: 18, fontWeight: 'bold', marginBottom: 8, color: '#8a5a00' },
  dataJornada: { fontSize: 16, fontWeight: 'bold', color: '#5f6f86', marginBottom: 4 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#d9e6f7' },
  cardDestaque: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 2, borderColor: '#0066cc' },
  cardAlerta: { backgroundColor: '#fff8e6', borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#f0ad4e' },
  alertaGrave: { color: '#b00020', fontWeight: 'bold', marginTop: 4, lineHeight: 20 },
  alertaMedio: { color: '#b26a00', fontWeight: 'bold', marginTop: 4, lineHeight: 20 },
  alertaLeve: { color: '#666', marginTop: 4, lineHeight: 20 },
  gradeResumo: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  resumoBox: { width: '47%', backgroundColor: '#f4f8ff', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#d9e6f7' },
  resumoLabel: { color: '#5f6f86', fontSize: 13, marginBottom: 4 },
  resumoValor: { color: '#0b2f66', fontWeight: 'bold', fontSize: 16 },
  resumoValorDestaque: { color: '#008000', fontWeight: 'bold', fontSize: 16 },
  linha: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginTop: 6 },
  label: { fontWeight: 'bold', color: '#333', flex: 1 },
  valor: { color: '#333', flex: 1, textAlign: 'right' },
  valorDestaque: { color: '#008000', fontWeight: 'bold', flex: 1, textAlign: 'right' },
  localBox: { marginTop: 10, borderTopWidth: 1, borderTopColor: '#eef3fb', paddingTop: 10 },
  localTitulo: { fontWeight: 'bold', color: '#0b2f66' },
  localTexto: { color: '#5f6f86', marginTop: 2 },
  viagemBox: { backgroundColor: '#f4f8ff', borderRadius: 10, padding: 12, marginTop: 12, borderWidth: 1, borderColor: '#d9e6f7' },
  viagemTitulo: { fontWeight: 'bold', color: '#0b2f66', fontSize: 16 },
  statusViagemFinalizada: { color: '#008000', fontWeight: 'bold', marginTop: 2, marginBottom: 6 },
  statusViagemAberta: { color: '#b26a00', fontWeight: 'bold', marginTop: 2, marginBottom: 6 },
  viagemTexto: { color: '#333', marginTop: 5, lineHeight: 20 },
  ocorrenciaBox: { backgroundColor: '#fff8e6', borderRadius: 10, padding: 12, marginTop: 12, borderWidth: 1, borderColor: '#f0ad4e' },
  ocorrenciaTitulo: { color: '#8a5a00', fontWeight: 'bold' },
  evento: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#eef3fb', paddingTop: 12, marginTop: 12 },
  eventoMarcador: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#0066cc', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  eventoNumero: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
  eventoConteudo: { flex: 1 },
  eventoTipo: { fontWeight: 'bold', textTransform: 'uppercase', color: '#0b2f66' },
  eventoHorario: { color: '#333', marginTop: 2 },
  eventoLocal: { color: '#666', fontSize: 12, marginTop: 4 },
  observacao: { color: '#333', marginTop: 4, fontStyle: 'italic', lineHeight: 20 },
  espaco: { marginTop: 10 },
  info: { textAlign: 'center', marginTop: 20, color: '#5f6f86' },
  infoPequena: { marginTop: 8, color: '#5f6f86', lineHeight: 20 },
});
