CREATE TABLE IF NOT EXISTS configuracoes (
  chave TEXT PRIMARY KEY,
  valor TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS modulos (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

  eixo_id TEXT NOT NULL CHECK (
    eixo_id IN (
      'eixo-1', 'eixo-2', 'eixo-3',
      'eixo-4', 'eixo-5', 'eixo-6',
      'eixo-7', 'eixo-8', 'eixo-9'
    )
  ),

  titulo TEXT NOT NULL CHECK (
    char_length(trim(titulo)) BETWEEN 1 AND 500
  ),

  descricao TEXT NOT NULL DEFAULT '',
  ordem INTEGER NOT NULL DEFAULT 0,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS submodulos (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

  modulo_id INTEGER NOT NULL
    REFERENCES modulos(id) ON DELETE CASCADE,

  titulo TEXT NOT NULL CHECK (
    char_length(trim(titulo)) BETWEEN 1 AND 500
  ),

  descricao TEXT NOT NULL DEFAULT '',
  ordem INTEGER NOT NULL DEFAULT 0,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS temas (
  id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

  submodulo_id INTEGER NOT NULL
    REFERENCES submodulos(id) ON DELETE CASCADE,

  titulo TEXT NOT NULL CHECK (
    char_length(trim(titulo)) BETWEEN 1 AND 500
  ),

  descricao TEXT NOT NULL DEFAULT '',
  bibliografia TEXT NOT NULL DEFAULT '',
  links TEXT NOT NULL DEFAULT '',
  anotacoes TEXT NOT NULL DEFAULT '',

  status TEXT NOT NULL DEFAULT 'nao_iniciado' CHECK (
    status IN ('nao_iniciado', 'em_estudo', 'concluido')
  ),

  ordem INTEGER NOT NULL DEFAULT 0,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_modulos_eixo_ordem
  ON modulos(eixo_id, ordem, id);

CREATE INDEX IF NOT EXISTS idx_submodulos_modulo_ordem
  ON submodulos(modulo_id, ordem, id);

CREATE INDEX IF NOT EXISTS idx_temas_submodulo_ordem
  ON temas(submodulo_id, ordem, id);
