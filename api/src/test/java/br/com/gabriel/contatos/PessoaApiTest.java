package br.com.gabriel.contatos;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;

class PessoaApiTest extends ApiTestBase {

    // ---- unicidade ----

    @Test
    void mesmoNomeComOutraCaixaEAcentosNoMesmoDiaETurnoDa409() throws Exception {
        criar(novoId(), "ana souza", "2026-11-03", "manha").andExpect(status().isCreated());

        criar(novoId(), "  Ána   SOUZA ", "2026-11-03", "manha")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.codigo").value("DUPLICADO"))
                .andExpect(jsonPath("$.detalhes.conflito.nome").value("ana souza"))
                .andExpect(jsonPath("$.detalhes.conflito.data").value("2026-11-03"))
                .andExpect(jsonPath("$.detalhes.conflito.turno").value("manha"))
                .andExpect(jsonPath("$.mensagem").value("ana souza já está na lista em 03/11 de manhã."));
    }

    @Test
    void mesmoNomeEDataEmOutroTurnoCria201() throws Exception {
        criar(novoId(), "Ana Souza", "2026-11-03", "manha").andExpect(status().isCreated());
        criar(novoId(), "Ana Souza", "2026-11-03", "tarde").andExpect(status().isCreated());
        listar("").andExpect(jsonPath("$", hasSize(2)));
    }

    @Test
    void restaurarComOutroIgualAtivoDa409() throws Exception {
        String original = novoId();
        criar(original, "Ana Souza", "2026-11-03", "manha").andExpect(status().isCreated());
        excluir(original).andExpect(status().isOk());
        criar(novoId(), "Ana Souza", "2026-11-03", "manha").andExpect(status().isCreated());

        restaurar(original)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.codigo").value("DUPLICADO"));
    }

    @Test
    void excluirLiberaOSlotERestaurarSemConflitoFunciona() throws Exception {
        String id = novoId();
        criar(id, "Ana Souza", "2026-11-03", "manha");
        excluir(id).andExpect(status().isOk())
                .andExpect(jsonPath("$.excluido_em").isNotEmpty())
                .andExpect(jsonPath("$.versao").value(2));
        restaurar(id).andExpect(status().isOk())
                .andExpect(jsonPath("$.excluido_em").isEmpty())
                .andExpect(jsonPath("$.versao").value(3));
    }

    // ---- idempotência ----

    @Test
    void criacaoIdempotentePeloId() throws Exception {
        String id = novoId();
        String json = corpo(id, "Ana Souza", "2026-11-03", "manha");
        criar(json).andExpect(status().isCreated()).andExpect(jsonPath("$.versao").value(1));
        criar(json).andExpect(status().isOk()).andExpect(jsonPath("$.id").value(id));

        listar("").andExpect(jsonPath("$", hasSize(1)));
    }

    @Test
    void mesmoIdComConteudoDiferenteDaConflitoDeVersaoComAtual() throws Exception {
        String id = novoId();
        criar(id, "Ana Souza", "2026-11-03", "manha").andExpect(status().isCreated());

        criar(id, "Ana Souza", "2026-11-04", "manha")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.codigo").value("CONFLITO_VERSAO"))
                .andExpect(jsonPath("$.detalhes.atual.id").value(id))
                .andExpect(jsonPath("$.detalhes.atual.data").value("2026-11-03"));
    }

    // ---- filtros ----

    @Test
    void filtrosDeAteStatusCombinadosComPeriodoInclusivo() throws Exception {
        String a = novoId(), b = novoId(), c = novoId(), d = novoId();
        criar(a, "Ana", "2026-11-01", "manha");
        criar(b, "Bia", "2026-11-02", "tarde");
        criar(c, "Caio", "2026-11-02", "manha");
        criar(d, "Davi", "2026-11-03", "manha");
        alterar(a, "{\"status\":\"ok\"}");
        alterar(b, "{\"status\":\"ok\"}");
        alterar(d, "{\"status\":\"nao\"}");

        // ordem: data, turno (manha antes), criado_em
        listar("").andExpect(jsonPath("$[*].nome").value(org.hamcrest.Matchers.contains("Ana", "Caio", "Bia", "Davi")));
        listar("?de=2026-11-02&ate=2026-11-02").andExpect(jsonPath("$[*].nome").value(org.hamcrest.Matchers.contains("Caio", "Bia")));
        listar("?de=2026-11-02").andExpect(jsonPath("$", hasSize(3)));
        listar("?ate=2026-11-01").andExpect(jsonPath("$", hasSize(1)));
        listar("?status=ok").andExpect(jsonPath("$[*].nome").value(org.hamcrest.Matchers.contains("Ana", "Bia")));
        listar("?status=nao").andExpect(jsonPath("$[*].nome").value(org.hamcrest.Matchers.contains("Davi")));
        listar("?status=pendente").andExpect(jsonPath("$[*].nome").value(org.hamcrest.Matchers.contains("Caio")));
        listar("?de=2026-11-02&ate=2026-11-03&status=ok").andExpect(jsonPath("$[*].nome").value(org.hamcrest.Matchers.contains("Bia")));
    }

    @Test
    void listaNaoTrazExcluidos() throws Exception {
        String id = novoId();
        criar(id, "Ana", "2026-11-01", "manha");
        excluir(id);
        listar("").andExpect(jsonPath("$", hasSize(0)));
    }

    // ---- alteração e versão ----

    @Test
    void alterarNomeComVersaoAtualIncrementaVersao() throws Exception {
        String id = novoId();
        criar(id, "Ana", "2026-11-03", "manha");
        alterar(id, "{\"nome\":\"Ana Souza\",\"versao\":1}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.nome").value("Ana Souza"))
                .andExpect(jsonPath("$.versao").value(2));
    }

    @Test
    void versaoPodeVirNoIfMatch() throws Exception {
        String id = novoId();
        criar(id, "Ana", "2026-11-03", "manha");
        mvc.perform(autenticado(MockMvcRequestBuilders.patch("/api/v1/pessoas/" + id))
                        .header("If-Match", "\"1\"")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"turno\":\"tarde\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.turno").value("tarde"))
                .andExpect(jsonPath("$.versao").value(2));
    }

    @Test
    void versaoDesatualizadaEmNomeDataOuTurnoDaConflitoComAtual() throws Exception {
        String id = novoId();
        criar(id, "Ana", "2026-11-03", "manha");
        alterar(id, "{\"data\":\"2026-11-04\",\"versao\":1}").andExpect(status().isOk());

        alterar(id, "{\"nome\":\"Outra\",\"versao\":1}")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.codigo").value("CONFLITO_VERSAO"))
                .andExpect(jsonPath("$.detalhes.atual.versao").value(2))
                .andExpect(jsonPath("$.detalhes.atual.data").value("2026-11-04"));
    }

    @Test
    void alterarNomeDataOuTurnoSemVersaoDa422() throws Exception {
        String id = novoId();
        criar(id, "Ana", "2026-11-03", "manha");
        alterar(id, "{\"nome\":\"Outra\"}")
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.codigo").value("VALIDACAO"));
    }

    @Test
    void statusSozinhoSempreVenceMesmoComVersaoVelha() throws Exception {
        String id = novoId();
        criar(id, "Ana", "2026-11-03", "manha");
        alterar(id, "{\"data\":\"2026-11-04\",\"versao\":1}").andExpect(status().isOk());

        alterar(id, "{\"status\":\"ok\",\"versao\":1}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ok"))
                .andExpect(jsonPath("$.versao").value(3));
        alterar(id, "{\"status\":\"nao\"}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("nao"))
                .andExpect(jsonPath("$.versao").value(4));
    }

    @Test
    void statusNullVoltaParaPendenteEAusenteNaoMexe() throws Exception {
        String id = novoId();
        criar(id, "Ana", "2026-11-03", "manha");
        alterar(id, "{\"status\":\"ok\"}").andExpect(jsonPath("$.status").value("ok"));

        alterar(id, "{\"nome\":\"Ana\",\"versao\":2}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ok"))
                .andExpect(jsonPath("$.versao").value(2));

        alterar(id, "{\"status\":null}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").isEmpty())
                .andExpect(jsonPath("$.versao").value(3));
    }

    @Test
    void semMudancaRealNaoIncrementaVersao() throws Exception {
        String id = novoId();
        criar(id, "Ana", "2026-11-03", "manha");
        alterar(id, "{\"nome\":\"Ana\",\"data\":\"2026-11-03\",\"turno\":\"manha\",\"versao\":1}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.versao").value(1));
        alterar(id, "{}").andExpect(status().isOk()).andExpect(jsonPath("$.versao").value(1));
    }

    @Test
    void alterarParaFicarDuplicadoDa409() throws Exception {
        criar(novoId(), "Ana", "2026-11-03", "manha");
        String id = novoId();
        criar(id, "Ana", "2026-11-03", "tarde");
        alterar(id, "{\"turno\":\"manha\",\"versao\":1}")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.codigo").value("DUPLICADO"));
    }

    @Test
    void alterarRegistroExcluidoOuInexistenteDa404() throws Exception {
        String id = novoId();
        criar(id, "Ana", "2026-11-03", "manha");
        excluir(id);
        alterar(id, "{\"status\":\"ok\"}").andExpect(status().isNotFound())
                .andExpect(jsonPath("$.codigo").value("NAO_ENCONTRADO"));
        alterar(novoId(), "{\"status\":\"ok\"}").andExpect(status().isNotFound());
        alterar("nao-e-uuid", "{\"status\":\"ok\"}").andExpect(status().isNotFound());
    }

    // ---- exclusão e restauração ----

    @Test
    void excluirERestaurarSaoIdempotentes() throws Exception {
        String id = novoId();
        criar(id, "Ana", "2026-11-03", "manha");
        restaurar(id).andExpect(status().isOk()).andExpect(jsonPath("$.versao").value(1));
        excluir(id).andExpect(jsonPath("$.versao").value(2));
        excluir(id).andExpect(status().isOk()).andExpect(jsonPath("$.versao").value(2));
        excluir(novoId()).andExpect(status().isNotFound());
        restaurar(novoId()).andExpect(status().isNotFound());
    }

    // ---- validação ----

    @Test
    void validacaoDeCampos() throws Exception {
        String longo = "a".repeat(81);
        criar(corpo(novoId(), "   ", "2026-11-03", "manha")).andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.codigo").value("VALIDACAO"))
                .andExpect(jsonPath("$.detalhes.campos.nome").exists());
        criar(corpo(novoId(), longo, "2026-11-03", "manha")).andExpect(status().isUnprocessableEntity());
        criar(corpo(novoId(), "a".repeat(80), "2026-11-03", "manha")).andExpect(status().isCreated());
        criar(corpo(novoId(), "Ana", "2026-02-30", "manha")).andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.detalhes.campos.data").exists());
        criar(corpo(novoId(), "Ana", "03/11/2026", "manha")).andExpect(status().isUnprocessableEntity());
        criar(corpo(novoId(), "Ana", "2026-11-03", "noite")).andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.detalhes.campos.turno").exists());
        criar(corpo("123", "Ana", "2026-11-03", "manha")).andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.detalhes.campos.id").exists());
        criar("{\"id\":\"" + novoId() + "\",\"nome\":\"Ana\",\"data\":\"2026-11-03\",\"turno\":\"manha\",\"status\":\"talvez\"}")
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.detalhes.campos.status").exists());
        criar("{}").andExpect(status().isUnprocessableEntity());
        alterar(criarERetornarId(), "{\"turno\":\"noite\"}").andExpect(status().isUnprocessableEntity());
        listar("?status=talvez").andExpect(status().isUnprocessableEntity());
        listar("?de=2026-13-01").andExpect(status().isUnprocessableEntity());
    }

    @Test
    void jsonInvalidoDa422Validacao() throws Exception {
        criar("{nome:").andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.codigo").value("VALIDACAO"));
        mvc.perform(autenticado(MockMvcRequestBuilders.post("/api/v1/pessoas")).contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.codigo").value("VALIDACAO"));
    }

    @Test
    void nomeEhLimpoNaResposta() throws Exception {
        criar(novoId(), "  Ana    Maria  Souza ", "2026-11-03", "manha")
                .andExpect(jsonPath("$.nome").value("Ana Maria Souza"))
                .andExpect(jsonPath("$.nome_normalizado").doesNotExist());
    }

    @Test
    void timestampsEmUtcComMilissegundos() throws Exception {
        criar(novoId(), "Ana", "2026-11-03", "manha")
                .andExpect(jsonPath("$.criado_em").value(org.hamcrest.Matchers.matchesPattern("\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z")))
                .andExpect(jsonPath("$.excluido_em").value(org.hamcrest.Matchers.nullValue()));
    }

    private String criarERetornarId() throws Exception {
        String id = novoId();
        criar(id, "Zeca", "2026-12-01", "tarde").andExpect(status().isCreated());
        return id;
    }
}
