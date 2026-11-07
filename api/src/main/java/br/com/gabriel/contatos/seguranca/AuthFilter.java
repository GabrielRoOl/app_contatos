package br.com.gabriel.contatos.seguranca;

import br.com.gabriel.contatos.erro.ErroApi;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.web.filter.OncePerRequestFilter;

/** Exige Authorization: Bearer com o token do ambiente. Requisições OPTIONS passam sem token. */
public class AuthFilter extends OncePerRequestFilter {

    private static final String PREFIXO = "bearer ";

    private final byte[] tokenHash;
    private final ObjectMapper mapper;

    public AuthFilter(String token, ObjectMapper mapper) {
        this.tokenHash = sha256(token);
        this.mapper = mapper;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest req, HttpServletResponse res, FilterChain chain)
            throws ServletException, IOException {
        if ("OPTIONS".equalsIgnoreCase(req.getMethod()) || tokenValido(req.getHeader(HttpHeaders.AUTHORIZATION))) {
            chain.doFilter(req, res);
            return;
        }
        res.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        res.setHeader(HttpHeaders.WWW_AUTHENTICATE, "Bearer");
        res.setContentType(MediaType.APPLICATION_JSON_VALUE);
        res.setCharacterEncoding(StandardCharsets.UTF_8.name());
        mapper.writeValue(res.getOutputStream(),
                new ErroApi("NAO_AUTORIZADO", "Token ausente ou inválido.", null));
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
