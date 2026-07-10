import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  SafeAreaView,
  StyleSheet,
  Text,
} from 'react-native';
import * as Location from 'expo-location';
import NetInfo from '@react-native-community/netinfo';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { supabase } from './src/lib/supabase';

import LoginScreen from './src/screens/LoginScreen';
import MotoristaScreen from './src/screens/MotoristaScreen';
import HistoricoScreen from './src/screens/HistoricoScreen';
import DetalhesJornadaScreen from './src/screens/DetalhesJornadaScreen';
import AdminScreen from './src/screens/AdminScreen';
import ConfiguracoesScreen from './src/screens/ConfiguracoesScreen';

import {
  inicializarBancoLocal,
  salvarJornadaLocalSQLite,
  carregarJornadaLocalSQLite,
  salvarEventoPendenteSQLite,
  listarEventosPendentesSQLite,
  contarEventosPendentesSQLite,
  limparEventosPendentesSQLite,
  salvarOperacaoJornadaPendenteSQLite,
  listarJornadasPendentesSQLite,
  contarJornadasPendentesSQLite,
  limparJornadasPendentesSQLite,
  substituirJornadasPendentesSQLite,
} from './src/lib/localDb';

import { COLORS } from './src/constants/colors';
import { EVENTO_TIPOS } from './src/constants/eventoTipos';
import {
  JORNADA_OPERACOES_PENDENTES,
  JORNADA_STATUS,
} from './src/constants/jornadaStatus';
import { gerarUUID } from './src/utils/idUtils';
import { normalizarNumero } from './src/utils/numberUtils';

const Stack = createNativeStackNavigator();
const logo = require('./assets/logo.png');

async function cancelarNotificacoesJornada() {
  return true;
}

export default function App() {
  const [session, setSession] = useState(null);
  const [perfil, setPerfil] = useState(null);
  const [carregandoPerfil, setCarregandoPerfil] = useState(false);
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
    iniciarApp();

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

  async function iniciarApp() {
    try {
      await inicializarBancoLocal();
      await buscarSessao();
    } catch (error) {
      console.log('Erro ao iniciar app:', error);
      await buscarSessao();
    }
  }

  async function iniciarDadosDoUsuario() {
    await buscarPerfil();
    await atualizarContadoresPendentes();
    await carregarJornadaLocal();
    await buscarJornadaAberta();
  }

  async function buscarSessao() {
    const { data } = await supabase.auth.getSession();

    setSession(data.session);
    setCarregando(false);
  }

  async function buscarPerfil() {
    if (!session?.user) return;

    setCarregandoPerfil(true);

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();

    setCarregandoPerfil(false);

    if (error) {
      console.log('Erro ao buscar perfil:', error.message);
      setPerfil(null);
      return;
    }

    setPerfil(data);
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

  async function atualizarContadoresPendentes() {
    const totalEventos = await contarEventosPendentesSQLite();
    const totalJornadas = await contarJornadasPendentesSQLite();

    setEventosPendentes(totalEventos);
    setJornadasPendentes(totalJornadas);

    return {
      totalEventos,
      totalJornadas,
    };
  }

  async function salvarJornadaLocal(jornada) {
    await salvarJornadaLocalSQLite(jornada);
  }

  async function carregarJornadaLocal() {
    try {
      const jornada = await carregarJornadaLocalSQLite();

      if (jornada && jornada.status === JORNADA_STATUS.ABERTA) {
        setJornadaAtual(jornada);
        return jornada;
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  async function salvarEventoPendente(evento) {
    try {
      await salvarEventoPendenteSQLite(evento);
      await atualizarContadoresPendentes();
    } catch (error) {
      Alert.alert(
        'Erro local',
        'Não foi possível salvar o evento pendente no SQLite.'
      );
    }
  }

  async function limparEventosPendentes() {
    await limparEventosPendentesSQLite();
    await atualizarContadoresPendentes();
  }

  async function salvarOperacaoJornadaPendente(operacao, jornada) {
    try {
      await salvarOperacaoJornadaPendenteSQLite(operacao, jornada);
      await atualizarContadoresPendentes();
    } catch (error) {
      Alert.alert(
        'Erro local',
        'Não foi possível salvar a jornada pendente no SQLite.'
      );
    }
  }

  async function limparJornadasPendentes() {
    await limparJornadasPendentesSQLite();
    await atualizarContadoresPendentes();
  }

  function montarUpdateJornada(jornada) {
    return {
      fim: jornada.fim,
      status: jornada.status,
      latitude_fim: jornada.latitude_fim,
      longitude_fim: jornada.longitude_fim,
      km_final: jornada.km_final,
      combustivel_final: jornada.combustivel_final,
      observacao_veiculo_fim: jornada.observacao_veiculo_fim,
    };
  }

  async function sincronizarJornadasPendentes() {
    if (!session?.user) return false;

    const lista = await listarJornadasPendentesSQLite();

    if (lista.length === 0) {
      return true;
    }

    const restantes = [];

    for (const item of lista) {
      if (item.operacao === JORNADA_OPERACOES_PENDENTES.INSERT) {
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

      if (item.operacao === JORNADA_OPERACOES_PENDENTES.UPDATE) {
        const { error } = await supabase
          .from('jornadas')
          .update(montarUpdateJornada(item.jornada))
          .eq('id', item.jornada.id);

        if (error) {
          console.log('Erro ao sincronizar jornada update:', error.message);
          restantes.push(item);
        }
      }
    }

    if (restantes.length > 0) {
      await substituirJornadasPendentesSQLite(restantes);
      await atualizarContadoresPendentes();
      return false;
    }

    await limparJornadasPendentes();
    return true;
  }

  async function sincronizarEventosPendentes() {
    if (!session?.user) return false;

    const lista = await listarEventosPendentesSQLite();

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

    const contadoresAntes = await atualizarContadoresPendentes();

    const jornadasOk = await sincronizarJornadasPendentes();

    if (!jornadasOk) {
      return;
    }

    const eventosOk = await sincronizarEventosPendentes();

    if (eventosOk && jornadaAtual) {
      await buscarEventos(jornadaAtual.id);
    }

    const tinhaPendencia =
      contadoresAntes.totalEventos > 0 || contadoresAntes.totalJornadas > 0;

    if (mostrarAlerta && tinhaPendencia && jornadasOk && eventosOk) {
      Alert.alert('Sincronizado', 'Dados enviados para o Supabase.');
    }

    await atualizarContadoresPendentes();
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
    await cancelarNotificacoesJornada();
    await supabase.auth.signOut();
    setPerfil(null);
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
      .eq('status', JORNADA_STATUS.ABERTA)
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

    const contadores = await atualizarContadoresPendentes();

    if (contadores.totalJornadas === 0) {
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
      eventosAtuais.map((item) => (item.id === evento.id ? data : item))
    );
  }

  async function iniciarJornada(dadosVeiculo = {}) {
    if (!session?.user) return;

    if (jornadaAtual && jornadaAtual.status === JORNADA_STATUS.ABERTA) {
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
      status: JORNADA_STATUS.ABERTA,
      latitude_inicio: local.latitude,
      longitude_inicio: local.longitude,
      latitude_fim: null,
      longitude_fim: null,
      veiculo: dadosVeiculo.veiculo?.trim() || null,
      placa: dadosVeiculo.placa?.trim()?.toUpperCase() || null,
      km_inicial: normalizarNumero(dadosVeiculo.kmInicial),
      km_final: null,
      combustivel_inicial: dadosVeiculo.combustivelInicial?.trim() || null,
      combustivel_final: null,
      observacao_veiculo_inicio:
        dadosVeiculo.observacaoVeiculoInicio?.trim() || null,
      observacao_veiculo_fim: null,
    };

    setJornadaAtual(novaJornada);
    await salvarJornadaLocal(novaJornada);

    const temInternet = await verificarInternet();

    if (!temInternet) {
      await salvarOperacaoJornadaPendente(
        JORNADA_OPERACOES_PENDENTES.INSERT,
        novaJornada
      );
      await registrarEvento(EVENTO_TIPOS.INICIO_JORNADA, novaJornada.id);
      setRegistrando(false);

      Alert.alert(
        'Jornada iniciada offline',
        'Ela será enviada para o Supabase quando a internet voltar.'
      );
      return;
    }

    const { error } = await supabase.from('jornadas').insert(novaJornada);

    if (error) {
      await salvarOperacaoJornadaPendente(
        JORNADA_OPERACOES_PENDENTES.INSERT,
        novaJornada
      );
      await registrarEvento(EVENTO_TIPOS.INICIO_JORNADA, novaJornada.id);
      setRegistrando(false);

      Alert.alert(
        'Jornada salva localmente',
        'Não foi possível enviar agora. O app tentará sincronizar depois.'
      );
      return;
    }

    await registrarEvento(EVENTO_TIPOS.INICIO_JORNADA, novaJornada.id);
    setRegistrando(false);

    Alert.alert('Jornada iniciada', 'Horário registrado com sucesso.');
  }

  async function pausar() {
    if (!jornadaAtual) return;

    await registrarEvento(EVENTO_TIPOS.PAUSA, jornadaAtual.id);
  }

  async function retomar() {
    if (!jornadaAtual) return;

    await registrarEvento(EVENTO_TIPOS.RETORNO, jornadaAtual.id);
  }

  async function iniciarViagem(observacao = null) {
    if (!jornadaAtual) return;

    await registrarEvento(
      EVENTO_TIPOS.INICIO_VIAGEM,
      jornadaAtual.id,
      observacao
    );
  }

  async function finalizarViagem(observacao = null) {
    if (!jornadaAtual) return;

    await registrarEvento(EVENTO_TIPOS.FIM_VIAGEM, jornadaAtual.id, observacao);
  }

  async function registrarOcorrencia(observacao = null) {
    if (!jornadaAtual) return;

    await registrarEvento(EVENTO_TIPOS.OBSERVACAO, jornadaAtual.id, observacao);
  }

  async function encerrarJornada(dadosEncerramento = {}) {
    if (!jornadaAtual || !session?.user) return;

    setRegistrando(true);

    const local = await obterLocalizacao();

    const jornadaEncerrada = {
      ...jornadaAtual,
      fim: new Date().toISOString(),
      status: JORNADA_STATUS.ENCERRADA,
      latitude_fim: local.latitude,
      longitude_fim: local.longitude,
      km_final: normalizarNumero(dadosEncerramento.kmFinal),
      combustivel_final: dadosEncerramento.combustivelFinal?.trim() || null,
      observacao_veiculo_fim:
        dadosEncerramento.observacaoVeiculoFim?.trim() || null,
    };

    await registrarEvento(EVENTO_TIPOS.FIM_JORNADA, jornadaAtual.id);

    const temInternet = await verificarInternet();

    if (!temInternet) {
      await salvarOperacaoJornadaPendente(
        JORNADA_OPERACOES_PENDENTES.UPDATE,
        jornadaEncerrada
      );
      await salvarJornadaLocal(null);
      setJornadaAtual(null);
      setEventos([]);
      setRegistrando(false);
      await cancelarNotificacoesJornada();

      Alert.alert(
        'Jornada encerrada offline',
        'Ela será atualizada no Supabase quando a internet voltar.'
      );
      return;
    }

    const { error } = await supabase
      .from('jornadas')
      .update(montarUpdateJornada(jornadaEncerrada))
      .eq('id', jornadaEncerrada.id);

    if (error) {
      await salvarOperacaoJornadaPendente(
        JORNADA_OPERACOES_PENDENTES.UPDATE,
        jornadaEncerrada
      );
      await salvarJornadaLocal(null);
      setJornadaAtual(null);
      setEventos([]);
      setRegistrando(false);
      await cancelarNotificacoesJornada();

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
    await cancelarNotificacoesJornada();

    Alert.alert('Jornada encerrada', 'Horário final registrado com sucesso.');
  }

  function TelaCarregamento({ texto }) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <Image source={logo} style={styles.loadingLogo} resizeMode="contain" />
        <ActivityIndicator size="large" color={COLORS.primaryLight} />
        <Text style={styles.carregandoTexto}>{texto}</Text>
      </SafeAreaView>
    );
  }

  if (carregando) {
    return <TelaCarregamento texto="Carregando..." />;
  }

  if (!session) {
    return (
      <LoginScreen
        email={email}
        setEmail={setEmail}
        senha={senha}
        setSenha={setSenha}
        nome={nome}
        setNome={setNome}
        login={login}
        cadastrar={cadastrar}
        carregando={carregando}
      />
    );
  }

  if (session && carregandoPerfil) {
    return <TelaCarregamento texto="Carregando perfil..." />;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator>
        {perfil?.tipo === 'admin' ? (
          <Stack.Screen name="Admin" options={{ title: 'Admin' }}>
            {(props) => (
              <AdminScreen
                {...props}
                session={session}
                perfil={perfil}
                sair={sair}
              />
            )}
          </Stack.Screen>
        ) : (
          <Stack.Screen name="Motorista" options={{ title: 'Motorista' }}>
            {(props) => (
              <MotoristaScreen
                {...props}
                session={session}
                perfil={perfil}
                online={online}
                jornadasPendentes={jornadasPendentes}
                eventosPendentes={eventosPendentes}
                jornadaAtual={jornadaAtual}
                eventos={eventos}
                registrando={registrando}
                iniciarJornada={iniciarJornada}
                iniciarViagem={iniciarViagem}
                finalizarViagem={finalizarViagem}
                registrarOcorrencia={registrarOcorrencia}
                pausar={pausar}
                retomar={retomar}
                encerrarJornada={encerrarJornada}
                sincronizarTudo={sincronizarTudo}
                sair={sair}
              />
            )}
          </Stack.Screen>
        )}

        <Stack.Screen name="MotoristaAdmin" options={{ title: 'Motorista' }}>
          {(props) => (
            <MotoristaScreen
              {...props}
              session={session}
              perfil={perfil}
              online={online}
              jornadasPendentes={jornadasPendentes}
              eventosPendentes={eventosPendentes}
              jornadaAtual={jornadaAtual}
              eventos={eventos}
              registrando={registrando}
              iniciarJornada={iniciarJornada}
              iniciarViagem={iniciarViagem}
              finalizarViagem={finalizarViagem}
              registrarOcorrencia={registrarOcorrencia}
              pausar={pausar}
              retomar={retomar}
              encerrarJornada={encerrarJornada}
              sincronizarTudo={sincronizarTudo}
              sair={sair}
            />
          )}
        </Stack.Screen>

        <Stack.Screen name="Historico" options={{ title: 'Histórico' }}>
          {(props) => <HistoricoScreen {...props} session={session} />}
        </Stack.Screen>

        <Stack.Screen
          name="DetalhesJornada"
          options={{ title: 'Detalhes da Jornada' }}
        >
          {(props) => <DetalhesJornadaScreen {...props} />}
        </Stack.Screen>

        <Stack.Screen name="Configuracoes" options={{ title: 'Configurações' }}>
          {(props) => (
            <ConfiguracoesScreen
              {...props}
              session={session}
              perfil={perfil}
              online={online}
              jornadasPendentes={jornadasPendentes}
              eventosPendentes={eventosPendentes}
              jornadaAtual={jornadaAtual}
              sincronizarTudo={sincronizarTudo}
              sair={sair}
            />
          )}
        </Stack.Screen>
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    padding: 24,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingLogo: {
    width: '100%',
    height: 170,
    marginBottom: 24,
  },
  carregandoTexto: {
    marginTop: 12,
    textAlign: 'center',
    color: COLORS.primary,
    fontWeight: 'bold',
    fontSize: 16,
  },
});
