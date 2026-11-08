package br.com.gabriel.contatos;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.head;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;

class SaudeApiTest extends ApiTestBase {

    @Test
    void respondeOkSemTokenESemDadosAlemDoStatus() throws Exception {
        criar(novoId(), "Ana Souza", "2026-11-03", "manha").andExpect(status().isCreated());

        mvc.perform(get("/api/v1/saude"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ok"))
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(header().string("Cache-Control", "no-store"));
        mvc.perform(head("/api/v1/saude")).andExpect(status().isOk());
    }

    @Test
    void soEssaRotaEPublica() throws Exception {
        mvc.perform(post("/api/v1/saude")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/saude/")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/saude/x")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/pessoas")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/sync")).andExpect(status().isUnauthorized());
    }
}
