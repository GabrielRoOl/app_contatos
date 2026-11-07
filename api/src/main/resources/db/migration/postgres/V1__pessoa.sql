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

-- Todos os timestamps são UTC, gravados sem fuso.
CREATE INDEX ix_pessoa_data ON pessoa (data);
CREATE INDEX ix_pessoa_atualizado ON pessoa (atualizado_em);

-- Regra central: nunca duas pessoas ativas no mesmo dia e turno.
CREATE UNIQUE INDEX ux_pessoa_dia_turno
  ON pessoa (nome_normalizado, data, turno)
  WHERE excluido_em IS NULL;
