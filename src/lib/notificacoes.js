// import * as Notifications from 'expo-notifications';
// import { Platform } from 'react-native';

// Notifications.setNotificationHandler({
//   handleNotification: async () => ({
//     shouldShowAlert: true,
//     shouldPlaySound: true,
//     shouldSetBadge: false,
//   }),
// });

// export async function configurarNotificacoesLocais() {
//   try {
//     const permissaoAtual = await Notifications.getPermissionsAsync();
//     let statusFinal = permissaoAtual.status;

//     if (statusFinal !== 'granted') {
//       const permissaoSolicitada = await Notifications.requestPermissionsAsync();
//       statusFinal = permissaoSolicitada.status;
//     }

//     if (Platform.OS === 'android') {
//       await Notifications.setNotificationChannelAsync('jornada', {
//         name: 'Jornada',
//         importance: Notifications.AndroidImportance.HIGH,
//         vibrationPattern: [0, 250, 250, 250],
//         lightColor: '#0066cc',
//       });
//     }

//     return statusFinal === 'granted';
//   } catch (error) {
//     console.log('Erro ao configurar notificações:', error);
//     return false;
//   }
// }

// export async function cancelarNotificacoesJornada() {
//   try {
//     await Notifications.cancelAllScheduledNotificationsAsync();
//   } catch (error) {
//     console.log('Erro ao cancelar notificações:', error);
//   }
// }

// export async function agendarNotificacoesJornada(jornadaAtual, eventos = []) {
//   try {
//     await cancelarNotificacoesJornada();

//     if (!jornadaAtual || jornadaAtual.status !== 'aberta') {
//       return;
//     }

//     const status = calcularStatusOperacional(eventos);
//     const agora = new Date();
//     const inicioJornada = jornadaAtual.inicio ? new Date(jornadaAtual.inicio) : null;

//     if (inicioJornada) {
//       const avisoJornada = adicionarHoras(inicioJornada, 10);
//       const segundosJornada = calcularSegundosFuturos(agora, avisoJornada);

//       if (segundosJornada > 0) {
//         await Notifications.scheduleNotificationAsync({
//           content: {
//             title: 'Jornada aberta há muito tempo',
//             body: 'Sua jornada está aberta há quase 10 horas. Verifique se precisa encerrar.',
//           },
//           trigger: {
//             seconds: segundosJornada,
//             channelId: 'jornada',
//           },
//         });
//       }
//     }

//     if (status.estaPausado && status.horarioPausa) {
//       const avisoPausa = adicionarHoras(new Date(status.horarioPausa), 1);
//       const segundosPausa = calcularSegundosFuturos(agora, avisoPausa);

//       if (segundosPausa > 0) {
//         await Notifications.scheduleNotificationAsync({
//           content: {
//             title: 'Pausa em andamento',
//             body: 'Você está em pausa há quase 1 hora. Lembre-se de retomar a jornada.',
//           },
//           trigger: {
//             seconds: segundosPausa,
//             channelId: 'jornada',
//           },
//         });
//       }
//     }

//     if (status.viagemAberta && status.horarioViagem) {
//       const avisoViagem = adicionarHoras(new Date(status.horarioViagem), 2);
//       const segundosViagem = calcularSegundosFuturos(agora, avisoViagem);

//       if (segundosViagem > 0) {
//         await Notifications.scheduleNotificationAsync({
//           content: {
//             title: 'Viagem em andamento',
//             body: 'Existe uma viagem aberta há quase 2 horas. Verifique se ela já pode ser finalizada.',
//           },
//           trigger: {
//             seconds: segundosViagem,
//             channelId: 'jornada',
//           },
//         });
//       }
//     }
//   } catch (error) {
//     console.log('Erro ao agendar notificações:', error);
//   }
// }

// function adicionarHoras(data, horas) {
//   const novaData = new Date(data);
//   novaData.setHours(novaData.getHours() + horas);
//   return novaData;
// }

// function calcularSegundosFuturos(agora, alvo) {
//   return Math.floor((alvo - agora) / 1000);
// }

// function calcularStatusOperacional(listaEventos) {
//   let pausado = false;
//   let emViagem = false;
//   let horarioPausa = null;
//   let horarioViagem = null;

//   const eventosOrdenados = [...(listaEventos || [])].sort((a, b) => {
//     return new Date(a.horario) - new Date(b.horario);
//   });

//   for (const evento of eventosOrdenados) {
//     if (evento.tipo === 'pausa') {
//       pausado = true;
//       horarioPausa = evento.horario;
//     }

//     if (evento.tipo === 'retorno') {
//       pausado = false;
//       horarioPausa = null;
//     }

//     if (evento.tipo === 'inicio_viagem') {
//       emViagem = true;
//       horarioViagem = evento.horario;
//     }

//     if (evento.tipo === 'fim_viagem') {
//       emViagem = false;
//       horarioViagem = null;
//     }

//     if (evento.tipo === 'fim_jornada') {
//       pausado = false;
//       emViagem = false;
//       horarioPausa = null;
//       horarioViagem = null;
//     }
//   }

//   return {
//     estaPausado: pausado,
//     viagemAberta: emViagem,
//     horarioPausa,
//     horarioViagem,
//   };
// }
