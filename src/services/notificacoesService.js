import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

const CANAL_JORNADA_ID = 'jornada';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function configurarNotificacoes() {
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(CANAL_JORNADA_ID, {
        name: 'Jornada',
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#0b2f66',
      });
    }

    const permissaoAtual = await Notifications.getPermissionsAsync();
    let status = permissaoAtual.status;

    if (status !== 'granted') {
      const permissaoSolicitada = await Notifications.requestPermissionsAsync();
      status = permissaoSolicitada.status;
    }

    return status === 'granted';
  } catch (error) {
    console.log('Erro ao configurar notificações:', error);
    return false;
  }
}

export async function agendarLembreteJornada({
  titulo = 'Jornada em andamento',
  corpo = 'Não esqueça de encerrar a jornada quando finalizar o expediente.',
  segundos = 60 * 60 * 8,
} = {}) {
  try {
    const permitido = await configurarNotificacoes();

    if (!permitido) {
      return null;
    }

    return await Notifications.scheduleNotificationAsync({
      content: {
        title: titulo,
        body: corpo,
        sound: true,
      },
      trigger: {
        seconds: segundos,
        channelId: CANAL_JORNADA_ID,
      },
    });
  } catch (error) {
    console.log('Erro ao agendar notificação da jornada:', error);
    return null;
  }
}

export async function cancelarNotificacoesJornada() {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch (error) {
    console.log('Erro ao cancelar notificações da jornada:', error);
  }
}
