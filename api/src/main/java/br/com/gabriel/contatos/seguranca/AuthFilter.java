package br.com.gabriel.contatos.seguranca;

import br.com.gabriel.contatos.erro.ErroApi;
import br.com.gabriel.contatos.web.SaudeController;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Map;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Exige Authorization: Bearer com o token do ambiente. Passam sem token: requisições OPTIONS (CORS)
 * e a verificação de saúde (GET /api/v1/saude).
 *
 * <p>Depois de vários tokens errados vindos do mesmo cliente, responde 429 a esse cliente (mesmo com o
 * token certo) até o bloqueio acabar. O cliente é o IP lido do cabeçalho configurado (o proxy precisa
 * sobrescrevê-lo, senão dá para forjar); sem cabeçalho configurado, vale o IP da conexão.
 */
public class AuthFilter extends OncePerRequestFilter {

    private static final String PREFIXO = "bearer ";
    private static final int TAMANHO_MAXIMO_DA_CHAVE = 64;

    private final byte[] tokenHash;
    private final ObjectMapper mapper;
    private final LimitadorDeTentativas limitador;
    private final String cabecalhoIp;

    public AuthFilter(String token, ObjectMapper mapper, LimitadorDeTentativas limitador, String cabecalhoIp) {
        this.tokenHash = sha256(token);
        this.mapper = mapper;
        this.limitador = limitador;
        this.cabecalhoIp = cabecalhoIp == null ? "" : cabecalhoIp.strip();
    }

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {
        if ("OPTIONS".equalsIgnoreCase(req.getMethod()) || rotaDeSaude(req)) {
            chain.doFilter(req, res);
            return;
        }
        String cliente = chaveDoCliente(req);
        long espera = limitador.segundosDeBloqueio(cliente);
        if (espera > 0) {
            responderBloqueado(res, espera);
            return;
        }
        String cabecalho = req.getHeader(HttpHeaders.AUTHORIZATION);
        if (tokenValido(cabecalho)) {
            limitador.registrarSucesso(cliente);
            chain.doFilter(req, res);
            return;
        }
        if (cabecalho != null && !cabecalho.isBlank()) {
            limitador.registrarFalha(cliente);
        }
        res.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        res.setHeader(HttpHeaders.WWW_AUTHENTICATE, "Bearer");
        res.setContentType(MediaType.APPLICATION_JSON_VALUE);
        res.setCharacterEncoding(StandardCharsets.UTF_8.name());
        mapper.writeValue(res.getOutputStream(),
                new ErroApi("NAO_AUTORIZADO", "Token ausente ou inválido.", null));
    }

    private void responderBloqueado(HttpServletResponse res, long segundos) throws IOException {
        res.setStatus(429);
        res.setHeader(HttpHeaders.RETRY_AFTER, String.valueOf(segundos));
        res.setContentType(MediaType.APPLICATION_JSON_VALUE);
        res.setCharacterEncoding(StandardCharsets.UTF_8.name());
        mapper.writeValue(res.getOutputStream(), new ErroApi("MUITAS_TENTATIVAS",
                "Muitas tentativas com token inválido. Tente de novo em " + ((segundos + 59) / 60) + " min.",
                Map.of("tentar_novamente_em_segundos", segundos)));
    }

    /** IP do cabeçalho do proxy (último valor, o que o proxy mais próximo acrescentou) ou o da conexão. */
    private String chaveDoCliente(HttpServletRequest req) {
        String valor = cabecalhoIp.isEmpty() ? null : req.getHeader(cabecalhoIp);
        if (valor != null && !valor.isBlank()) {
            String ultimo = valor.substring(valor.lastIndexOf(',') + 1).strip();
            if (!ultimo.isEmpty()) {
                return ultimo.length() > TAMANHO_MAXIMO_DA_CHAVE ? ultimo.substring(0, TAMANHO_MAXIMO_DA_CHAVE) : ultimo;
            }
        }
        return req.getRemoteAddr();
    }

    /** Única rota pública além do OPTIONS: GET (ou HEAD) exatamente em /api/v1/saude. */
    private static boolean rotaDeSaude(HttpServletRequest req) {
        String metodo = req.getMethod();
        return ("GET".equalsIgnoreCase(metodo) || "HEAD".equalsIgnoreCase(metodo))
                && SaudeController.CAMINHO.equals(req.getRequestURI());
    }

    /** Compara os hashes dos dois tokens em tempo constante (sem vazar o tamanho). */
    private boolean tokenValido(String cabecalho) {
        if (cabecalho == null || cabecalho.length() <= PREFIXO.length()
                || !cabecalho.regionMatches(true, 0, PREFIXO, 0, PREFIXO.length())) {
            return false;
        }
        String enviado = cabecalho.substring(PREFIXO.length()).strip();
        return MessageDigest.isEqual(tokenHash, sha256(enviado));
    }

    private static byte[] sha256(String valor) {
        try {
            return MessageDigest.getInstance("SHA-256").digest(valor.getBytes(StandardCharsets.UTF_8));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
