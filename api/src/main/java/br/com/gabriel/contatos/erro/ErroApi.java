package br.com.gabriel.contatos.erro;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.Map;

/** Corpo de erro do contrato: { codigo, mensagem, detalhes? }. */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ErroApi(String codigo, String mensagem, Map<String, Object> detalhes) {
}
