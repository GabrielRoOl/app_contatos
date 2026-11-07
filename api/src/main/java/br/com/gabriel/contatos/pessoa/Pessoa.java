package br.com.gabriel.contatos.pessoa;

import com.fasterxml.jackson.annotation.JsonIgnore;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record Pessoa(
        UUID id,
        String nome,
        @JsonIgnore String nomeNormalizado,
        LocalDate data,
        Turno turno,
        Status status,
        Instant criadoEm,
        Instant atualizadoEm,
        Instant excluidoEm,
        int versao) {

    @JsonIgnore
    public boolean excluida() {
        return excluidoEm != null;
    }
}
