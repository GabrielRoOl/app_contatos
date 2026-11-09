package br.com.gabriel.contatos;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/** Contexto próprio: 3 erros bloqueiam e o IP vem do cabeçalho X-Real-IP. Cada teste usa IPs próprios. */
@SpringBootTest(properties = {"app.tentativas-maximas=3", "app.cabecalho-ip-cliente=X-Real-IP"})
@AutoConfigureMockMvc
@ActiveProfiles("test")
class BloqueioApiTest {

    static final String TOKEN = "token-de-teste-com-mais-de-trinta-e-dois-caracteres";

    @Autowired
    MockMvc mvc;

    private static MockHttpServletRequestBuilder de(String ip, String token) {
        MockHttpServletRequestBuilder req = get("/api/v1/pessoas").header("X-Real-IP", ip);
        return token == null ? req : req.header("Authorization", "Bearer " + token);
    }

    @Test
    void aposOsErrosBloqueiaOIpAteComOTokenCerto() throws Exception {
        for (int i = 0; i < 3; i++) {
            mvc.perform(de("10.0.0.1", "errado")).andExpect(status().isUnauthorized());
        }
        mvc.perform(de("10.0.0.1", "errado"))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.codigo").value("MUITAS_TENTATIVAS"))
                .andExpect(jsonPath("$.detalhes.tentar_novamente_em_segundos").value(
                        org.hamcrest.Matchers.allOf(
                                org.hamcrest.Matchers.greaterThan(590), org.hamcrest.Matchers.lessThanOrEqualTo(600))))
                .andExpect(header().exists("Retry-After"));
        mvc.perform(de("10.0.0.1", TOKEN)).andExpect(status().isTooManyRequests());
    }

    @Test
    void outroIpNaoEAfetado() throws Exception {
        for (int i = 0; i < 3; i++) {
            mvc.perform(de("10.0.0.2", "errado")).andExpect(status().isUnauthorized());
        }
        mvc.perform(de("10.0.0.2", TOKEN)).andExpect(status().isTooManyRequests());
        mvc.perform(de("10.0.0.3", TOKEN)).andExpect(status().isOk());
    }

    @Test
    void tokenCertoZeraOsErros() throws Exception {
        for (int i = 0; i < 2; i++) {
            mvc.perform(de("10.0.0.4", "errado")).andExpect(status().isUnauthorized());
        }
        mvc.perform(de("10.0.0.4", TOKEN)).andExpect(status().isOk());
        for (int i = 0; i < 2; i++) {
            mvc.perform(de("10.0.0.4", "errado")).andExpect(status().isUnauthorized());
        }
        mvc.perform(de("10.0.0.4", TOKEN)).andExpect(status().isOk());
    }

    @Test
    void semCabecalhoAuthorizationNaoContaComoTentativa() throws Exception {
        for (int i = 0; i < 10; i++) {
            mvc.perform(de("10.0.0.5", null)).andExpect(status().isUnauthorized());
        }
        mvc.perform(de("10.0.0.5", TOKEN)).andExpect(status().isOk());
    }

    @Test
    void usaOUltimoIpDoCabecalhoParaNaoSerForjado() throws Exception {
        // O cliente forja o começo da lista; o proxy acrescenta o IP verdadeiro no fim.
        for (int i = 0; i < 3; i++) {
            mvc.perform(de("1.1." + i + ".1, 10.0.0.6", "errado")).andExpect(status().isUnauthorized());
        }
        mvc.perform(de("9.9.9.9, 10.0.0.6", TOKEN)).andExpect(status().isTooManyRequests());
    }

    @Test
    void saudeEPreflightContinuamLivresDuranteOBloqueio() throws Exception {
        for (int i = 0; i < 3; i++) {
            mvc.perform(de("10.0.0.7", "errado")).andExpect(status().isUnauthorized());
        }
        mvc.perform(get("/api/v1/saude").header("X-Real-IP", "10.0.0.7")).andExpect(status().isOk());
        mvc.perform(options("/api/v1/pessoas").header("X-Real-IP", "10.0.0.7")
                        .header("Origin", "http://localhost:5173")
                        .header("Access-Control-Request-Method", "GET"))
                .andExpect(status().isOk());
    }
}
