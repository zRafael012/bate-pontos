import React, { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  ActivityIndicator,
} from 'react-native';

import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

import { supabase } from './src/supabase';

const STORAGE_EVENTOS_PENDENTES = '@controle_motorista:eventos_pendentes';
const STORAGE_JORNADAS_PENDENTES = '@controle_motorista:jornadas_pendentes';
const STORAGE_JORNADA_LOCAL = '@controle_motorista:jornada_local';

export default function App() {
  const [session, setSession] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [registrando, setRegistrando] = useState(false);

  const [online, setOnline] = useState(true);
  const [eventosPendentes, setEventosPendentes] = useState(0);
  const [jornadasPendentes, setJornadasPendentes] = useState(0);

  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [nome, setNome] = useState('');

  const [jornadaAtual, setJornadaAtual] = useState(null);
  const [eventos, setEventos] = useState([]);

  useEffect(() => {
    buscarSessao();

    const { data } = supabase.auth.onAuthStateChange((_event, sessionAtual) => {
      setSession(sessionAtual);
      setCarregando(false);
    });

    return () => {
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (session?.user) {
      iniciarDadosDoUsuario();
    }
  }, [session]);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(async (state) => {
      const conectado = Boolean(
        state.isConnected && state.isInternetReachable !== false
      );

      setOnline(conectado);

      if (conectado && session?.user) {
        await sincronizarTudo(false);
        await buscarJornadaAberta();
      }
    });

    return () => {
      unsubscribe();
    };
  }, [session]);

  async function iniciarDadosDoUsuario() {
    await carregarEventosPendentes();
    await carregarJornadasPendentes();
    await carregarJornadaLocal();
    await buscarJornadaAberta();
  }

  function gerarUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;

      return v.toString(16);
    });
  }

  async function buscarSessao() {
    const { data } = await supabase.auth.getSession();

    setSession(data.session);
    setCarregando(false);
  }

  async function verificarInternet() {
    const estadoRede = await NetInfo.fetch();

    const conectado = Boolean(
      estadoRede.isConnected && estadoRede.isInternetReachable !== false
    );

    setOnline(conectado);

    return conectado;
  }

  async function obterLocalizacao() {
    const { status } = await Location.requestForegroundPermissionsAsync();

    if (status !== 'granted') {
      Alert.alert(
        'Permissão negada',
        'Não foi possível acessar a localização.'
      );

      return {
        latitude: null,
        longitude: null,
      };
    }

    try {
      const ultimaLocalizacao = await Location.getLastKnownPositionAsync();

      if (ultimaLocalizacao) {
        return {
          latitude: ultimaLocalizacao.coords.latitude,
          longitude: ultimaLocalizacao.coords.longitude,
        };
      }

      const posicao = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      return {
        latitude: posicao.coords.latitude,
        longitude: posicao.coords.longitude,
      };
    } catch (error) {
      return {
        latitude: null,
        longitude: null,
      };
    }
  }

  async function salvarJornadaLocal(jornada) {
    if (!jornada) {
      await AsyncStorage.removeItem(STORAGE_JORNADA_LOCAL);
      return;
    }

    await AsyncStorage.setItem(STORAGE_JORNADA_LOCAL, JSON.stringify(jornada));
  }

  async function carregarJornadaLocal() {
    try {
      const texto = await AsyncStorage.getItem(STORAGE_JORNADA_LOCAL);
      const jornada = texto ? JSON.parse(texto) : null;

      if (jornada && jornada.status === 'aberta') {
        setJornadaAtual(jornada);
        return jornada;
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  async function carregarEventosPendentes() {
    try {
      const texto = await AsyncStorage.getItem(STORAGE_EVENTOS_PENDENTES);
      const lista = texto ? JSON.parse(texto) : [];

      setEventosPendentes(lista.length);

      return lista;
    } catch (error) {
      setEventosPendentes(0);
      return [];
    }
  }

  async function salvarEventoPendente(evento) {
    try {
      const listaAtual = await carregarEventosPendentes();

      const jaExiste = listaAtual.some((item) => item.id === evento.id);

      if (jaExiste) {
        return;
      }

      const novaLista = [...listaAtual, evento];

      await AsyncStorage.setItem(
        STORAGE_EVENTOS_PENDENTES,
        JSON.stringify(novaLista)
      );

      setEventosPendentes(novaLista.length);
    } catch (error) {
      Alert.alert(
        'Erro local',
        'Não foi possível salvar o evento pendente no celular.'
      );
    }
  }

  async function limparEventosPendentes() {
    await AsyncStorage.removeItem(STORAGE_EVENTOS_PENDENTES);
    setEventosPendentes(0);
  }

  async function carregarJornadasPendentes() {
    try {
      const texto = await AsyncStorage.getItem(STORAGE_JORNADAS_PENDENTES);
      const lista = texto ? JSON.parse(texto) : [];

      setJornadasPendentes(lista.length);

      return lista;
    } catch (error) {
      setJornadasPendentes(0);
      return [];
    }
  }

  async function salvarOperacaoJornadaPendente(operacao, jornada) {
    try {
      const listaAtual = await carregarJornadasPendentes();

      let novaLista = [...listaAtual];

      const indiceInsert = novaLista.findIndex(
        (item) => item.operacao === 'insert' && item.jornada.id === jornada.id
      );

      const indiceUpdate = novaLista.findIndex(
        (item) => item.operacao === 'update' && item.jornada.id === jornada.id
      );

      if (operacao === 'insert') {
        if (indiceInsert >= 0) {
          novaLista[indiceInsert] = {
            operacao: 'insert',
            jornada,
          };
        } else {
          novaLista.push({
            operacao: 'insert',
            jornada,
          });
        }
      }

      if (operacao === 'update') {
        if (indiceInsert >= 0) {
          novaLista[indiceInsert] = {
            operacao: 'insert',
            jornada,
          };
        } else if (indiceUpdate >= 0) {
          novaLista[indiceUpdate] = {
            operacao: 'update',
            jornada,
          };
        } else {
          novaLista.push({
            operacao: 'update',
            jornada,
          });
        }
      }

      await AsyncStorage.setItem(
        STORAGE_JORNADAS_PENDENTES,
        JSON.stringify(novaLista)
      );

      setJornadasPendentes(novaLista.length);
    } catch (error) {
      Alert.alert(
        'Erro local',
        'Não foi possível salvar a jornada pendente no celular.'
      );
    }
  }

  async function limparJornadasPendentes() {
    await AsyncStorage.removeItem(STORAGE_JORNADAS_PENDENTES);
    setJornadasPendentes(0);
  }

  async function sincronizarJornadasPendentes() {
    if (!session?.user) return false;

    const lista = await carregarJornadasPendentes();

    if (lista.length === 0) {
      return true;
    }

    const restantes = [];

    for (const item of lista) {
      if (item.operacao === 'insert') {
        const { error } = await supabase
          .from('jornadas')
          .upsert(item.jornada, {
            onConflict: 'id',
          });

        if (error) {
          console.log('Erro ao sincronizar jornada insert:', error.message);
          restantes.push(item);
        }
      }

      if (item.operacao === 'update') {
        const { error } = await supabase
          .from('jornadas')
          .update({
            fim: item.jornada.fim,
            status: item.jornada.status,
            latitude_fim: item.jornada.latitude_fim,
            longitude_fim: item.jornada.longitude_fim,
          })
          .eq('id', item.jornada.id);

        if (error) {
          console.log('Erro ao sincronizar jornada update:', error.message);
          restantes.push(item);
        }
      }
    }

    if (restantes.length > 0) {
      await AsyncStorage.setItem(
        STORAGE_JORNADAS_PENDENTES,
        JSON.stringify(restantes)
      );

      setJornadasPendentes(restantes.length);

      return false;
    }

    await limparJornadasPendentes();

    return true;
  }

  async function sincronizarEventosPendentes() {
    if (!session?.user) return false;

    const lista = await carregarEventosPendentes();

    if (lista.length === 0) {
      return true;
    }

    const eventosParaEnviar = lista.map((evento) => ({
      id: evento.id,
      jornada_id: evento.jornada_id,
      motorista_id: evento.motorista_id,
      tipo: evento.tipo,
      horario: evento.horario,
      latitude: evento.latitude,
      longitude: evento.longitude,
      observacao: evento.observacao,
    }));

    const { error } = await supabase
      .from('eventos_jornada')
      .upsert(eventosParaEnviar, {
        onConflict: 'id',
      });

    if (error) {
      console.log('Erro ao sincronizar eventos pendentes:', error.message);
      return false;
    }

    await limparEventosPendentes();

    return true;
  }

  async function sincronizarTudo(mostrarAlerta = true) {
    if (!session?.user) return;

    const temInternet = await verificarInternet();

    if (!temInternet) {
      if (mostrarAlerta) {
        Alert.alert(
          'Sem internet',
          'Os dados serão sincronizados quando a conexão voltar.'
        );
      }

      return;
    }

    const jornadasAntes = await carregarJornadasPendentes();
    const eventosAntes = await carregarEventosPendentes();

    const jornadasOk = await sincronizarJornadasPendentes();

    if (!jornadasOk) {
      return;
    }

    const eventosOk = await sincronizarEventosPendentes();

    if (eventosOk && jornadaAtual) {
      await buscarEventos(jornadaAtual.id);
    }

    const tinhaPendencia =
      jornadasAntes.length > 0 || eventosAntes.length > 0;

    if (mostrarAlerta && tinhaPendencia && jornadasOk && eventosOk) {
      Alert.alert('Sincronizado', 'Dados enviados para o Supabase.');
    }
  }

  async function cadastrar() {
    if (!email || !senha || !nome) {
      Alert.alert('Atenção', 'Preencha nome, e-mail e senha.');
      return;
    }

    setCarregando(true);

    const { data, error } = await supabase.auth.signUp({
      email,
      password: senha,
    });

    if (error) {
      setCarregando(false);
      Alert.alert('Erro no cadastro', error.message);
      return;
    }

    if (data.user) {
      const { error: profileError } = await supabase.from('profiles').insert({
        id: data.user.id,
        nome: nome,
        tipo: 'motorista',
      });

      if (profileError) {
        setCarregando(false);
        Alert.alert('Erro ao criar perfil', profileError.message);
        return;
      }
    }

    setCarregando(false);
    Alert.alert('Cadastro realizado', 'Agora faça login.');
  }

  async function login() {
    if (!email || !senha) {
      Alert.alert('Atenção', 'Preencha e-mail e senha.');
      return;
    }

    setCarregando(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: senha,
    });

    setCarregando(false);

    if (error) {
      Alert.alert('Erro no login', error.message);
    }
  }

  async function sair() {
    await supabase.auth.signOut();

    setJornadaAtual(null);
    setEventos([]);
  }

  async function buscarJornadaAberta() {
    if (!session?.user) return;

    const jornadaLocal = await carregarJornadaLocal();

    const temInternet = await verificarInternet();

    if (!temInternet) {
      return;
    }

    await sincronizarTudo(false);

    const { data, error } = await supabase
      .from('jornadas')
      .select('*')
      .eq('motorista_id', session.user.id)
      .eq('status', 'aberta')
      .order('inicio', { ascending: false })
      .limit(1);

    if (error) {
      console.log('Erro ao buscar jornada aberta:', error.message);

      if (jornadaLocal) {
        setJornadaAtual(jornadaLocal);
      }

      return;
    }

    const jornada = data && data.length > 0 ? data[0] : null;

    if (jornada) {
      setJornadaAtual(jornada);
      await salvarJornadaLocal(jornada);
      await buscarEventos(jornada.id);
      return;
    }

    const pendentes = await carregarJornadasPendentes();

    if (pendentes.length === 0) {
      setJornadaAtual(null);
      setEventos([]);
      await salvarJornadaLocal(null);
    }
  }

  async function buscarEventos(jornadaId) {
    const temInternet = await verificarInternet();

    if (!temInternet) {
      return;
    }

    const { data, error } = await supabase
      .from('eventos_jornada')
      .select('*')
      .eq('jornada_id', jornadaId)
      .order('horario', { ascending: true });

    if (error) {
      Alert.alert('Erro ao buscar eventos', error.message);
      return;
    }

    setEventos(data || []);
  }

  async function registrarEvento(tipo, jornadaId, observacao = null) {
    if (!session?.user) return;

    setRegistrando(true);

    const local = await obterLocalizacao();

    const evento = {
      id: gerarUUID(),
      jornada_id: jornadaId,
      motorista_id: session.user.id,
      tipo: tipo,
      horario: new Date().toISOString(),
      latitude: local.latitude,
      longitude: local.longitude,
      observacao: observacao,
      pendente: true,
    };

    setEventos((eventosAtuais) => [...eventosAtuais, evento]);

    const temInternet = await verificarInternet();

    if (!temInternet) {
      await salvarEventoPendente(evento);
      setRegistrando(false);
      return;
    }

    const { data, error } = await supabase
      .from('eventos_jornada')
      .insert({
        id: evento.id,
        jornada_id: evento.jornada_id,
        motorista_id: evento.motorista_id,
        tipo: evento.tipo,
        horario: evento.horario,
        latitude: evento.latitude,
        longitude: evento.longitude,
        observacao: evento.observacao,
      })
      .select()
      .single();

    setRegistrando(false);

    if (error) {
      await salvarEventoPendente(evento);
      return;
    }

    setEventos((eventosAtuais) =>
      eventosAtuais.map((item) =>
        item.id === evento.id ? data : item
      )
    );
  }

  async function iniciarJornada() {
    if (!session?.user) return;

    if (jornadaAtual && jornadaAtual.status === 'aberta') {
      Alert.alert(
        'Jornada já aberta',
        'Você precisa encerrar a jornada atual antes de iniciar outra.'
      );
      return;
    }

    setRegistrando(true);

    const local = await obterLocalizacao();

    const novaJornada = {
      id: gerarUUID(),
      motorista_id: session.user.id,
      inicio: new Date().toISOString(),
      fim: null,
      status: 'aberta',
      latitude_inicio: local.latitude,
      longitude_inicio: local.longitude,
      latitude_fim: null,
      longitude_fim: null,
    };

    setJornadaAtual(novaJornada);
    await salvarJornadaLocal(novaJornada);

    const temInternet = await verificarInternet();

    if (!temInternet) {
      await salvarOperacaoJornadaPendente('insert', novaJornada);
      await registrarEvento('inicio_jornada', novaJornada.id);

      setRegistrando(false);

      Alert.alert(
        'Jornada iniciada offline',
        'Ela será enviada para o Supabase quando a internet voltar.'
      );

      return;
    }

    const { error } = await supabase
      .from('jornadas')
      .insert(novaJornada);

    if (error) {
      await salvarOperacaoJornadaPendente('insert', novaJornada);
      await registrarEvento('inicio_jornada', novaJornada.id);

      setRegistrando(false);

      Alert.alert(
        'Jornada salva localmente',
        'Não foi possível enviar agora. O app tentará sincronizar depois.'
      );

      return;
    }

    await registrarEvento('inicio_jornada', novaJornada.id);

    setRegistrando(false);

    Alert.alert('Jornada iniciada', 'Horário registrado com sucesso.');
  }

  async function pausar() {
    if (!jornadaAtual) return;

    await registrarEvento('pausa', jornadaAtual.id);
  }

  async function retomar() {
    if (!jornadaAtual) return;

    await registrarEvento('retorno', jornadaAtual.id);
  }

  async function iniciarViagem() {
    if (!jornadaAtual) return;

    await registrarEvento('inicio_viagem', jornadaAtual.id);
  }

  async function finalizarViagem() {
    if (!jornadaAtual) return;

    await registrarEvento('fim_viagem', jornadaAtual.id);
  }

  async function encerrarJornada() {
    if (!jornadaAtual || !session?.user) return;

    setRegistrando(true);

    const local = await obterLocalizacao();

    const jornadaEncerrada = {
      ...jornadaAtual,
      fim: new Date().toISOString(),
      status: 'encerrada',
      latitude_fim: local.latitude,
      longitude_fim: local.longitude,
    };

    await registrarEvento('fim_jornada', jornadaAtual.id);

    const temInternet = await verificarInternet();

    if (!temInternet) {
      await salvarOperacaoJornadaPendente('update', jornadaEncerrada);
      await salvarJornadaLocal(null);

      setJornadaAtual(null);
      setEventos([]);
      setRegistrando(false);

      Alert.alert(
        'Jornada encerrada offline',
        'Ela será atualizada no Supabase quando a internet voltar.'
      );

      return;
    }

    const { error } = await supabase
      .from('jornadas')
      .update({
        fim: jornadaEncerrada.fim,
        status: 'encerrada',
        latitude_fim: jornadaEncerrada.latitude_fim,
        longitude_fim: jornadaEncerrada.longitude_fim,
      })
      .eq('id', jornadaEncerrada.id);

    if (error) {
      await salvarOperacaoJornadaPendente('update', jornadaEncerrada);

      await salvarJornadaLocal(null);

      setJornadaAtual(null);
      setEventos([]);
      setRegistrando(false);

      Alert.alert(
        'Jornada encerrada localmente',
        'Não foi possível enviar agora. O app tentará sincronizar depois.'
      );

      return;
    }

    await salvarJornadaLocal(null);

    setJornadaAtual(null);
    setEventos([]);
    setRegistrando(false);

    Alert.alert('Jornada encerrada', 'Horário final registrado com sucesso.');
  }

  function formatarData(dataISO) {
    if (!dataISO) return '-';

    return new Date(dataISO).toLocaleString('pt-BR');
  }

  function formatarTipoEvento(tipo) {
    const nomes = {
      inicio_jornada: 'Início da jornada',
      inicio_viagem: 'Início da viagem',
      fim_viagem: 'Fim da viagem',
      pausa: 'Pausa',
      retorno: 'Retorno',
      fim_jornada: 'Fim da jornada',
      observacao: 'Observação',
    };

    return nomes[tipo] || tipo;
  }

  if (carregando) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" />
        <Text style={styles.carregandoTexto}>Carregando...</Text>
      </SafeAreaView>
    );
  }

  if (!session) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.titulo}>Controle do Motorista</Text>

        <TextInput
          style={styles.input}
          placeholder="Nome"
          value={nome}
          onChangeText={setNome}
        />

        <TextInput
          style={styles.input}
          placeholder="E-mail"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <TextInput
          style={styles.input}
          placeholder="Senha"
          value={senha}
          onChangeText={setSenha}
          secureTextEntry
        />

        <View style={styles.espaco}>
          <Button title="Entrar" onPress={login} />
        </View>

        <View style={styles.espaco}>
          <Button title="Cadastrar motorista" onPress={cadastrar} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        <Text style={styles.titulo}>Controle de Jornada</Text>

        <View style={styles.statusConexao}>
          <Text style={online ? styles.statusOnline : styles.statusOffline}>
            {online ? 'Online' : 'Offline'}
          </Text>

          {jornadasPendentes > 0 && (
            <Text style={styles.statusPendente}>
              {jornadasPendentes} jornada(s) aguardando sincronização
            </Text>
          )}

          {eventosPendentes > 0 && (
            <Text style={styles.statusPendente}>
              {eventosPendentes} evento(s) aguardando sincronização
            </Text>
          )}
        </View>

        <Text style={styles.usuario}>Usuário: {session.user.email}</Text>

        {!jornadaAtual ? (
          <View style={styles.card}>
            <Text style={styles.subtitulo}>Nenhuma jornada aberta</Text>

            <Button
              title={registrando ? 'Iniciando...' : 'Iniciar jornada'}
              onPress={iniciarJornada}
              disabled={registrando}
            />
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.subtitulo}>Jornada aberta</Text>

            <Text>Início: {formatarData(jornadaAtual.inicio)}</Text>

            <View style={styles.espaco}>
              <Button
                title={registrando ? 'Registrando...' : 'Iniciar viagem'}
                onPress={iniciarViagem}
                disabled={registrando}
              />
            </View>

            <View style={styles.espaco}>
              <Button
                title={registrando ? 'Registrando...' : 'Finalizar viagem'}
                onPress={finalizarViagem}
                disabled={registrando}
              />
            </View>

            <View style={styles.espaco}>
              <Button
                title={registrando ? 'Registrando...' : 'Pausar'}
                onPress={pausar}
                disabled={registrando}
              />
            </View>

            <View style={styles.espaco}>
              <Button
                title={registrando ? 'Registrando...' : 'Retomar'}
                onPress={retomar}
                disabled={registrando}
              />
            </View>

            <View style={styles.espaco}>
              <Button
                title={registrando ? 'Encerrando...' : 'Encerrar jornada'}
                color="#b00020"
                onPress={encerrarJornada}
                disabled={registrando}
              />
            </View>
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.subtitulo}>Eventos do dia</Text>

          {eventos.length === 0 && <Text>Nenhum evento registrado.</Text>}

          {eventos.map((evento) => (
            <View key={evento.id} style={styles.evento}>
              <Text style={styles.eventoTipo}>
                {formatarTipoEvento(evento.tipo)}{' '}
                {evento.pendente ? '(pendente)' : ''}
              </Text>

              <Text>{formatarData(evento.horario)}</Text>

              {evento.latitude && evento.longitude && (
                <Text>
                  Local: {evento.latitude}, {evento.longitude}
                </Text>
              )}
            </View>
          ))}
        </View>

        <View style={styles.espaco}>
          <Button
            title="Sincronizar agora"
            onPress={() => sincronizarTudo(true)}
          />
        </View>

        <View style={styles.espaco}>
          <Button title="Sair" onPress={sair} />
        </View>
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
  carregandoTexto: {
    marginTop: 10,
    textAlign: 'center',
  },
  titulo: {
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 20,
    marginTop: 20,
    textAlign: 'center',
  },
  subtitulo: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  usuario: {
    marginBottom: 12,
    textAlign: 'center',
  },
  statusConexao: {
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  statusOnline: {
    textAlign: 'center',
    fontWeight: 'bold',
    color: '#008000',
  },
  statusOffline: {
    textAlign: 'center',
    fontWeight: 'bold',
    color: '#b00020',
  },
  statusPendente: {
    textAlign: 'center',
    fontWeight: 'bold',
    marginTop: 4,
    color: '#b26a00',
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  espaco: {
    marginTop: 10,
  },
  evento: {
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 10,
    marginTop: 10,
  },
  eventoTipo: {
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
});