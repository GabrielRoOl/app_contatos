package br.com.gabriel.contatos;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import br.com.gabriel.contatos.seguranca.LimitadorDeTentativas;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class LimitadorDeTentativasTest {

    /** Relógio que anda só quando o teste manda. */
    static class RelogioManual extends Clock {
        Instant agora = Instant.parse("2026-11-08T12:00:00Z");

        void avancar(Duration d) {
            agora = agora.plus(d);
        }

        @Override
        public java.time.ZoneId getZone() {
            return ZoneOffset.UTC;
        }

        @Override
        public Clock withZone(java.time.ZoneId zone) {
            return this;
        }

        @Override
        public Instant instant() {
            return agora;
        }
    }

    RelogioManual relogio;
    LimitadorDeTentativas limitador;

    @BeforeEach
    void criar() {
        relogio = new RelogioManual();
        limitador = new LimitadorDeTentativas(5, Duration.ofMinutes(10), relogio);
    }

    private void falhar(String chave, int vezes) {
        for (int i = 0; i < vezes; i++) {
            limitador.registrarFalha(chave);
        }
    }

    @Test
    void quatroErrosNaoBloqueiamEOQuintoBloqueiaPorDezMinutos() {
        falhar("a", 4);
        assertEquals(0, limitador.segundosDeBloqueio("a"));
        falhar("a", 1);
        assertEquals(600, limitador.segundosDeBloqueio("a"));

        relogio.avancar(Duration.ofMinutes(9));
        assertEquals(60, limitador.segundosDeBloqueio("a"));
        relogio.avancar(Duration.ofMinutes(1));
        assertEquals(0, limitador.segundosDeBloqueio("a"));
    }

    @Test
    void errosDuranteOBloqueioNaoEstendemOPrazo() {
        falhar("a", 5);
        relogio.avancar(Duration.ofMinutes(5));
        falhar("a", 3);
        assertEquals(300, limitador.segundosDeBloqueio("a"));
    }

    @Test
    void depoisDoBloqueioVoltaAContarDoZero() {
        falhar("a", 5);
        relogio.avancar(Duration.ofMinutes(10));
        falhar("a", 4);
        assertEquals(0, limitador.segundosDeBloqueio("a"));
        falhar("a", 1);
        assertTrue(limitador.segundosDeBloqueio("a") > 0);
    }

    @Test
    void errosAntigosForaDaJanelaNaoSomam() {
        falhar("a", 4);
        relogio.avancar(Duration.ofMinutes(10));
        falhar("a", 1);
        assertEquals(0, limitador.segundosDeBloqueio("a"));
    }

    @Test
    void sucessoZeraAContagem() {
        falhar("a", 4);
        limitador.registrarSucesso("a");
        falhar("a", 4);
        assertEquals(0, limitador.segundosDeBloqueio("a"));
    }

    @Test
    void chavesSaoIndependentes() {
        falhar("a", 5);
        assertTrue(limitador.segundosDeBloqueio("a") > 0);
        assertEquals(0, limitador.segundosDeBloqueio("b"));
    }

    @Test
    void recusaConfiguracaoInvalida() {
        assertThrows(IllegalArgumentException.class, () -> new LimitadorDeTentativas(0, Duration.ofMinutes(1), relogio));
        assertThrows(IllegalArgumentException.class, () -> new LimitadorDeTentativas(5, Duration.ZERO, relogio));
    }
}
