import React, { useState } from 'react';
import {
  Button,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import StatusConexao from '../components/StatusConexao';

export default function MotoristaScreen({
  session,
  online,
  jornadasPendentes,
  eventosPendentes,
  jornadaAtual,
  eventos,
  registrando,
  iniciarJornada,
  iniciarViagem,
  finalizarViagem,
  registrarOcorrencia,
  pausar,
  retomar,
  encerrarJornada,
  sincronizarTudo,
  sair,
  navigation,
}) {
  const [modalInicioJornadaVisivel, setModalInicioJornadaVisivel] =
    useState(false);
  const [veiculo, setVeiculo] = useState('');
  const [placa, setPlaca] = useState('');
  const [kmInicial, setKmInicial] = useState('');
  const [combustivelInicial, setCombustivelInicial] = useState('');
  const [observacaoVeiculoInicio, setObservacaoVeiculoInicio] = useState('');

  const [modalViagemVisivel, setModalViagemVisivel] = useState(false);
  const [clienteViagem, setClienteViagem] = useState('');
  const [destinoViagem, setDestinoViagem] = useState('');
  const [observacaoViagem, setObservacaoViagem] = useState('');

  const [modalFinalizarViagemVisivel, setModalFinalizarViagemVisivel] =
    useState(false);
  const [observacaoFimViagem, setObservacaoFimViagem] = useState('');

  const [modalOcorrenciaVisivel, setModalOcorrenciaVisivel] = useState(false);
  const [tipoOcorrencia, setTipoOcorrencia] = useState('Cliente ausente');
  const [descricaoOcorrencia, setDescricaoOcorrencia] = useState('');

  const [modalEncerrarJornadaVisivel, setModalEncerrarJornadaVisivel] =
    useState(false);
  const [kmFinal, setKmFinal] = useState('');
  const [combustivelFinal, setCombustivelFinal] = useState('');
  const [observacaoVeiculoFim, setObservacaoVeiculoFim] = useState('');

  const statusOperacional = calcularStatusOperacional(eventos);

  const estaPausado = statusOperacional.estaPausado;
  const viagemAberta = statusOperacional.viagemAberta;

  const podeIniciarViagem =
    jornadaAtual && !registrando && !estaPausado && !viagemAberta;

  const podeFinalizarViagem = jornadaAtual && !registrando && viagemAberta;

  const podePausar = jornadaAtual && !registrando && !estaPausado;

  const podeRetomar = jornadaAtual && !registrando && estaPausado;

  const podeRegistrarOcorrencia = jornadaAtual && !registrando;

  const podeEncerrarJornada =
    jornadaAtual && !registrando && !estaPausado && !viagemAberta;

  function calcularStatusOperacional(listaEventos) {
    let pausado = false;
    let emViagem = false;

    const eventosOrdenados = [...(listaEventos || [])].sort((a, b) => {
      return new Date(a.horario) - new Date(b.horario);
    });

    for (const evento of eventosOrdenados) {
      if (evento.tipo === 'pausa') {
        pausado = true;
      }

      if (evento.tipo === 'retorno') {
        pausado = false;
      }

      if (evento.tipo === 'inicio_viagem') {
        emViagem = true;
      }

      if (evento.tipo === 'fim_viagem') {
        emViagem = false;
      }

      if (evento.tipo === 'fim_jornada') {
        pausado = false;
        emViagem = false;
      }
    }

    return {
      estaPausado: pausado,
      viagemAberta: emViagem,
    };
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
      observacao: 'Ocorrência/Observação',
    };

    return nomes[tipo] || tipo;
  }

  function obterTextoStatusJornada() {
    if (!jornadaAtual) {
      return 'Nenhuma jornada aberta';
    }

    if (registrando) {
      return 'Registrando informação...';
    }

    if (estaPausado) {
      return 'Motorista em pausa';
    }

    if (viagemAberta) {
      return 'Viagem em andamento';
    }

    return 'Jornada em andamento';
  }

  function obterMensagemBloqueioEncerramento() {
    if (estaPausado) {
      return 'Retome a jornada antes de encerrar.';
    }

    if (viagemAberta) {
      return 'Finalize a viagem antes de encerrar a jornada.';
    }

    return null;
  }

  function abrirModalInicioJornada() {
    if (registrando || jornadaAtual) return;

    setVeiculo(jornadaAtual?.veiculo || '');
    setPlaca(jornadaAtual?.placa || '');
    setKmInicial('');
    setCombustivelInicial('');
    setObservacaoVeiculoInicio('');
    setModalInicioJornadaVisivel(true);
  }

  function fecharModalInicioJornada() {
    if (registrando) return;
    setModalInicioJornadaVisivel(false);
  }

  async function confirmarIniciarJornada() {
    setModalInicioJornadaVisivel(false);

    await iniciarJornada({
      veiculo,
      placa,
      kmInicial,
      combustivelInicial,
      observacaoVeiculoInicio,
    });

    setVeiculo('');
    setPlaca('');
    setKmInicial('');
    setCombustivelInicial('');
    setObservacaoVeiculoInicio('');
  }

  function abrirModalViagem() {
    if (!podeIniciarViagem) return;

    setClienteViagem('');
    setDestinoViagem('');
    setObservacaoViagem('');
    setModalViagemVisivel(true);
  }

  function fecharModalViagem() {
    if (registrando) return;

    setModalViagemVisivel(false);
  }

  async function confirmarIniciarViagem() {
    const partesObservacao = [];

    if (clienteViagem.trim()) {
      partesObservacao.push(`Cliente: ${clienteViagem.trim()}`);
    }

    if (destinoViagem.trim()) {
      partesObservacao.push(`Destino: ${destinoViagem.trim()}`);
    }

    if (observacaoViagem.trim()) {
      partesObservacao.push(`Observação: ${observacaoViagem.trim()}`);
    }

    const observacaoFinal =
      partesObservacao.length > 0 ? partesObservacao.join(' | ') : null;

    setModalViagemVisivel(false);

    await iniciarViagem(observacaoFinal);

    setClienteViagem('');
    setDestinoViagem('');
    setObservacaoViagem('');
  }

  function abrirModalFinalizarViagem() {
    if (!podeFinalizarViagem) return;

    setObservacaoFimViagem('');
    setModalFinalizarViagemVisivel(true);
  }

  function fecharModalFinalizarViagem() {
    if (registrando) return;

    setModalFinalizarViagemVisivel(false);
  }

  async function confirmarFinalizarViagem() {
    const observacaoFinal = observacaoFimViagem.trim()
      ? `Finalização: ${observacaoFimViagem.trim()}`
      : null;

    setModalFinalizarViagemVisivel(false);

    await finalizarViagem(observacaoFinal);

    setObservacaoFimViagem('');
  }

  function abrirModalOcorrencia() {
    if (!podeRegistrarOcorrencia) return;

    setTipoOcorrencia('Cliente ausente');
    setDescricaoOcorrencia('');
    setModalOcorrenciaVisivel(true);
  }

  function fecharModalOcorrencia() {
    if (registrando) return;
    setModalOcorrenciaVisivel(false);
  }

  async function confirmarOcorrencia() {
    const partes = [`Ocorrência: ${tipoOcorrencia}`];

    if (descricaoOcorrencia.trim()) {
      partes.push(`Descrição: ${descricaoOcorrencia.trim()}`);
    }

    setModalOcorrenciaVisivel(false);

    await registrarOcorrencia(partes.join(' | '));

    setDescricaoOcorrencia('');
  }

  function abrirModalEncerrarJornada() {
    if (!podeEncerrarJornada) return;

    setKmFinal('');
    setCombustivelFinal('');
    setObservacaoVeiculoFim('');
    setModalEncerrarJornadaVisivel(true);
  }

  function fecharModalEncerrarJornada() {
    if (registrando) return;
    setModalEncerrarJornadaVisivel(false);
  }

  async function confirmarEncerrarJornada() {
    setModalEncerrarJornadaVisivel(false);

    await encerrarJornada({
      kmFinal,
      combustivelFinal,
      observacaoVeiculoFim,
    });

    setKmFinal('');
    setCombustivelFinal('');
    setObservacaoVeiculoFim('');
  }

  const mensagemBloqueioEncerramento = obterMensagemBloqueioEncerramento();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        <Text style={styles.titulo}>Controle de Jornada</Text>

        <StatusConexao
          online={online}
          jornadasPendentes={jornadasPendentes}
          eventosPendentes={eventosPendentes}
        />

        <Text style={styles.usuario}>Usuário: {session.user.email}</Text>

        {!jornadaAtual ? (
          <View style={styles.card}>
            <Text style={styles.subtitulo}>Nenhuma jornada aberta</Text>

            <Text style={styles.textoAjuda}>
              Inicie a jornada para começar os registros do dia.
            </Text>

            <Button
              title={registrando ? 'Iniciando...' : 'Iniciar jornada'}
              onPress={abrirModalInicioJornada}
              disabled={registrando}
            />
          </View>
        ) : (
          <>
            <View style={styles.cardStatus}>
              <Text style={styles.statusTitulo}>Status atual</Text>

              <Text
                style={[
                  styles.statusTexto,
                  estaPausado && styles.statusPausa,
                  viagemAberta && styles.statusViagem,
                ]}
              >
                {obterTextoStatusJornada()}
              </Text>

              <Text style={styles.statusDetalhe}>
                Início: {formatarData(jornadaAtual.inicio)}
              </Text>

              {(jornadaAtual.veiculo || jornadaAtual.placa || jornadaAtual.km_inicial) && (
                <View style={styles.veiculoBox}>
                  <Text style={styles.veiculoTitulo}>Veículo da jornada</Text>

                  {jornadaAtual.veiculo && (
                    <Text style={styles.veiculoTexto}>Veículo: {jornadaAtual.veiculo}</Text>
                  )}

                  {jornadaAtual.placa && (
                    <Text style={styles.veiculoTexto}>Placa: {jornadaAtual.placa}</Text>
                  )}

                  {jornadaAtual.km_inicial !== null && jornadaAtual.km_inicial !== undefined && (
                    <Text style={styles.veiculoTexto}>KM inicial: {jornadaAtual.km_inicial}</Text>
                  )}

                  {jornadaAtual.combustivel_inicial && (
                    <Text style={styles.veiculoTexto}>
                      Combustível inicial: {jornadaAtual.combustivel_inicial}
                    </Text>
                  )}
                </View>
              )}

              {estaPausado && (
                <Text style={styles.aviso}>
                  Enquanto estiver em pausa, não é possível iniciar viagem ou
                  encerrar jornada.
                </Text>
              )}

              {viagemAberta && (
                <Text style={styles.aviso}>
                  Existe uma viagem em andamento. Finalize a viagem antes de
                  iniciar outra ou encerrar a jornada.
                </Text>
              )}
            </View>

            <View style={styles.card}>
              <Text style={styles.subtitulo}>Ações da jornada</Text>

              <View style={styles.espaco}>
                <Button
                  title={registrando ? 'Registrando...' : 'Iniciar viagem'}
                  onPress={abrirModalViagem}
                  disabled={!podeIniciarViagem}
                />
              </View>

              {!podeIniciarViagem && jornadaAtual && !registrando && (
                <Text style={styles.textoBloqueio}>
                  {estaPausado
                    ? 'Não é possível iniciar viagem durante uma pausa.'
                    : viagemAberta
                      ? 'Finalize a viagem atual antes de iniciar outra.'
                      : ''}
                </Text>
              )}

              <View style={styles.espaco}>
                <Button
                  title={registrando ? 'Registrando...' : 'Finalizar viagem'}
                  onPress={abrirModalFinalizarViagem}
                  disabled={!podeFinalizarViagem}
                />
              </View>

              {!podeFinalizarViagem && jornadaAtual && !registrando && (
                <Text style={styles.textoBloqueio}>
                  {!viagemAberta
                    ? 'Nenhuma viagem em andamento para finalizar.'
                    : ''}
                </Text>
              )}

              <View style={styles.espaco}>
                <Button
                  title={registrando ? 'Registrando...' : 'Registrar ocorrência'}
                  onPress={abrirModalOcorrencia}
                  disabled={!podeRegistrarOcorrencia}
                />
              </View>

              <View style={styles.espaco}>
                <Button
                  title={registrando ? 'Registrando...' : 'Pausar'}
                  onPress={pausar}
                  disabled={!podePausar}
                />
              </View>

              {!podePausar && jornadaAtual && !registrando && (
                <Text style={styles.textoBloqueio}>
                  {estaPausado ? 'A jornada já está pausada.' : ''}
                </Text>
              )}

              <View style={styles.espaco}>
                <Button
                  title={registrando ? 'Registrando...' : 'Retomar'}
                  onPress={retomar}
                  disabled={!podeRetomar}
                />
              </View>

              {!podeRetomar && jornadaAtual && !registrando && (
                <Text style={styles.textoBloqueio}>
                  {!estaPausado ? 'A jornada não está pausada.' : ''}
                </Text>
              )}

              <View style={styles.espaco}>
                <Button
                  title={registrando ? 'Encerrando...' : 'Encerrar jornada'}
                  color="#b00020"
                  onPress={abrirModalEncerrarJornada}
                  disabled={!podeEncerrarJornada}
                />
              </View>

              {mensagemBloqueioEncerramento && !registrando && (
                <Text style={styles.textoBloqueio}>
                  {mensagemBloqueioEncerramento}
                </Text>
              )}
            </View>
          </>
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

              {evento.observacao && (
                <Text style={styles.observacao}>{evento.observacao}</Text>
              )}

              {evento.latitude && evento.longitude && (
                <Text style={styles.localizacao}>
                  Local: {evento.latitude}, {evento.longitude}
                </Text>
              )}
            </View>
          ))}
        </View>

        <View style={styles.espaco}>
          <Button
            title="Ver histórico"
            onPress={() => navigation.navigate('Historico')}
          />
        </View>

        <View style={styles.espaco}>
          <Button
            title="Configurações"
            onPress={() => navigation.navigate('Configuracoes')}
          />
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

      <Modal
        visible={modalInicioJornadaVisivel}
        transparent
        animationType="slide"
        onRequestClose={fecharModalInicioJornada}
      >
        <View style={styles.modalFundo}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitulo}>Iniciar jornada</Text>

            <Text style={styles.modalDescricao}>
              Informe os dados do veículo. Todos os campos são opcionais.
            </Text>

            <Text style={styles.label}>Veículo</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: Fiorino, Strada, Moto"
              value={veiculo}
              onChangeText={setVeiculo}
              editable={!registrando}
            />

            <Text style={styles.label}>Placa</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: ABC1D23"
              value={placa}
              onChangeText={setPlaca}
              autoCapitalize="characters"
              editable={!registrando}
            />

            <Text style={styles.label}>KM inicial</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: 152000"
              value={kmInicial}
              onChangeText={setKmInicial}
              keyboardType="numeric"
              editable={!registrando}
            />

            <Text style={styles.label}>Combustível inicial</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: cheio, meio tanque, 1/4"
              value={combustivelInicial}
              onChangeText={setCombustivelInicial}
              editable={!registrando}
            />

            <Text style={styles.label}>Observação do veículo</Text>
            <TextInput
              style={[styles.input, styles.inputGrande]}
              placeholder="Ex: pneu calibrado, veículo com avaria, sem observações..."
              value={observacaoVeiculoInicio}
              onChangeText={setObservacaoVeiculoInicio}
              editable={!registrando}
              multiline
              textAlignVertical="top"
            />

            <View style={styles.modalBotoes}>
              <TouchableOpacity
                style={styles.botaoCancelar}
                onPress={fecharModalInicioJornada}
                disabled={registrando}
              >
                <Text style={styles.botaoCancelarTexto}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.botaoConfirmar}
                onPress={confirmarIniciarJornada}
                disabled={registrando}
              >
                <Text style={styles.botaoConfirmarTexto}>
                  {registrando ? 'Salvando...' : 'Iniciar'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={modalViagemVisivel}
        transparent
        animationType="slide"
        onRequestClose={fecharModalViagem}
      >
        <View style={styles.modalFundo}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitulo}>Iniciar viagem</Text>

            <Text style={styles.modalDescricao}>
              Preencha os dados da viagem. Todos os campos são opcionais.
            </Text>

            <Text style={styles.label}>Cliente</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: Cliente, loja ou fornecedor"
              value={clienteViagem}
              onChangeText={setClienteViagem}
              editable={!registrando}
            />

            <Text style={styles.label}>Destino</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: Caruaru, Recife, Centro"
              value={destinoViagem}
              onChangeText={setDestinoViagem}
              editable={!registrando}
            />

            <Text style={styles.label}>Observação</Text>
            <TextInput
              style={[styles.input, styles.inputGrande]}
              placeholder="Ex: entrega, coleta, visita, retorno..."
              value={observacaoViagem}
              onChangeText={setObservacaoViagem}
              editable={!registrando}
              multiline
              textAlignVertical="top"
            />

            <View style={styles.modalBotoes}>
              <TouchableOpacity
                style={styles.botaoCancelar}
                onPress={fecharModalViagem}
                disabled={registrando}
              >
                <Text style={styles.botaoCancelarTexto}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.botaoConfirmar}
                onPress={confirmarIniciarViagem}
                disabled={registrando}
              >
                <Text style={styles.botaoConfirmarTexto}>
                  {registrando ? 'Salvando...' : 'Iniciar'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={modalFinalizarViagemVisivel}
        transparent
        animationType="slide"
        onRequestClose={fecharModalFinalizarViagem}
      >
        <View style={styles.modalFundo}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitulo}>Finalizar viagem</Text>

            <Text style={styles.modalDescricao}>
              Informe uma observação final da viagem, se necessário.
            </Text>

            <Text style={styles.label}>Observação final</Text>
            <TextInput
              style={[styles.input, styles.inputGrande]}
              placeholder="Ex: entrega concluída, cliente ausente, coleta feita..."
              value={observacaoFimViagem}
              onChangeText={setObservacaoFimViagem}
              editable={!registrando}
              multiline
              textAlignVertical="top"
            />

            <View style={styles.modalBotoes}>
              <TouchableOpacity
                style={styles.botaoCancelar}
                onPress={fecharModalFinalizarViagem}
                disabled={registrando}
              >
                <Text style={styles.botaoCancelarTexto}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.botaoConfirmar}
                onPress={confirmarFinalizarViagem}
                disabled={registrando}
              >
                <Text style={styles.botaoConfirmarTexto}>
                  {registrando ? 'Salvando...' : 'Finalizar'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={modalOcorrenciaVisivel}
        transparent
        animationType="slide"
        onRequestClose={fecharModalOcorrencia}
      >
        <View style={styles.modalFundo}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitulo}>Registrar ocorrência</Text>

            <Text style={styles.modalDescricao}>
              Escolha o tipo e descreva o que aconteceu.
            </Text>

            <Text style={styles.label}>Tipo de ocorrência</Text>

            <View style={styles.opcoesOcorrencia}>
              {[
                'Cliente ausente',
                'Entrega recusada',
                'Problema no veículo',
                'Trânsito intenso',
                'Atraso no carregamento',
                'Manutenção',
                'Outro',
              ].map((opcao) => (
                <TouchableOpacity
                  key={opcao}
                  style={[
                    styles.ocorrenciaOpcao,
                    tipoOcorrencia === opcao && styles.ocorrenciaOpcaoAtiva,
                  ]}
                  onPress={() => setTipoOcorrencia(opcao)}
                  disabled={registrando}
                >
                  <Text
                    style={[
                      styles.ocorrenciaOpcaoTexto,
                      tipoOcorrencia === opcao && styles.ocorrenciaOpcaoTextoAtivo,
                    ]}
                  >
                    {opcao}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Descrição</Text>
            <TextInput
              style={[styles.input, styles.inputGrande]}
              placeholder="Descreva a ocorrência..."
              value={descricaoOcorrencia}
              onChangeText={setDescricaoOcorrencia}
              editable={!registrando}
              multiline
              textAlignVertical="top"
            />

            <View style={styles.modalBotoes}>
              <TouchableOpacity
                style={styles.botaoCancelar}
                onPress={fecharModalOcorrencia}
                disabled={registrando}
              >
                <Text style={styles.botaoCancelarTexto}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.botaoConfirmar}
                onPress={confirmarOcorrencia}
                disabled={registrando}
              >
                <Text style={styles.botaoConfirmarTexto}>
                  {registrando ? 'Salvando...' : 'Registrar'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={modalEncerrarJornadaVisivel}
        transparent
        animationType="slide"
        onRequestClose={fecharModalEncerrarJornada}
      >
        <View style={styles.modalFundo}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitulo}>Encerrar jornada</Text>

            <Text style={styles.modalDescricao}>
              Informe os dados finais do veículo. Todos os campos são opcionais.
            </Text>

            <Text style={styles.label}>KM final</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: 152180"
              value={kmFinal}
              onChangeText={setKmFinal}
              keyboardType="numeric"
              editable={!registrando}
            />

            <Text style={styles.label}>Combustível final</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: meio tanque, 1/4"
              value={combustivelFinal}
              onChangeText={setCombustivelFinal}
              editable={!registrando}
            />

            <Text style={styles.label}>Observação final do veículo</Text>
            <TextInput
              style={[styles.input, styles.inputGrande]}
              placeholder="Ex: veículo entregue sem alterações..."
              value={observacaoVeiculoFim}
              onChangeText={setObservacaoVeiculoFim}
              editable={!registrando}
              multiline
              textAlignVertical="top"
            />

            <View style={styles.modalBotoes}>
              <TouchableOpacity
                style={styles.botaoCancelar}
                onPress={fecharModalEncerrarJornada}
                disabled={registrando}
              >
                <Text style={styles.botaoCancelarTexto}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.botaoConfirmarPerigo}
                onPress={confirmarEncerrarJornada}
                disabled={registrando}
              >
                <Text style={styles.botaoConfirmarTexto}>
                  {registrando ? 'Encerrando...' : 'Encerrar'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  subtitulo: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#0b2f66',
  },
  usuario: {
    marginBottom: 12,
    textAlign: 'center',
    color: '#5f6f86',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#d9e6f7',
  },
  cardStatus: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#d9e6f7',
  },
  statusTitulo: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0b2f66',
  },
  statusTexto: {
    marginTop: 6,
    fontSize: 22,
    fontWeight: 'bold',
    color: '#008000',
  },
  statusPausa: {
    color: '#b26a00',
  },
  statusViagem: {
    color: '#0066cc',
  },
  statusDetalhe: {
    marginTop: 6,
    color: '#5f6f86',
  },
  textoAjuda: {
    color: '#5f6f86',
    marginBottom: 14,
    lineHeight: 20,
  },
  veiculoBox: {
    marginTop: 12,
    backgroundColor: '#f4f8ff',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#d9e6f7',
  },
  veiculoTitulo: {
    color: '#0b2f66',
    fontWeight: 'bold',
    marginBottom: 4,
  },
  veiculoTexto: {
    color: '#333',
    marginTop: 3,
  },
  aviso: {
    marginTop: 10,
    color: '#b26a00',
    fontWeight: 'bold',
    lineHeight: 20,
  },
  textoBloqueio: {
    marginTop: 6,
    color: '#b26a00',
    fontSize: 13,
    lineHeight: 18,
  },
  evento: {
    borderTopWidth: 1,
    borderTopColor: '#eef3fb',
    paddingTop: 10,
    marginTop: 10,
  },
  eventoTipo: {
    fontWeight: 'bold',
    color: '#0b2f66',
  },
  observacao: {
    marginTop: 4,
    color: '#333',
    fontStyle: 'italic',
    lineHeight: 19,
  },
  localizacao: {
    marginTop: 4,
    color: '#6c7b91',
    fontSize: 12,
  },
  espaco: {
    marginTop: 10,
    marginBottom: 4,
  },
  modalFundo: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    maxHeight: '92%',
  },
  modalTitulo: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#0b2f66',
    marginBottom: 6,
  },
  modalDescricao: {
    color: '#5f6f86',
    marginBottom: 14,
    lineHeight: 20,
  },
  label: {
    fontWeight: 'bold',
    color: '#0b2f66',
    marginBottom: 6,
    marginTop: 8,
  },
  input: {
    backgroundColor: '#fafcff',
    borderWidth: 1,
    borderColor: '#d9e6f7',
    padding: 12,
    borderRadius: 10,
    fontSize: 16,
  },
  inputGrande: {
    minHeight: 80,
  },
  modalBotoes: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  botaoCancelar: {
    flex: 1,
    padding: 13,
    borderRadius: 10,
    backgroundColor: '#eaf2ff',
    alignItems: 'center',
  },
  botaoCancelarTexto: {
    color: '#0b2f66',
    fontWeight: 'bold',
  },
  botaoConfirmar: {
    flex: 1,
    padding: 13,
    borderRadius: 10,
    backgroundColor: '#0066cc',
    alignItems: 'center',
  },
  botaoConfirmarPerigo: {
    flex: 1,
    padding: 13,
    borderRadius: 10,
    backgroundColor: '#b00020',
    alignItems: 'center',
  },
  botaoConfirmarTexto: {
    color: '#fff',
    fontWeight: 'bold',
  },
  opcoesOcorrencia: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  ocorrenciaOpcao: {
    backgroundColor: '#eaf2ff',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#d9e6f7',
  },
  ocorrenciaOpcaoAtiva: {
    backgroundColor: '#0066cc',
    borderColor: '#0066cc',
  },
  ocorrenciaOpcaoTexto: {
    color: '#0b2f66',
    fontWeight: 'bold',
    fontSize: 12,
  },
  ocorrenciaOpcaoTextoAtivo: {
    color: '#fff',
  },
});
