package br.com.gabriel.contatos.pessoa;

import com.fasterxml.jackson.annotation.JsonValue;

/** Marcação da pessoa. Pendente é a ausência de status (null). */
public enum Status {
    OK("ok"),
    NAO("nao");

    private final String valor;

    Status(String valor) {
        this.valor = valor;
    }

    @JsonValue
    public String valor() {
        return valor;
    }

    public static Status de(String valor) {
        for (Status s : values()) {
            if (s.valor.equals(valor)) {
                return s;
            }
        }
        return null;
    }
}
