package br.com.gabriel.contatos.pessoa;

import br.com.gabriel.contatos.erro.ApiException;
import com.fasterxml.jackson.databind.JsonNode;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Pattern;

/** Validação e conversão do JSON de entrada (criar e alterar). */
public final class EntradaPessoa {

    public static final int NOME_MAXIMO = 80;
    private static final Pattern UUID_RE =
            Pattern.compile("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$");
    private static final Pattern DATA_RE = Pattern.compile("^\\d{4}-\\d{2}-\\d{2}$");

    private EntradaPessoa() {
    }

    public record NovaPessoa(UUID id, String nome, LocalDate data, Turno turno, Status status) {
    }

    /**
     * Campos ausentes ficam null. Para o status, {@code statusPresente} distingue
     * ausente de null explícito (que volta para pendente).
     */
    public record Alteracao(String nome, LocalDate data, Turno turno, boolean statusPresente, Status status,
                            Integer versao) {
    }

    public static UUID id(JsonNode no) {
        UUID id = lerId(no);
        if (id == null) {
            throw ApiException.validacao("Dados inválidos.", Map.of("campos", Map.of("id", "Informe um UUID válido.")));
        }
        return id;
    }

    /** {@code idPadrao} é usado quando o id vem fora do corpo (ex.: operação do /sync). */
    public static NovaPessoa criar(JsonNode corpo, UUID idPadrao) {
        Map<String, Object> erros = new LinkedHashMap<>();
        if (corpo == null || !corpo.isObject()) {
            throw ApiException.validacao("O corpo deve ser um objeto JSON.");
        }
        UUID id = idPadrao;
        if (id == null) {
            id = lerId(corpo.get("id"));
            if (id == null) {
                erros.put("id", "Informe um UUID válido.");
            }
        }
        String nome = lerNome(corpo.get("nome"), true, erros);
        LocalDate data = lerData(corpo.get("data"), true, erros);
        Turno turno = lerTurno(corpo.get("turno"), true, erros);
        Status status = lerStatus(corpo.get("status"), erros);
        lancarSeHouver(erros);
        return new NovaPessoa(id, nome, data, turno, status);
    }

    /** {@code versaoExterna} vem do If-Match (ou do campo da operação); se o corpo também trouxer, devem coincidir. */
    public static Alteracao alterar(JsonNode corpo, Integer versaoExterna) {
        Map<String, Object> erros = new LinkedHashMap<>();
        if (corpo == null || !corpo.isObject()) {
            throw ApiException.validacao("O corpo deve ser um objeto JSON.");
        }
        String nome = lerNome(corpo.get("nome"), false, erros);
        LocalDate data = lerData(corpo.get("data"), false, erros);
        Turno turno = lerTurno(corpo.get("turno"), false, erros);
        boolean statusPresente = corpo.has("status");
        Status status = statusPresente ? lerStatus(corpo.get("status"), erros) : null;
        Integer versao = versaoExterna;
        if (corpo.has("versao")) {
            Integer doCorpo = lerVersao(corpo.get("versao"));
            if (doCorpo == null) {
                erros.put("versao", "Informe um inteiro maior ou igual a 1.");
            } else if (versaoExterna != null && !versaoExterna.equals(doCorpo)) {
                erros.put("versao", "A versão do corpo difere da versão informada no cabeçalho.");
            } else {
                versao = doCorpo;
            }
        }
        lancarSeHouver(erros);
        return new Alteracao(nome, data, turno, statusPresente, status, versao);
    }

    /** Interpreta o valor de If-Match: 3, "3" ou W/"3". */
    public static Integer versaoDoCabecalho(String ifMatch) {
        if (ifMatch == null || ifMatch.isBlank()) {
            return null;
        }
        String v = ifMatch.strip();
        if (v.startsWith("W/")) {
            v = v.substring(2);
        }
        if (v.length() >= 2 && v.startsWith("\"") && v.endsWith("\"")) {
            v = v.substring(1, v.length() - 1);
        }
        try {
            int n = Integer.parseInt(v);
            if (n >= 1) {
                return n;
            }
        } catch (NumberFormatException ignorado) {
            // cai no erro abaixo
        }
        throw ApiException.validacao("Dados inválidos.",
                Map.of("campos", Map.of("versao", "If-Match deve conter um inteiro maior ou igual a 1.")));
    }

    public static Integer versao(JsonNode no) {
        if (no == null || no.isNull()) {
            return null;
        }
        Integer v = lerVersao(no);
        if (v == null) {
            throw ApiException.validacao("Dados inválidos.",
                    Map.of("campos", Map.of("versao", "Informe um inteiro maior ou igual a 1.")));
        }
        return v;
    }

    private static void lancarSeHouver(Map<String, Object> erros) {
        if (!erros.isEmpty()) {
            throw ApiException.validacao("Dados inválidos.", Map.of("campos", erros));
        }
    }

    private static UUID lerId(JsonNode no) {
        if (no == null || !no.isTextual() || !UUID_RE.matcher(no.textValue()).matches()) {
            return null;
        }
        return UUID.fromString(no.textValue().toLowerCase(Locale.ROOT));
    }

    private static String lerNome(JsonNode no, boolean obrigatorio, Map<String, Object> erros) {
        if (no == null) {
            if (obrigatorio) {
                erros.put("nome", "Informe o nome.");
            }
            return null;
        }
        if (!no.isTextual()) {
            erros.put("nome", "O nome deve ser um texto.");
            return null;
        }
        String nome = Normalizador.limparNome(no.textValue());
        if (nome.isEmpty()) {
            erros.put("nome", "Informe o nome.");
            return null;
        }
        if (nome.codePointCount(0, nome.length()) > NOME_MAXIMO) {
            erros.put("nome", "O nome deve ter no máximo " + NOME_MAXIMO + " caracteres.");
            return null;
        }
        return nome;
    }

    private static LocalDate lerData(JsonNode no, boolean obrigatorio, Map<String, Object> erros) {
        if (no == null) {
            if (obrigatorio) {
                erros.put("data", "Informe a data.");
            }
            return null;
        }
        if (!no.isTextual() || !DATA_RE.matcher(no.textValue()).matches()) {
            erros.put("data", "Use o formato AAAA-MM-DD.");
            return null;
        }
        try {
            return LocalDate.parse(no.textValue());
        } catch (DateTimeParseException e) {
            erros.put("data", "Data inexistente.");
            return null;
        }
    }

    private static Turno lerTurno(JsonNode no, boolean obrigatorio, Map<String, Object> erros) {
        if (no == null) {
            if (obrigatorio) {
                erros.put("turno", "Informe o turno (manha ou tarde).");
            }
            return null;
        }
        Turno turno = no.isTextual() ? Turno.de(no.textValue()) : null;
        if (turno == null) {
            erros.put("turno", "Use manha ou tarde.");
        }
        return turno;
    }

    /** null, ausente ou JSON null viram pendente; o chamador distingue ausente quando precisa. */
    private static Status lerStatus(JsonNode no, Map<String, Object> erros) {
        if (no == null || no.isNull()) {
            return null;
        }
        Status status = no.isTextual() ? Status.de(no.textValue()) : null;
        if (status == null) {
            erros.put("status", "Use ok, nao ou null.");
        }
        return status;
    }

    private static Integer lerVersao(JsonNode no) {
        if (no != null && no.isIntegralNumber() && no.canConvertToInt() && no.intValue() >= 1) {
            return no.intValue();
        }
        return null;
    }
}
