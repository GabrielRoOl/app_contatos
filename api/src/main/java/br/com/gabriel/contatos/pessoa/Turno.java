package br.com.gabriel.contatos.pessoa;

import com.fasterxml.jackson.annotation.JsonValue;

public enum Turno {
    MANHA("manha", "de manhã"),
    TARDE("tarde", "à tarde");

    private final String valor;
    private final String descricao;

    Turno(String valor, String descricao) {
        this.valor = valor;
        this.descricao = descricao;
    }

    @JsonValue
    public String valor() {
        return valor;
    }

    public String descricao() {
        return descricao;
    }

    public static Turno de(String valor) {
        for (Turno t : values()) {
            if (t.valor.equals(valor)) {
                return t;
            }
        }
        return null;
    }
}
