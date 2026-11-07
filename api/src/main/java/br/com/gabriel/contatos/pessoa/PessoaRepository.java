package br.com.gabriel.contatos.pessoa;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/** Acesso a dados com SQL explícito. Timestamps são UTC, gravados como timestamp sem fuso. */
@Repository
public class PessoaRepository {

    private static final String COLUNAS =
            "id, nome, nome_normalizado, data, turno, status, criado_em, atualizado_em, excluido_em, versao";

    private final JdbcClient jdbc;

    public PessoaRepository(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public Optional<Pessoa> buscar(UUID id) {
        return jdbc.sql("SELECT " + COLUNAS + " FROM pessoa WHERE id = :id")
                .param("id", id)
                .query(this::mapear)
                .optional();
    }

    /** Bloqueia a linha até o fim da transação (usar dentro de @Transactional). */
    public Optional<Pessoa> buscarParaAtualizar(UUID id) {
        return jdbc.sql("SELECT " + COLUNAS + " FROM pessoa WHERE id = :id FOR UPDATE")
                .param("id", id)
                .query(this::mapear)
                .optional();
    }

    /** Pessoa ativa com o mesmo nome normalizado, data e turno, ignorando {@code ignorarId}. */
    public Optional<Pessoa> buscarAtivaIgual(String nomeNormalizado, LocalDate data, Turno turno, UUID ignorarId) {
        var sql = new StringBuilder("SELECT " + COLUNAS + " FROM pessoa WHERE excluido_em IS NULL"
                + " AND nome_normalizado = :nn AND data = :data AND turno = :turno");
        if (ignorarId != null) {
            sql.append(" AND id <> :ignorar");
        }
        var stmt = jdbc.sql(sql.toString())
                .param("nn", nomeNormalizado)
                .param("data", data)
                .param("turno", turno.valor());
        if (ignorarId != null) {
            stmt = stmt.param("ignorar", ignorarId);
        }
        return stmt.query(this::mapear).list().stream().findFirst();
    }

    /** Apenas não excluídas. Ordem: data, turno (manha antes), criado_em. */
    public List<Pessoa> listar(LocalDate de, LocalDate ate, FiltroStatus status) {
        var sql = new StringBuilder("SELECT " + COLUNAS + " FROM pessoa WHERE excluido_em IS NULL");
        if (de != null) {
            sql.append(" AND data >= :de");
        }
        if (ate != null) {
            sql.append(" AND data <= :ate");
        }
        if (status == FiltroStatus.PENDENTE) {
            sql.append(" AND status IS NULL");
        } else if (status != null) {
            sql.append(" AND status = :status");
        }
        sql.append(" ORDER BY data, turno, criado_em, id");
        var stmt = jdbc.sql(sql.toString());
        if (de != null) {
            stmt = stmt.param("de", de);
        }
        if (ate != null) {
            stmt = stmt.param("ate", ate);
        }
        if (status != null && status != FiltroStatus.PENDENTE) {
            stmt = stmt.param("status", status.valor());
        }
        return stmt.query(this::mapear).list();
    }

    /** Tudo que mudou a partir de {@code desde} (inclusive), com os excluídos. Sem {@code desde}, tudo. */
    public List<Pessoa> alteradasDesde(Instant desde) {
        if (desde == null) {
            return jdbc.sql("SELECT " + COLUNAS + " FROM pessoa ORDER BY atualizado_em, id")
                    .query(this::mapear).list();
        }
        return jdbc.sql("SELECT " + COLUNAS + " FROM pessoa WHERE atualizado_em >= :desde ORDER BY atualizado_em, id")
                .param("desde", utc(desde))
                .query(this::mapear)
                .list();
    }

    public void inserir(Pessoa p) {
        jdbc.sql("INSERT INTO pessoa (" + COLUNAS + ") VALUES (:id, :nome, :nn, :data, :turno, :status,"
                        + " :criado, :atualizado, :excluido, :versao)")
                .param("id", p.id())
                .param("nome", p.nome())
                .param("nn", p.nomeNormalizado())
                .param("data", p.data())
                .param("turno", p.turno().valor())
                .param("status", p.status() == null ? null : p.status().valor())
                .param("criado", utc(p.criadoEm()))
                .param("atualizado", utc(p.atualizadoEm()))
                .param("excluido", p.excluidoEm() == null ? null : utc(p.excluidoEm()))
                .param("versao", p.versao())
                .update();
    }

    /** Grava os campos mutáveis. */
    public void atualizar(Pessoa p) {
        jdbc.sql("UPDATE pessoa SET nome = :nome, nome_normalizado = :nn, data = :data, turno = :turno,"
                        + " status = :status, atualizado_em = :atualizado, excluido_em = :excluido, versao = :versao"
                        + " WHERE id = :id")
                .param("id", p.id())
                .param("nome", p.nome())
                .param("nn", p.nomeNormalizado())
                .param("data", p.data())
                .param("turno", p.turno().valor())
                .param("status", p.status() == null ? null : p.status().valor())
                .param("atualizado", utc(p.atualizadoEm()))
                .param("excluido", p.excluidoEm() == null ? null : utc(p.excluidoEm()))
                .param("versao", p.versao())
                .update();
    }

    /** Apaga de vez os excluídos antes de {@code limite}. */
    public int apagarExcluidosAntes(Instant limite) {
        return jdbc.sql("DELETE FROM pessoa WHERE excluido_em IS NOT NULL AND excluido_em < :limite")
                .param("limite", utc(limite))
                .update();
    }

    private Pessoa mapear(ResultSet rs, int linha) throws SQLException {
        String status = rs.getString("status");
        return new Pessoa(
                rs.getObject("id", UUID.class),
                rs.getString("nome"),
                rs.getString("nome_normalizado"),
                rs.getObject("data", LocalDate.class),
                Turno.de(rs.getString("turno")),
                status == null ? null : Status.de(status),
                instante(rs, "criado_em"),
                instante(rs, "atualizado_em"),
                instante(rs, "excluido_em"),
                rs.getInt("versao"));
    }

    private static Instant instante(ResultSet rs, String coluna) throws SQLException {
        LocalDateTime t = rs.getObject(coluna, LocalDateTime.class);
        return t == null ? null : t.toInstant(ZoneOffset.UTC);
    }

    private static LocalDateTime utc(Instant i) {
        return LocalDateTime.ofInstant(i, ZoneOffset.UTC);
    }

    /** Filtro de status da listagem. */
    public enum FiltroStatus {
        OK("ok"), NAO("nao"), PENDENTE("pendente");

        private final String valor;

        FiltroStatus(String valor) {
            this.valor = valor;
        }

        public String valor() {
            return valor;
        }

        public static FiltroStatus de(String v) {
            for (FiltroStatus f : values()) {
                if (f.valor.equals(v)) {
                    return f;
                }
            }
            return null;
        }
    }
}
