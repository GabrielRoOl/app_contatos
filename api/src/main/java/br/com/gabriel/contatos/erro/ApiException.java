package br.com.gabriel.contatos.erro;

import java.util.Map;
import org.springframework.http.HttpStatus;

/** Erro de negócio que vira resposta no formato { codigo, mensagem, detalhes? }. */
public class ApiException extends RuntimeException {

    private final HttpStatus status;
    private final String codigo;
    private final Map<String, Object> detalhes;

    public ApiException(HttpStatus status, String codigo, String mensagem, Map<String, Object> detalhes) {
        super(mensagem);
        this.status = status;
        this.codigo = codigo;
        this.detalhes = detalhes;
    }

    public ApiException(HttpStatus status, String codigo, String mensagem) {
        this(status, codigo, mensagem, null);
    }

    public static ApiException validacao(String mensagem, Map<String, Object> detalhes) {
        return new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, "VALIDACAO", mensagem, detalhes);
    }

    public static ApiException validacao(String mensagem) {
        return validacao(mensagem, null);
    }

    public static ApiException naoEncontrado() {
        return new ApiException(HttpStatus.NOT_FOUND, "NAO_ENCONTRADO", "Registro não encontrado.");
    }

    public HttpStatus status() {
        return status;
    }

    public String codigo() {
        return codigo;
    }

    public Map<String, Object> detalhes() {
        return detalhes;
    }

    public ErroApi corpo() {
        return new ErroApi(codigo, getMessage(), detalhes);
    }
}
