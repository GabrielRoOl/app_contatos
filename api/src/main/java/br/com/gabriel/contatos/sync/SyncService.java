package br.com.gabriel.contatos.sync;

import br.com.gabriel.contatos.erro.ApiException;
import br.com.gabriel.contatos.erro.ErroApi;
import br.com.gabriel.contatos.pessoa.EntradaPessoa;
import br.com.gabriel.contatos.pessoa.Pessoa;
import br.com.gabriel.contatos.pessoa.PessoaService;
import br.com.gabriel.contatos.web.TratadorDeErros;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.JsonNode;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Service;

/**
 * Processa a fila offline em ordem. Cada operação roda na transação do próprio método do
 * {@link PessoaService}; se uma falha, as outras seguem e cada resultado é devolvido.
 */
@Service
public class SyncService {

    public static final int LIMITE_OPERACOES = 500;
    private static final Set<String> OPS = Set.of("criar", "alterar", "excluir", "restaurar");

    @JsonInclude(JsonInclude.Include.NON_NULL)
    public record ResultadoOperacao(String id, String op, boolean ok, Pessoa pessoa, ErroApi erro) {
    }

    public record RespostaLote(Instant agora, List<ResultadoOperacao> resultados) {
    }

    public record RespostaDelta(Instant agora, List<Pessoa> pessoas) {
    }

    private final PessoaService pessoas;

    public SyncService(PessoaService pessoas) {
        this.pessoas = pessoas;
    }

    /** O {@code agora} é calculado antes da consulta: o cliente usa como próximo {@code desde}. */
    public RespostaDelta alteradasDesde(Instant desde) {
        Instant agora = pessoas.agora();
        return new RespostaDelta(agora, pessoas.alteradasDesde(desde));
    }

    public RespostaLote processar(JsonNode corpo) {
        if (corpo == null || !corpo.isArray()) {
            throw ApiException.validacao("O corpo deve ser um array de operações.");
        }
        if (corpo.size() > LIMITE_OPERACOES) {
            throw ApiException.validacao("No máximo " + LIMITE_OPERACOES + " operações por requisição.",
                    Map.of("limite", LIMITE_OPERACOES, "recebidas", corpo.size()));
        }
        Instant agora = pessoas.agora();
        List<ResultadoOperacao> resultados = new ArrayList<>(corpo.size());
        for (JsonNode operacao : corpo) {
            resultados.add(executar(operacao));
        }
        return new RespostaLote(agora, resultados);
    }

    private ResultadoOperacao executar(JsonNode no) {
        String id = no != null && no.isObject() && no.get("id") != null && no.get("id").isTextual()
                ? no.get("id").textValue() : null;
        String op = no != null && no.isObject() && no.get("op") != null && no.get("op").isTextual()
                ? no.get("op").textValue() : null;
        try {
            if (no == null || !no.isObject()) {
                throw ApiException.validacao("Cada operação deve ser um objeto.");
            }
            if (op == null || !OPS.contains(op)) {
                throw ApiException.validacao("Operação inválida.",
                        Map.of("campos", Map.of("op", "Use criar, alterar, excluir ou restaurar.")));
            }
            UUID uuid = EntradaPessoa.id(no.get("id"));
            Pessoa resultado = switch (op) {
                case "criar" -> pessoas.criar(EntradaPessoa.criar(dados(no), uuid)).pessoa();
                case "alterar" -> pessoas.alterar(uuid, EntradaPessoa.alterar(dados(no), EntradaPessoa.versao(no.get("versao"))));
                case "excluir" -> pessoas.excluir(uuid);
                default -> pessoas.restaurar(uuid);
            };
            return new ResultadoOperacao(id, op, true, resultado, null);
        } catch (Exception e) {
            return new ResultadoOperacao(id, op, false, null, TratadorDeErros.traduzir(e).corpo());
        }
    }

    private static JsonNode dados(JsonNode operacao) {
        JsonNode dados = operacao.get("dados");
        if (dados == null || !dados.isObject()) {
            throw ApiException.validacao("A operação exige o objeto dados.",
                    Map.of("campos", Map.of("dados", "Obrigatório.")));
        }
        return dados;
    }
}
