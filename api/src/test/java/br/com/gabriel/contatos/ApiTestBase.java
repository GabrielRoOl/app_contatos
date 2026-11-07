package br.com.gabriel.contatos;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
abstract class ApiTestBase {

    static final String TOKEN = "token-de-teste-com-mais-de-trinta-e-dois-caracteres";

    @Autowired
    MockMvc mvc;

    @Autowired
    JdbcClient jdbc;

    @BeforeEach
    void limparBanco() {
        jdbc.sql("DELETE FROM pessoa").update();
    }

    static String novoId() {
        return UUID.randomUUID().toString();
    }

    static String corpo(String id, String nome, String data, String turno) {
        return """
                {"id":"%s","nome":"%s","data":"%s","turno":"%s"}""".formatted(id, nome, data, turno);
    }

    static MockHttpServletRequestBuilder autenticado(MockHttpServletRequestBuilder req) {
        return req.header("Authorization", "Bearer " + TOKEN);
    }

    ResultActions criar(String json) throws Exception {
        return mvc.perform(autenticado(post("/api/v1/pessoas")).contentType(MediaType.APPLICATION_JSON).content(json));
    }

    ResultActions criar(String id, String nome, String data, String turno) throws Exception {
        return criar(corpo(id, nome, data, turno));
    }

    ResultActions alterar(String id, String json) throws Exception {
        return mvc.perform(autenticado(patch("/api/v1/pessoas/" + id)).contentType(MediaType.APPLICATION_JSON).content(json));
    }

    ResultActions excluir(String id) throws Exception {
        return mvc.perform(autenticado(delete("/api/v1/pessoas/" + id)));
    }

    ResultActions restaurar(String id) throws Exception {
        return mvc.perform(autenticado(post("/api/v1/pessoas/" + id + "/restaurar")));
    }

    ResultActions listar(String query) throws Exception {
        return mvc.perform(autenticado(get("/api/v1/pessoas" + query)));
    }
}
