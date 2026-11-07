package br.com.gabriel.contatos;

import static org.junit.jupiter.api.Assertions.assertEquals;

import br.com.gabriel.contatos.pessoa.Normalizador;
import org.junit.jupiter.api.Test;

class NormalizadorTest {

    @Test
    void minusculoSemAcentosComEspacosColapsados() {
        assertEquals("ana souza", Normalizador.normalizar("  Ána   SOUZA "));
        assertEquals("joao conceicao", Normalizador.normalizar("João\tConceição"));
        assertEquals("ana souza", Normalizador.normalizar("ana souza"));
    }

    @Test
    void limparNomePreservaCaixaEAcentos() {
        assertEquals("Ána Souza", Normalizador.limparNome("  Ána    Souza  "));
    }

    @Test
    void acentoDecompostoEComposto() {
        assertEquals(Normalizador.normalizar("José"), Normalizador.normalizar("José"));
    }
}
