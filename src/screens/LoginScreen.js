import React, { useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

const logo = require('../../assets/logo.png');

export default function LoginScreen({
  email,
  setEmail,
  senha,
  setSenha,
  nome,
  setNome,
  login,
  cadastrar,
  carregando,
}) {
  const [modo, setModo] = useState('login');

  const estaNoModoLogin = modo === 'login';

  function alternarParaLogin() {
    setModo('login');
  }

  function alternarParaCadastro() {
    setModo('cadastro');
  }

  function acaoPrincipal() {
    if (estaNoModoLogin) {
      login();
      return;
    }

    cadastrar();
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.logoArea}>
            <Image source={logo} style={styles.logo} resizeMode="contain" />
          </View>

          <View style={styles.header}>
            <Text style={styles.titulo}>Controle do Motorista</Text>

            <Text style={styles.subtitulo}>
              Registre jornadas, pausas, viagens e acompanhe tudo pelo painel.
            </Text>
          </View>

          <View style={styles.card}>
            <View style={styles.tabs}>
              <TouchableOpacity
                style={[
                  styles.tabBotao,
                  estaNoModoLogin && styles.tabBotaoAtivo,
                ]}
                onPress={alternarParaLogin}
                disabled={carregando}
              >
                <Text
                  style={[
                    styles.tabTexto,
                    estaNoModoLogin && styles.tabTextoAtivo,
                  ]}
                >
                  Entrar
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.tabBotao,
                  !estaNoModoLogin && styles.tabBotaoAtivo,
                ]}
                onPress={alternarParaCadastro}
                disabled={carregando}
              >
                <Text
                  style={[
                    styles.tabTexto,
                    !estaNoModoLogin && styles.tabTextoAtivo,
                  ]}
                >
                  Cadastrar
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.cardTitulo}>
              {estaNoModoLogin ? 'Acesse sua conta' : 'Cadastrar motorista'}
            </Text>

            <Text style={styles.cardDescricao}>
              {estaNoModoLogin
                ? 'Entre com o e-mail e senha cadastrados.'
                : 'Crie o acesso do motorista. O cadastro entra como motorista por padrão.'}
            </Text>

            {!estaNoModoLogin && (
              <View style={styles.campoGrupo}>
                <Text style={styles.label}>Nome</Text>

                <TextInput
                  style={styles.input}
                  placeholder="Nome do motorista"
                  value={nome}
                  onChangeText={setNome}
                  autoCapitalize="words"
                  editable={!carregando}
                />
              </View>
            )}

            <View style={styles.campoGrupo}>
              <Text style={styles.label}>E-mail</Text>

              <TextInput
                style={styles.input}
                placeholder="email@exemplo.com"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                editable={!carregando}
              />
            </View>

            <View style={styles.campoGrupo}>
              <Text style={styles.label}>Senha</Text>

              <TextInput
                style={styles.input}
                placeholder="Digite sua senha"
                value={senha}
                onChangeText={setSenha}
                secureTextEntry
                editable={!carregando}
              />
            </View>

            <TouchableOpacity
              style={[
                styles.botaoPrincipal,
                carregando && styles.botaoDesabilitado,
              ]}
              onPress={acaoPrincipal}
              disabled={carregando}
            >
              <Text style={styles.botaoPrincipalTexto}>
                {carregando
                  ? estaNoModoLogin
                    ? 'Entrando...'
                    : 'Cadastrando...'
                  : estaNoModoLogin
                    ? 'Entrar'
                    : 'Cadastrar motorista'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.linkAlternar}
              onPress={estaNoModoLogin ? alternarParaCadastro : alternarParaLogin}
              disabled={carregando}
            >
              <Text style={styles.linkAlternarTexto}>
                {estaNoModoLogin
                  ? 'Ainda não tem conta? Cadastrar motorista'
                  : 'Já tem conta? Entrar'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.rodape}>
            <Text style={styles.rodapeTexto}>
              Dica: o administrador deve ser configurado na tabela profiles do
              Supabase com tipo = admin.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f4f8ff',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
    justifyContent: 'center',
  },
  logoArea: {
    alignItems: 'center',
    marginBottom: 10,
  },
  logo: {
    width: '100%',
    height: 150,
  },
  header: {
    marginBottom: 20,
  },
  titulo: {
    fontSize: 30,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#0b2f66',
  },
  subtitulo: {
    marginTop: 8,
    fontSize: 15,
    color: '#5f6f86',
    textAlign: 'center',
    lineHeight: 21,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#d9e6f7',
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#eaf2ff',
    borderRadius: 14,
    padding: 4,
    marginBottom: 18,
  },
  tabBotao: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 11,
    alignItems: 'center',
  },
  tabBotaoAtivo: {
    backgroundColor: '#0066cc',
  },
  tabTexto: {
    color: '#0b2f66',
    fontWeight: 'bold',
  },
  tabTextoAtivo: {
    color: '#fff',
  },
  cardTitulo: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#0b2f66',
    marginBottom: 6,
  },
  cardDescricao: {
    color: '#5f6f86',
    marginBottom: 16,
    lineHeight: 20,
  },
  campoGrupo: {
    marginBottom: 12,
  },
  label: {
    fontWeight: 'bold',
    color: '#0b2f66',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#fafcff',
    borderWidth: 1,
    borderColor: '#d9e6f7',
    padding: 13,
    borderRadius: 10,
    fontSize: 16,
  },
  botaoPrincipal: {
    backgroundColor: '#0066cc',
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  botaoDesabilitado: {
    backgroundColor: '#8aa9cc',
  },
  botaoPrincipalTexto: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  linkAlternar: {
    marginTop: 16,
    alignItems: 'center',
  },
  linkAlternarTexto: {
    color: '#0066cc',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  rodape: {
    marginTop: 18,
    paddingHorizontal: 8,
  },
  rodapeTexto: {
    textAlign: 'center',
    color: '#6c7b91',
    fontSize: 13,
    lineHeight: 18,
  },
});