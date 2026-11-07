package br.com.gabriel.contatos.pessoa;

import java.text.Normalizer;
import java.util.Locale;
import java.util.regex.Pattern;

public final class Normalizador {

    private static final Pattern ESPACOS = Pattern.compile("[\\p{Z}\\s]+");
    private static final Pattern DIACRITICOS = Pattern.compile("\\p{M}+");

    private Normalizador() {
    }

    /** Remove espaços das pontas e colapsa os internos. */
    public static String limparNome(String nome) {
        return ESPACOS.matcher(nome).replaceAll(" ").strip();
    }

    /** Minúsculo, sem acentos e com espaços colapsados. Base da regra de unicidade. */
    public static String normalizar(String nome) {
        String decomposto = Normalizer.normalize(limparNome(nome), Normalizer.Form.NFD);
        String semAcentos = DIACRITICOS.matcher(decomposto).replaceAll("");
        return semAcentos.toLowerCase(Locale.ROOT);
    }
}
