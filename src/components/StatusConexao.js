import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function StatusConexao({
  online,
  jornadasPendentes,
  eventosPendentes,
}) {
  return (
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
  );
}

const styles = StyleSheet.create({
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
});