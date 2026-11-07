package br.com.gabriel.contatos.web;

import br.com.gabriel.contatos.erro.ApiException;
import br.com.gabriel.contatos.erro.ErroApi;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.NoHandlerFoundException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

@RestControllerAdvice
public class TratadorDeErros {

    private static final Logger log = LoggerFactory.getLogger(TratadorDeErros.class);

    /** Converte qualquer exceção do processamento no erro do contrato (também usado pelo /sync). */
    public static ApiException traduzir(Exception e) {
        if (e instanceof ApiException api) {
            return api;
        }
        if (e instanceof DataIntegrityViolationException) {
            // corrida contra o índice único do Postgres; o registro conflitante não é consultado aqui
            return new ApiException(HttpStatus.CONFLICT, "DUPLICADO",
                    "Essa pessoa já está na lista nesse dia e turno.");
        }
        log.error("Erro inesperado", e);
        return new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "ERRO_INTERNO", "Erro interno do servidor.");
    }

    @ExceptionHandler(ApiException.class)
    ResponseEntity<ErroApi> api(ApiException e) {
        return ResponseEntity.status(e.status()).body(e.corpo());
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    ResponseEntity<ErroApi> jsonInvalido(HttpMessageNotReadableException e) {
        return resposta(HttpStatus.UNPROCESSABLE_ENTITY, "VALIDACAO", "JSON inválido ou ausente.");
    }

    @ExceptionHandler({MissingServletRequestParameterException.class, MethodArgumentTypeMismatchException.class})
    ResponseEntity<ErroApi> parametro(Exception e) {
        return resposta(HttpStatus.UNPROCESSABLE_ENTITY, "VALIDACAO", "Parâmetro inválido.");
    }

    @ExceptionHandler({NoResourceFoundException.class, NoHandlerFoundException.class})
    ResponseEntity<ErroApi> semRota(Exception e) {
        return resposta(HttpStatus.NOT_FOUND, "NAO_ENCONTRADO", "Rota não encontrada.");
    }

    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    ResponseEntity<ErroApi> metodo(HttpRequestMethodNotSupportedException e) {
        return resposta(HttpStatus.METHOD_NOT_ALLOWED, "METODO_NAO_PERMITIDO", "Método não permitido.");
    }

    @ExceptionHandler(HttpMediaTypeNotSupportedException.class)
    ResponseEntity<ErroApi> midia(HttpMediaTypeNotSupportedException e) {
        return resposta(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "MIDIA_NAO_SUPORTADA", "Use Content-Type: application/json.");
    }

    @ExceptionHandler(Exception.class)
    ResponseEntity<ErroApi> inesperado(Exception e) {
        ApiException api = traduzir(e);
        return ResponseEntity.status(api.status()).body(api.corpo());
    }

    private static ResponseEntity<ErroApi> resposta(HttpStatus status, String codigo, String mensagem) {
        return ResponseEntity.status(status).body(new ErroApi(codigo, mensagem, (Map<String, Object>) null));
    }
}
