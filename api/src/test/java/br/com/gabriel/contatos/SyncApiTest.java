package br.com.gabriel.contatos;

import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.matchesPattern;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import br.com.gabriel.contatos.pessoa.PessoaService;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.ResultActions;

class SyncApiTest extends ApiTestBase {

    @Autowired
    PessoaService service;

    ResultActions lote(String json) throws Exception {
        return mvc.perform(autenticado(post("/api/v1/sync")).contentType(MediaType.APPLICATION_JSON).content(json));
    }

    ResultActions delta(String query) throws Exception {
        return mvc.perform(autenticado(get("/api/v1/sync" + query)));
    }

    // ---- GET /sync ----

    @Test
    void getSyncDevolveOsExcluidosComExcluidoEmPreenchido() throws Exception {
        String vivo = novoId(), morto = novoId();
        criar(vivo, "Ana", "2026-11-03", "manha");
        criar(morto, "Bia", "2026-11-03", "manha");
        excluir(morto);

        delta("")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.agora").value(matchesPattern("\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}\\.\\d{3}Z")))
                .andExpect(jsonPath("$.pessoas", hasSize(2)))
                .andExpect(jsonPath("$.pessoas[?(@.id=='" + morto + "')].excluido_em").value(
                        org.hamcrest.Matchers.hasItem(org.hamcrest.Matchers.notNullValue())))
                .andExpect(jsonPath("$.pessoas[?(@.id=='" + vivo + "')].excluido_em").value(
                        org.hamcrest.Matchers.hasItem(org.hamcrest.Matchers.nullValue())));
    }

    @Test
    void getSyncFiltraPorDesdeEIncluiOInstanteExato() throws Exception {
        String antigo = novoId(), igual = novoId(), novo = novoId();
        criar(antigo, "Antiga", "2026-11-03", "manha");
        criar(igual, "Igual", "2026-11-03", "tarde");
        criar(novo, "Nova", "2026-11-04", "manha");
        definirAtualizadoEm(antigo, "2026-11-03T10:00:00.000");
        definirAtualizadoEm(igual, "2026-11-03T12:00:00.000");
        definirAtualizadoEm(novo, "2026-11-03T12:00:00.001");

        delta("?desde=2026-11-03T12:00:00.000Z")
                .andExpect(jsonPath("$.pessoas[*].nome").value(contains("Igual", "Nova")));
        delta("?desde=2026-11-03T06:00:00-03:00")
                .andExpect(jsonPath("$.pessoas", hasSize(3)));
        delta("?desde=ontem").andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.codigo").value("VALIDACAO"));
    }

    @Test
    void getSyncCalculaAgoraAntesDeConsultar() throws Exception {
        // tudo que o GET devolve foi atualizado em ou antes de "agora" calculado antes da consulta
        criar(novoId(), "Ana", "2026-11-03", "manha");
        String json = delta("").andReturn().getResponse().getContentAsString();
        var raiz = new com.fasterxml.jackson.databind.ObjectMapper().readTree(json);
        var agora = java.time.Instant.parse(raiz.get("agora").asText());
        var atualizado = java.time.Instant.parse(raiz.get("pessoas").get(0).get("atualizado_em").asText());
        org.junit.jupiter.api.Assertions.assertFalse(atualizado.isAfter(agora));
    }

    // ---- POST /sync ----

    @Test
    void loteProcessaEmOrdemEDevolveResultadoPorOperacao() throws Exception {
        String a = novoId(), b = novoId();
        String json = """
                [
                 {"op":"criar","id":"%s","dados":{"nome":"Ana Souza","data":"2026-11-03","turno":"manha"}},
                 {"op":"criar","id":"%s","dados":{"nome":"Bia","data":"2026-11-03","turno":"tarde","status":"ok"}},
                 {"op":"alterar","id":"%s","versao":1,"dados":{"nome":"Ana Maria Souza"}},
                 {"op":"excluir","id":"%s"},
                 {"op":"restaurar","id":"%s"}
                ]""".formatted(a, b, a, b, b);

        lote(json)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.agora").exists())
                .andExpect(jsonPath("$.resultados", hasSize(5)))
                .andExpect(jsonPath("$.resultados[*].ok").value(contains(true, true, true, true, true)))
                .andExpect(jsonPath("$.resultados[0].op").value("criar"))
                .andExpect(jsonPath("$.resultados[0].id").value(a))
                .andExpect(jsonPath("$.resultados[0].pessoa.versao").value(1))
                .andExpect(jsonPath("$.resultados[0].erro").doesNotExist())
                .andExpect(jsonPath("$.resultados[2].pessoa.nome").value("Ana Maria Souza"))
                .andExpect(jsonPath("$.resultados[2].pessoa.versao").value(2))
                .andExpect(jsonPath("$.resultados[3].pessoa.excluido_em").isNotEmpty())
                .andExpect(jsonPath("$.resultados[4].pessoa.excluido_em").isEmpty())
                .andExpect(jsonPath("$.resultados[4].pessoa.versao").value(3));
    }

    @Test
    void falhaEmUmaOperacaoNaoImpedeAsOutras() throws Exception {
        String a = novoId(), dup = novoId(), c = novoId();
        criar(a, "Ana", "2026-11-03", "manha");
        String json = """
                [
                 {"op":"criar","id":"%s","dados":{"nome":"ana","data":"2026-11-03","turno":"manha"}},
                 {"op":"alterar","id":"%s","versao":99,"dados":{"nome":"Outra"}},
                 {"op":"criar","id":"%s","dados":{"nome":"Carla","data":"2026-11-03","turno":"manha"}},
                 {"op":"alterar","id":"%s","dados":{"status":"ok"}},
                 {"op":"voar","id":"%s"},
                 {"op":"excluir","id":"nao-e-uuid"},
                 42
                ]""".formatted(dup, a, c, novoId(), novoId());

        lote(json)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.resultados", hasSize(7)))
                .andExpect(jsonPath("$.resultados[0].ok").value(false))
                .andExpect(jsonPath("$.resultados[0].erro.codigo").value("DUPLICADO"))
                .andExpect(jsonPath("$.resultados[0].erro.detalhes.conflito.id").value(a))
                .andExpect(jsonPath("$.resultados[0].pessoa").doesNotExist())
                .andExpect(jsonPath("$.resultados[1].erro.codigo").value("CONFLITO_VERSAO"))
                .andExpect(jsonPath("$.resultados[1].erro.detalhes.atual.versao").value(1))
                .andExpect(jsonPath("$.resultados[2].ok").value(true))
                .andExpect(jsonPath("$.resultados[3].erro.codigo").value("NAO_ENCONTRADO"))
                .andExpect(jsonPath("$.resultados[4].erro.codigo").value("VALIDACAO"))
                .andExpect(jsonPath("$.resultados[5].erro.codigo").value("VALIDACAO"))
                .andExpect(jsonPath("$.resultados[6].erro.codigo").value("VALIDACAO"));

        listar("").andExpect(jsonPath("$", hasSize(2)));
    }

    @Test
    void criarNoLoteEIdempotente() throws Exception {
        String id = novoId();
        String op = """
                {"op":"criar","id":"%s","dados":{"nome":"Ana","data":"2026-11-03","turno":"manha"}}""".formatted(id);
        lote("[" + op + "]").andExpect(jsonPath("$.resultados[0].ok").value(true));
        lote("[" + op + "," + op + "]")
                .andExpect(jsonPath("$.resultados[0].ok").value(true))
                .andExpect(jsonPath("$.resultados[1].ok").value(true))
                .andExpect(jsonPath("$.resultados[1].pessoa.versao").value(1));
        listar("").andExpect(jsonPath("$", hasSize(1)));
    }

    @Test
    void limiteDe500Operacoes() throws Exception {
        String excluirInexistente = "{\"op\":\"excluir\",\"id\":\"" + UUID.randomUUID() + "\"}";
        lote("[" + String.join(",", java.util.Collections.nCopies(500, excluirInexistente)) + "]")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.resultados", hasSize(500)));
        lote("[" + String.join(",", java.util.Collections.nCopies(501, excluirInexistente)) + "]")
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.codigo").value("VALIDACAO"));
    }

    @Test
    void corpoQueNaoEArrayOuJsonInvalidoDa422() throws Exception {
        lote("{\"op\":\"criar\"}").andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.codigo").value("VALIDACAO"));
        lote("[{").andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.codigo").value("VALIDACAO"));
        lote("[]").andExpect(status().isOk()).andExpect(jsonPath("$.resultados", hasSize(0)));
    }

    // ---- limpeza ----

    @Test
    void limpezaApagaSoExcluidosComMaisDeTrintaDias() throws Exception {
        String velho = novoId(), recente = novoId(), vivo = novoId();
        criar(velho, "Velho", "2026-01-01", "manha");
        criar(recente, "Recente", "2026-01-02", "manha");
        criar(vivo, "Vivo", "2026-01-03", "manha");
        excluir(velho);
        excluir(recente);
        var agora = LocalDateTime.now(ZoneOffset.UTC);
        jdbc.sql("UPDATE pessoa SET excluido_em = :t WHERE id = :id")
                .param("t", agora.minusDays(31)).param("id", UUID.fromString(velho)).update();
        jdbc.sql("UPDATE pessoa SET excluido_em = :t WHERE id = :id")
                .param("t", agora.minusDays(29)).param("id", UUID.fromString(recente)).update();

        org.junit.jupiter.api.Assertions.assertEquals(1, service.limparExcluidos(30));

        delta("").andExpect(jsonPath("$.pessoas[*].nome").value(org.hamcrest.Matchers.containsInAnyOrder("Recente", "Vivo")));
    }

    private void definirAtualizadoEm(String id, String utc) {
        jdbc.sql("UPDATE pessoa SET atualizado_em = :t WHERE id = :id")
                .param("t", LocalDateTime.parse(utc)).param("id", UUID.fromString(id)).update();
    }
}
