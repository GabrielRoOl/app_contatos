package br.com.gabriel.contatos.config;

import java.util.Arrays;
import java.util.List;
import java.util.Locale;
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
        if (pareceExemplo(token)) {
            throw new IllegalStateException("API_TOKEN parece o valor de exemplo do .env.example: gere um token aleatório.");
        }
        if (retencaoExcluidosDias < 1) {
            throw new IllegalStateException("app.retencao-excluidos-dias deve ser pelo menos 1.");
        }
    }

    /** Valores de exemplo/placeholder que alguém pode esquecer de trocar ao copiar o .env.example. */
    static boolean pareceExemplo(String token) {
        String t = token.toLowerCase(Locale.ROOT);
        return t.contains("troque") || t.contains("changeme") || t.contains("exemplo") || t.contains("seu-token");
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
