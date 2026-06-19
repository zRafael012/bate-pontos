import React from 'react';
import {
  Button,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

export default function ConfiguracoesScreen({
  session,
  perfil,
  online,
  jornadasPendentes,
  eventosPendentes,
  jornadaAtual,
  sincronizarTudo,
  sair,
  navigation,
}) {
  function formatarData(dataISO) {
    if (!dataISO) return '-';
    return new Date(dataISO).toLocaleString('pt-BR');
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        <Text style={styles.titulo}>Configurações</Text>

        <View style={styles.card}>
          <Text style={styles.subtitulo}>Usuário</Text>

          <View style={styles.linha}>
            <Text style={styles.label}>Nome:</Text>
            <Text style={styles.valor}>{perfil?.nome || '-'}</Text>
          </View>

          <View style={styles.linha}>
            <Text style={styles.label}>E-mail:</Text>
            <Text style={styles.valor}>{session?.user?.email || '-'}</Text>
          </View>

          <View style={styles.linha}>
            <Text style={styles.label}>Tipo:</Text>
            <Text style={styles.valor}>{perfil?.tipo || '-'}</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.subtitulo}>Conexão e sincronização</Text>

          <View style={styles.linha}>
            <Text style={styles.label}>Status:</Text>
            <Text style={online ? styles.valorOnline : styles.valorOffline}>
              {online ? 'Online' : 'Offline'}
            </Text>
          </View>

          <View style={styles.linha}>
            <Text style={styles.label}>Jornadas pendentes:</Text>
            <Text style={styles.valor}>{jornadasPendentes}</Text>
          </View>

          <View style={styles.linha}>
            <Text style={styles.label}>Eventos pendentes:</Text>
            <Text style={styles.valor}>{eventosPendentes}</Text>
          </View>

          <View style={styles.espaco}>
            <Button
              title="Sincronizar agora"
              onPress={() => sincronizarTudo(true)}
            />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.subtitulo}>Jornada atual</Text>

          {jornadaAtual ? (
            <>
              <View style={styles.linha}>
                <Text style={styles.label}>Status:</Text>
                <Text style={styles.valor}>{jornadaAtual.status}</Text>
              </View>

              <View style={styles.linha}>
                <Text style={styles.label}>Início:</Text>
                <Text style={styles.valor}>{formatarData(jornadaAtual.inicio)}</Text>
              </View>

              <View style={styles.linha}>
                <Text style={styles.label}>Veículo:</Text>
                <Text style={styles.valor}>{jornadaAtual.veiculo || '-'}</Text>
              </View>

              <View style={styles.linha}>
                <Text style={styles.label}>Placa:</Text>
                <Text style={styles.valor}>{jornadaAtual.placa || '-'}</Text>
              </View>
            </>
          ) : (
            <Text style={styles.infoPequena}>Nenhuma jornada aberta.</Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.subtitulo}>Aplicativo</Text>

          <View style={styles.linha}>
            <Text style={styles.label}>Versão:</Text>
            <Text style={styles.valor}>2.0.0</Text>
          </View>

          <Text style={styles.infoPequena}>
            As notificações locais avisam sobre jornada aberta há muito tempo,
            pausa longa e viagem em andamento.
          </Text>
        </View>

        <View style={styles.espaco}>
          <Button title="Voltar" onPress={() => navigation.goBack()} />
        </View>

        <View style={styles.espaco}>
          <Button title="Sair" color="#b00020" onPress={sair} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f4f8ff',
  },
  titulo: {
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 20,
    marginTop: 20,
    textAlign: 'center',
    color: '#0b2f66',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#d9e6f7',
  },
  subtitulo: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#0b2f66',
  },
  linha: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 8,
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
  valorOnline: {
    color: '#008000',
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'right',
  },
  valorOffline: {
    color: '#b00020',
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'right',
  },
  infoPequena: {
    marginTop: 8,
    color: '#5f6f86',
    lineHeight: 20,
  },
  espaco: {
    marginTop: 10,
  },
});
