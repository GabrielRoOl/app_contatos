package br.com.gabriel.contatos.web;

import br.com.gabriel.contatos.erro.ApiException;
import br.com.gabriel.contatos.sync.SyncService;
import br.com.gabriel.contatos.sync.SyncService.RespostaDelta;
import br.com.gabriel.contatos.sync.SyncService.RespostaLote;
import com.fasterxml.jackson.databind.JsonNode;
import java.time.Instant;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.Map;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/sync")
public class SyncController {

    private final SyncService sync;

    public SyncController(SyncService sync) {
        this.sync = sync;
    }

    /** Tudo que mudou a partir de {@code desde} (inclusive), com os excluídos. Sem {@code desde}, tudo. */
    @GetMapping
    public RespostaDelta alteradasDesde(@RequestParam(required = false) String desde) {
        return sync.alteradasDesde(instante(desde));
    }

    @PostMapping
    public RespostaLote lote(@RequestBody JsonNode operacoes) {
        return sync.processar(operacoes);
    }

    private static Instant instante(String valor) {
        if (valor == null || valor.isBlank()) {
            return null;
        }
        try {
            return DateTimeFormatter.ISO_OFFSET_DATE_TIME.parse(valor.strip().replace(' ', '+'), Instant::from);
        } catch (DateTimeParseException e) {
            throw ApiException.validacao("Dados inválidos.",
                    Map.of("campos", Map.of("desde", "Use um timestamp ISO 8601 com fuso, ex.: 2026-11-03T12:10:00.000Z.")));
        }
    }
}
