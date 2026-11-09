package br.com.gabriel.contatos;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

import br.com.gabriel.contatos.config.AppProperties;
import org.junit.jupiter.api.Test;

class AppPropertiesTest {

    private static AppProperties com(String token) {
        return new AppProperties(token, "http://localhost:5173", 30, "0 30 3 * * *");
    }

    @Test
    void recusaTokenVazioOuCurto() {
        assertThrows(IllegalStateException.class, () -> com(""));
        assertThrows(IllegalStateException.class, () -> com(null));
        assertThrows(IllegalStateException.class, () -> com("curto"));
    }

    @Test
    void recusaOTokenDeExemploDoEnvExample() {
        assertThrows(IllegalStateException.class,
                () -> com("troque-por-um-token-longo-com-pelo-menos-32-caracteres"));
        assertThrows(IllegalStateException.class,
                () -> com("TROQUE-POR-UM-TOKEN-LONGO-COM-PELO-MENOS-32-CARACTERES"));
        assertThrows(IllegalStateException.class, () -> com("changeme-changeme-changeme-changeme-0000"));
    }

    @Test
    void aceitaTokenAleatorioLongo() {
        assertDoesNotThrow(() -> com("9f2c1e7a4b8d3f6051e2a7c9d4b8f3016a5e2c7d9b4f8a3e1c6d0b5a7f2e9c41"));
    }
}
