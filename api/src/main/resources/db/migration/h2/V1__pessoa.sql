-- Usada só nos testes (H2 em modo PostgreSQL). O H2 não aceita índice único parcial,
-- então a unicidade de nome_normalizado + data + turno entre ativos é garantida
-- apenas pelo serviço. A fonte da verdade é db/migration/postgres.
CREATE TABLE pessoa (
  id               uuid PRIMARY KEY,
  nome             varchar(80) NOT NULL CHECK (char_length(nome) >= 1),
  nome_normalizado text NOT NULL,
  data             date NOT NULL,
  turno            varchar(5) NOT NULL CHECK (turno IN ('manha', 'tarde')),
  status           varchar(3) NULL CHECK (status IN ('ok', 'nao')),
  criado_em        timestamp(3) NOT NULL,
  atualizado_em    timestamp(3) NOT NULL,
  excluido_em      timestamp(3) NULL,
  versao           integer NOT NULL DEFAULT 1 CHECK (versao >= 1)
);

CREATE INDEX ix_pessoa_data ON pessoa (data);
CREATE INDEX ix_pessoa_atualizado ON pessoa (atualizado_em);
CREATE INDEX ix_pessoa_dia_turno ON pessoa (nome_normalizado, data, turno);
