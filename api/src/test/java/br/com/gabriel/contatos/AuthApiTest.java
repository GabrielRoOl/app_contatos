package br.com.gabriel.contatos;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import br.com.gabriel.contatos.config.AppProperties;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;

class AuthApiTest extends ApiTestBase {

    @Test
    void semTokenDa401() throws Exception {
        mvc.perform(get("/api/v1/pessoas"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.codigo").value("NAO_AUTORIZADO"));
        mvc.perform(get("/api/v1/sync")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/pessoas").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/sync").contentType(MediaType.APPLICATION_JSON).content("[]"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void tokenErradoOuFormatoErradoDa401() throws Exception {
        mvc.perform(get("/api/v1/pessoas").header("Authorization", "Bearer errado"))
                .andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/pessoas").header("Authorization", "Bearer " + TOKEN + "x"))
                .andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/pessoas").header("Authorization", "Bearer "))
                .andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/pessoas").header("Authorization", TOKEN))
                .andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/pessoas").header("Authorization", "Basic " + TOKEN))
                .andExpect(status().isUnauthorized())
                .andExpect(header().string("WWW-Authenticate", "Bearer"));
    }

    @Test
    void tokenCorretoPassa() throws Exception {
        mvc.perform(get("/api/v1/pessoas").header("Authorization", "Bearer " + TOKEN))
                .andExpect(status().isOk());
        mvc.perform(get("/api/v1/pessoas").header("Authorization", "bearer " + TOKEN))
                .andExpect(status().isOk());
    }

    @Test
    void rotaInexistenteExigeTokenEDepoisDa404() throws Exception {
        mvc.perform(get("/api/v1/nada")).andExpect(status().isUnauthorized());
        mvc.perform(autenticado(get("/api/v1/nada")))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.codigo").value("NAO_ENCONTRADO"));
    }

    @Test
    void preflightPassaSemTokenSoParaAOrigemConfigurada() throws Exception {
        mvc.perform(options("/api/v1/pessoas")
                        .header("Origin", "http://localhost:5173")
                        .header("Access-Control-Request-Method", "PATCH")
                        .header("Access-Control-Request-Headers", "authorization,content-type,if-match"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", "http://localhost:5173"));

        mvc.perform(options("/api/v1/pessoas")
                        .header("Origin", "http://malvado.example")
                        .header("Access-Control-Request-Method", "GET"))
                .andExpect(status().isForbidden());
    }

    @Test
    void respostaDe401TambemTemCabecalhosCors() throws Exception {
        mvc.perform(get("/api/v1/pessoas").header("Origin", "http://localhost:5173"))
                .andExpect(status().isUnauthorized())
                .andExpect(header().string("Access-Control-Allow-Origin", "http://localhost:5173"));
    }

    @Test
    void tokenVazioOuCurtoImpedeAPartida() {
        assertThrows(IllegalStateException.class, () -> new AppProperties("", "http://x", 30, "0 0 3 * * *"));
        assertThrows(IllegalStateException.class, () -> new AppProperties(null, "http://x", 30, "0 0 3 * * *"));
        assertThrows(IllegalStateException.class, () -> new AppProperties("curto", "http://x", 30, "0 0 3 * * *"));
        new AppProperties("x".repeat(AppProperties.TAMANHO_MINIMO_TOKEN), "http://x", 30, "0 0 3 * * *");
    }
}
