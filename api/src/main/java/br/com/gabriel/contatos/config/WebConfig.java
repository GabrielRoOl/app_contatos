package br.com.gabriel.contatos.config;

import br.com.gabriel.contatos.seguranca.AuthFilter;
import com.fasterxml.jackson.core.JsonGenerator;
import com.fasterxml.jackson.databind.Module;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializerProvider;
import com.fasterxml.jackson.databind.module.SimpleModule;
import com.fasterxml.jackson.databind.ser.std.StdSerializer;
import java.io.IOException;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.List;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import org.springframework.web.filter.CorsFilter;

@Configuration
public class WebConfig {

    private static final DateTimeFormatter TIMESTAMP =
            DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'").withZone(ZoneOffset.UTC);

    /** Timestamps sempre em UTC, com formato fixo e milissegundos (ex.: 2026-11-03T12:10:00.000Z). */
    @Bean
    Module moduloTimestamps() {
        SimpleModule modulo = new SimpleModule("timestamps-fixos");
        modulo.addSerializer(Instant.class, new StdSerializer<>(Instant.class) {
            @Override
            public void serialize(Instant valor, JsonGenerator gen, SerializerProvider provider) throws IOException {
                gen.writeString(TIMESTAMP.format(valor.truncatedTo(ChronoUnit.MILLIS)));
            }
        });
        return modulo;
    }

    /** CORS vem antes da autenticação, para o 401 também sair com os cabeçalhos CORS. */
    @Bean
    FilterRegistrationBean<CorsFilter> filtroCors(AppProperties props) {
        CorsConfiguration cfg = new CorsConfiguration();
        cfg.setAllowedOrigins(props.origensCors());
        cfg.setAllowedMethods(List.of("GET", "POST", "PATCH", "DELETE", "OPTIONS"));
        cfg.setAllowedHeaders(List.of("Authorization", "Content-Type", "If-Match"));
        cfg.setMaxAge(3600L);
        var origem = new UrlBasedCorsConfigurationSource();
        origem.registerCorsConfiguration("/**", cfg);
        var registro = new FilterRegistrationBean<>(new CorsFilter(origem));
        registro.setOrder(Ordered.HIGHEST_PRECEDENCE + 10);
        return registro;
    }

    @Bean
    FilterRegistrationBean<AuthFilter> filtroAuth(AppProperties props, ObjectMapper mapper) {
        var registro = new FilterRegistrationBean<>(new AuthFilter(props.token(), mapper));
        registro.setOrder(Ordered.HIGHEST_PRECEDENCE + 20);
        return registro;
    }
}
