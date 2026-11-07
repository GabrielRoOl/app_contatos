package br.com.gabriel.contatos.pessoa;

import br.com.gabriel.contatos.erro.ApiException;
import br.com.gabriel.contatos.pessoa.EntradaPessoa.Alteracao;
import br.com.gabriel.contatos.pessoa.EntradaPessoa.NovaPessoa;
import br.com.gabriel.contatos.pessoa.PessoaRepository.FiltroStatus;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Cada método público é uma transação própria. A unicidade entre ativos também é conferida aqui
 * (consulta antes de gravar), porque o H2 dos testes não tem índice único parcial.
 */
@Service
public class PessoaService {

    /** {@code criada} é false quando o mesmo id e conteúdo já existiam (criação idempotente). */
    public record ResultadoCriacao(Pessoa pessoa, boolean criada) {
    }

    private final PessoaRepository repo;
    private final Clock relogio;

    public PessoaService(PessoaRepository repo, Clock relogio) {
        this.repo = repo;
        this.relogio = relogio;
    }

    /** Instante atual do servidor em UTC, com milissegundos. */
    public Instant agora() {
        return Instant.now(relogio).truncatedTo(ChronoUnit.MILLIS);
    }

    @Transactional(readOnly = true)
    public List<Pessoa> listar(LocalDate de, LocalDate ate, FiltroStatus status) {
        return repo.listar(de, ate, status);
    }

    @Transactional(readOnly = true)
    public List<Pessoa> alteradasDesde(Instant desde) {
        return repo.alteradasDesde(desde);
    }

    @Transactional
    public ResultadoCriacao criar(NovaPessoa nova) {
        Optional<Pessoa> existente = repo.buscarParaAtualizar(nova.id());
        if (existente.isPresent()) {
            if (PessoaRegras.mesmoConteudo(existente.get(), nova)) {
                return new ResultadoCriacao(existente.get(), false);
            }
            throw PessoaRegras.conflitoVersao(existente.get());
        }
        Pessoa pessoa = PessoaRegras.nova(nova, agora());
        garantirUnica(pessoa);
        repo.inserir(pessoa);
        return new ResultadoCriacao(pessoa, true);
    }

    @Transactional
    public Pessoa alterar(UUID id, Alteracao alteracao) {
        Pessoa atual = repo.buscarParaAtualizar(id).filter(p -> !p.excluida()).orElseThrow(ApiException::naoEncontrado);
        boolean identidade = PessoaRegras.mudaIdentidade(atual, alteracao);
        if (identidade) {
            PessoaRegras.conferirVersao(atual, alteracao.versao());
        }
        Pessoa nova = PessoaRegras.aplicar(atual, alteracao, agora());
        if (nova == atual) {
            return atual;
        }
        if (identidade) {
            garantirUnica(nova);
        }
        repo.atualizar(nova);
        return nova;
    }

    /** Idempotente: excluir o que já está excluído devolve o registro como está. */
    @Transactional
    public Pessoa excluir(UUID id) {
        Pessoa atual = repo.buscarParaAtualizar(id).orElseThrow(ApiException::naoEncontrado);
        if (atual.excluida()) {
            return atual;
        }
        Pessoa nova = PessoaRegras.excluir(atual, agora());
        repo.atualizar(nova);
        return nova;
    }

    /** Idempotente: restaurar o que já está ativo devolve o registro como está. Revalida a unicidade. */
    @Transactional
    public Pessoa restaurar(UUID id) {
        Pessoa atual = repo.buscarParaAtualizar(id).orElseThrow(ApiException::naoEncontrado);
        if (!atual.excluida()) {
            return atual;
        }
        garantirUnica(atual);
        Pessoa nova = PessoaRegras.restaurar(atual, agora());
        repo.atualizar(nova);
        return nova;
    }

    /** Apaga de vez os excluídos há mais de {@code dias} dias. Devolve quantos foram apagados. */
    @Transactional
    public int limparExcluidos(int dias) {
        return repo.apagarExcluidosAntes(agora().minus(dias, ChronoUnit.DAYS));
    }

    private void garantirUnica(Pessoa candidata) {
        repo.buscarAtivaIgual(candidata.nomeNormalizado(), candidata.data(), candidata.turno(), candidata.id())
                .ifPresent(existente -> {
                    throw PessoaRegras.duplicado(existente);
                });
    }
}
