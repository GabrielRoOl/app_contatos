package br.com.gabriel.contatos.seguranca;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Iterator;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Bloqueia um cliente (chave, normalmente o IP) depois de {@code maximo} tokens errados dentro da janela:
 * por {@code bloqueio} ele não passa nem com o token certo. Fica só em memória, então reiniciar a API
 * libera todo mundo (aceitável para um único usuário). A janela de contagem tem a mesma duração do bloqueio.
 */
public class LimitadorDeTentativas {

    /** Teto de chaves guardadas, para um atacante trocando de IP não encher a memória. */
    private static final int TETO_DE_CHAVES = 10_000;

    private final int maximo;
    private final Duration bloqueio;
    private final Clock relogio;
    private final Map<String, Registro> registros = new ConcurrentHashMap<>();

    public LimitadorDeTentativas(int maximo, Duration bloqueio, Clock relogio) {
        if (maximo < 1 || bloqueio.isNegative() || bloqueio.isZero()) {
            throw new IllegalArgumentException("Limite de tentativas inválido.");
        }
        this.maximo = maximo;
        this.bloqueio = bloqueio;
        this.relogio = relogio;
    }

    /** Segundos que faltam para o bloqueio acabar, ou 0 se a chave não está bloqueada. */
    public long segundosDeBloqueio(String chave) {
        Registro r = registros.get(chave);
        if (r == null) {
            return 0;
        }
        Instant agora = relogio.instant();
        synchronized (r) {
            if (r.bloqueadoAte != null && agora.isBefore(r.bloqueadoAte)) {
                return Math.max(1, (Duration.between(agora, r.bloqueadoAte).toMillis() + 999) / 1000);
            }
        }
        return 0;
    }

    /** Registra um token errado; ao chegar no máximo, inicia o bloqueio. */
    public void registrarFalha(String chave) {
        Instant agora = relogio.instant();
        if (registros.size() >= TETO_DE_CHAVES) {
            limparExpirados(agora);
        }
        Registro r = registros.computeIfAbsent(chave, k -> new Registro());
        synchronized (r) {
            if (r.expiraEm != null && !agora.isBefore(r.expiraEm)) {
                r.falhas = 0;
                r.bloqueadoAte = null;
            }
            if (r.falhas == 0) {
                r.expiraEm = agora.plus(bloqueio);
            }
            r.falhas++;
            if (r.falhas >= maximo && r.bloqueadoAte == null) {
                r.bloqueadoAte = agora.plus(bloqueio);
                r.expiraEm = r.bloqueadoAte;
            }
        }
    }

    /** Token certo fora de bloqueio zera a contagem de erros da chave. */
    public void registrarSucesso(String chave) {
        registros.remove(chave);
    }

    private void limparExpirados(Instant agora) {
        for (Iterator<Map.Entry<String, Registro>> it = registros.entrySet().iterator(); it.hasNext(); ) {
            Registro r = it.next().getValue();
            synchronized (r) {
                if (r.expiraEm == null || !agora.isBefore(r.expiraEm)) {
                    it.remove();
                }
            }
        }
    }

    private static final class Registro {
        int falhas;
        Instant expiraEm;
        Instant bloqueadoAte;
    }
}
