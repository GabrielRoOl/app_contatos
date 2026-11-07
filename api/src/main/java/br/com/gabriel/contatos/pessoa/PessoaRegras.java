package br.com.gabriel.contatos.pessoa;

import br.com.gabriel.contatos.erro.ApiException;
import br.com.gabriel.contatos.pessoa.EntradaPessoa.Alteracao;
import br.com.gabriel.contatos.pessoa.EntradaPessoa.NovaPessoa;
import java.time.Instant;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.http.HttpStatus;

/** Regras de negócio puras, sem acesso a dados. A unicidade é consultada pelo serviço. */
public final class PessoaRegras {

    private static final DateTimeFormatter DIA_MES = DateTimeFormatter.ofPattern("dd/MM");

    private PessoaRegras() {
    }

    public static Pessoa nova(NovaPessoa n, Instant agora) {
        return new Pessoa(n.id(), n.nome(), Normalizador.normalizar(n.nome()), n.data(), n.turno(), n.status(),
                agora, agora, null, 1);
    }

    /** Criação idempotente: o mesmo id com o mesmo conteúdo é a mesma criação. */
    public static boolean mesmoConteudo(Pessoa p, NovaPessoa n) {
        return p.nome().equals(n.nome())
                && p.data().equals(n.data())
                && p.turno() == n.turno()
                && p.status() == n.status();
    }

    /** Muda nome, data ou turno? (a versão só é conferida nesse caso). */
    public static boolean mudaIdentidade(Pessoa atual, Alteracao a) {
        return (a.nome() != null && !a.nome().equals(atual.nome()))
                || (a.data() != null && !a.data().equals(atual.data()))
                || (a.turno() != null && a.turno() != atual.turno());
    }

    public static boolean mudaStatus(Pessoa atual, Alteracao a) {
        return a.statusPresente() && a.status() != atual.status();
    }

    /** Confere a versão enviada. Só chamar quando a alteração mexe em nome, data ou turno. */
    public static void conferirVersao(Pessoa atual, Integer versaoEnviada) {
        if (versaoEnviada == null) {
            throw ApiException.validacao("Informe a versão (corpo ou If-Match) ao alterar nome, data ou turno.",
                    Map.of("campos", Map.of("versao", "Obrigatória ao alterar nome, data ou turno.")));
        }
        if (versaoEnviada != atual.versao()) {
            throw conflitoVersao(atual);
        }
    }

    /** Aplica a alteração. Devolve a própria pessoa, sem incrementar a versão, se nada mudou de fato. */
    public static Pessoa aplicar(Pessoa atual, Alteracao a, Instant agora) {
        boolean identidade = mudaIdentidade(atual, a);
        boolean status = mudaStatus(atual, a);
        if (!identidade && !status) {
            return atual;
        }
        String nome = a.nome() != null ? a.nome() : atual.nome();
        return new Pessoa(atual.id(), nome, Normalizador.normalizar(nome),
                a.data() != null ? a.data() : atual.data(),
                a.turno() != null ? a.turno() : atual.turno(),
                a.statusPresente() ? a.status() : atual.status(),
                atual.criadoEm(), agora, atual.excluidoEm(), atual.versao() + 1);
    }

    public static Pessoa excluir(Pessoa atual, Instant agora) {
        return new Pessoa(atual.id(), atual.nome(), atual.nomeNormalizado(), atual.data(), atual.turno(),
                atual.status(), atual.criadoEm(), agora, agora, atual.versao() + 1);
    }

    public static Pessoa restaurar(Pessoa atual, Instant agora) {
        return new Pessoa(atual.id(), atual.nome(), atual.nomeNormalizado(), atual.data(), atual.turno(),
                atual.status(), atual.criadoEm(), agora, null, atual.versao() + 1);
    }

    public static ApiException duplicado(Pessoa existente) {
        Map<String, Object> conflito = new LinkedHashMap<>();
        conflito.put("id", existente.id());
        conflito.put("nome", existente.nome());
        conflito.put("data", existente.data());
        conflito.put("turno", existente.turno());
        String msg = existente.nome() + " já está na lista em " + DIA_MES.format(existente.data()) + " "
                + existente.turno().descricao() + ".";
        return new ApiException(HttpStatus.CONFLICT, "DUPLICADO", msg, Map.of("conflito", conflito));
    }

    public static ApiException conflitoVersao(Pessoa atual) {
        return new ApiException(HttpStatus.CONFLICT, "CONFLITO_VERSAO",
                "O registro foi alterado em outro lugar. Versão atual: " + atual.versao() + ".",
                Map.of("atual", atual));
    }
}
