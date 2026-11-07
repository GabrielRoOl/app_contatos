package br.com.gabriel.contatos.config;

import java.util.Arrays;
import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Configuração da aplicação. Falha na partida se o token estiver vazio ou curto.
 */
@ConfigurationProperties("app")
public record AppProperties(String token, String corsOrigin, int retencaoExcluidosDias, String limpezaCron) {

    public static final int TAMANHO_MINIMO_TOKEN = 32;

    public AppProperties {
        if (token == null || token.isBlank()) {
            throw new IllegalStateException("API_TOKEN não configurado.");
        }
        if (token.length() < TAMANHO_MINIMO_TOKEN) {
            throw new IllegalStateException("API_TOKEN curto demais: use pelo menos " + TAMANHO_MINIMO_TOKEN + " caracteres.");
        }
        if (retencaoExcluidosDias < 1) {
            throw new IllegalStateException("app.retencao-excluidos-dias deve ser pelo menos 1.");
        }
    }

    public List<String> origensCors() {
        if (corsOrigin == null || corsOrigin.isBlank()) {
            return List.of();
        }
        return Arrays.stream(corsOrigin.split(",")).map(String::trim).filter(s -> !s.isEmpty()).toList();
    }

    @Override
    public String toString() {
        return "AppProperties[corsOrigin=" + corsOrigin + ", retencaoExcluidosDias=" + retencaoExcluidosDias + "]";
    }
}
