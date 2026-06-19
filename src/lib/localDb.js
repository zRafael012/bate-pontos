import * as SQLite from 'expo-sqlite';

let db = null;

export async function getDb() {
  if (!db) {
    db = await SQLite.openDatabaseAsync('controle_motorista.db');
  }

  return db;
}

export async function inicializarBancoLocal() {
  const database = await getDb();

  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS local_jornada (
      chave TEXT PRIMARY KEY NOT NULL,
      valor TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS eventos_pendentes (
      id TEXT PRIMARY KEY NOT NULL,
      valor TEXT NOT NULL,
      criado_em TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS jornadas_pendentes (
      id TEXT PRIMARY KEY NOT NULL,
      operacao TEXT NOT NULL,
      valor TEXT NOT NULL,
      atualizado_em TEXT NOT NULL
    );
  `);
}

export async function salvarJornadaLocalSQLite(jornada) {
  const database = await getDb();

  if (!jornada) {
    await database.runAsync(
      'DELETE FROM local_jornada WHERE chave = ?',
      ['jornada_atual']
    );

    return;
  }

  await database.runAsync(
    `
      INSERT OR REPLACE INTO local_jornada (chave, valor)
      VALUES (?, ?)
    `,
    ['jornada_atual', JSON.stringify(jornada)]
  );
}

export async function carregarJornadaLocalSQLite() {
  const database = await getDb();

  const linha = await database.getFirstAsync(
    'SELECT valor FROM local_jornada WHERE chave = ?',
    ['jornada_atual']
  );

  if (!linha?.valor) {
    return null;
  }

  try {
    return JSON.parse(linha.valor);
  } catch (error) {
    return null;
  }
}

export async function salvarEventoPendenteSQLite(evento) {
  const database = await getDb();

  await database.runAsync(
    `
      INSERT OR REPLACE INTO eventos_pendentes (id, valor, criado_em)
      VALUES (?, ?, ?)
    `,
    [evento.id, JSON.stringify(evento), new Date().toISOString()]
  );
}

export async function listarEventosPendentesSQLite() {
  const database = await getDb();

  const linhas = await database.getAllAsync(
    'SELECT valor FROM eventos_pendentes ORDER BY criado_em ASC'
  );

  return linhas
    .map((linha) => {
      try {
        return JSON.parse(linha.valor);
      } catch (error) {
        return null;
      }
    })
    .filter(Boolean);
}

export async function contarEventosPendentesSQLite() {
  const database = await getDb();

  const linha = await database.getFirstAsync(
    'SELECT COUNT(*) as total FROM eventos_pendentes'
  );

  return linha?.total || 0;
}

export async function limparEventosPendentesSQLite() {
  const database = await getDb();

  await database.runAsync('DELETE FROM eventos_pendentes');
}

export async function salvarOperacaoJornadaPendenteSQLite(operacao, jornada) {
  const database = await getDb();

  const existente = await database.getFirstAsync(
    'SELECT operacao, valor FROM jornadas_pendentes WHERE id = ?',
    [jornada.id]
  );

  let operacaoFinal = operacao;
  let jornadaFinal = jornada;

  if (existente?.operacao === 'insert' && operacao === 'update') {
    operacaoFinal = 'insert';
    jornadaFinal = jornada;
  }

  await database.runAsync(
    `
      INSERT OR REPLACE INTO jornadas_pendentes
      (id, operacao, valor, atualizado_em)
      VALUES (?, ?, ?, ?)
    `,
    [
      jornada.id,
      operacaoFinal,
      JSON.stringify(jornadaFinal),
      new Date().toISOString(),
    ]
  );
}

export async function listarJornadasPendentesSQLite() {
  const database = await getDb();

  const linhas = await database.getAllAsync(
    'SELECT id, operacao, valor FROM jornadas_pendentes ORDER BY atualizado_em ASC'
  );

  return linhas
    .map((linha) => {
      try {
        return {
          operacao: linha.operacao,
          jornada: JSON.parse(linha.valor),
        };
      } catch (error) {
        return null;
      }
    })
    .filter(Boolean);
}

export async function contarJornadasPendentesSQLite() {
  const database = await getDb();

  const linha = await database.getFirstAsync(
    'SELECT COUNT(*) as total FROM jornadas_pendentes'
  );

  return linha?.total || 0;
}

export async function limparJornadasPendentesSQLite() {
  const database = await getDb();

  await database.runAsync('DELETE FROM jornadas_pendentes');
}

export async function substituirJornadasPendentesSQLite(lista) {
  const database = await getDb();

  await database.runAsync('DELETE FROM jornadas_pendentes');

  for (const item of lista) {
    await database.runAsync(
      `
        INSERT OR REPLACE INTO jornadas_pendentes
        (id, operacao, valor, atualizado_em)
        VALUES (?, ?, ?, ?)
      `,
      [
        item.jornada.id,
        item.operacao,
        JSON.stringify(item.jornada),
        new Date().toISOString(),
      ]
    );
  }
}