package br.com.gabriel.contatos.web;

import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Verificação de saúde para scripts e monitores. É pública (ver {@code AuthFilter}), por isso
 * não devolve dados de pessoas, versão nem detalhes do erro: só se a API e o banco respondem.
 */
@RestController
@RequestMapping(SaudeController.CAMINHO)
public class SaudeController {

    public static final String CAMINHO = "/api/v1/saude";

    private static final Logger log = LoggerFactory.getLogger(SaudeController.class);

    private final JdbcClient jdbc;

    public SaudeController(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    @GetMapping
    public ResponseEntity<Map<String, String>> saude() {
        try {
            jdbc.sql("SELECT 1").query(Integer.class).single();
            return resposta(HttpStatus.OK, "ok");
        } catch (Exception e) {
            log.warn("Verificação de saúde: banco não respondeu ({})", e.getClass().getSimpleName());
            return resposta(HttpStatus.SERVICE_UNAVAILABLE, "indisponivel");
        }
    }

    private static ResponseEntity<Map<String, String>> resposta(HttpStatus status, String valor) {
        return ResponseEntity.status(status).cacheControl(CacheControl.noStore()).body(Map.of("status", valor));
    }
}
