package br.com.gabriel.contatos;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.hamcrest.Matchers;

/** Banco simulado fora do ar: contexto próprio, por isso não estende ApiTestBase. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class SaudeForaDoArTest {

    @Autowired
    MockMvc mvc;

    @MockitoBean
    JdbcClient jdbc;

    @Test
    void devolve503SemVazarDetalhesDoErro() throws Exception {
        when(jdbc.sql(anyString())).thenThrow(new DataAccessResourceFailureException("senha=segredo host=interno"));

        mvc.perform(get("/api/v1/saude"))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.status").value("indisponivel"))
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(content().string(Matchers.not(Matchers.containsString("segredo"))))
                .andExpect(header().string("Cache-Control", "no-store"));
    }
}
