package br.com.gabriel.contatos.web;

import br.com.gabriel.contatos.erro.ApiException;
import br.com.gabriel.contatos.pessoa.EntradaPessoa;
import br.com.gabriel.contatos.pessoa.Pessoa;
import br.com.gabriel.contatos.pessoa.PessoaRepository.FiltroStatus;
import br.com.gabriel.contatos.pessoa.PessoaService;
import com.fasterxml.jackson.databind.JsonNode;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Pattern;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/pessoas")
public class PessoaController {

    private static final Pattern DATA_RE = Pattern.compile("^\\d{4}-\\d{2}-\\d{2}$");
    private static final Pattern UUID_RE =
            Pattern.compile("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$");

    private final PessoaService service;

    public PessoaController(PessoaService service) {
        this.service = service;
    }

    @GetMapping
    public List<Pessoa> listar(@RequestParam(required = false) String de,
                               @RequestParam(required = false) String ate,
                               @RequestParam(required = false) String status) {
        FiltroStatus filtro = null;
        if (status != null) {
            filtro = FiltroStatus.de(status);
            if (filtro == null) {
                throw ApiException.validacao("Dados inválidos.",
                        Map.of("campos", Map.of("status", "Use ok, nao ou pendente.")));
            }
        }
        return service.listar(data("de", de), data("ate", ate), filtro);
    }

    @PostMapping
    public ResponseEntity<Pessoa> criar(@RequestBody JsonNode corpo) {
        var resultado = service.criar(EntradaPessoa.criar(corpo, null));
        return ResponseEntity.status(resultado.criada() ? HttpStatus.CREATED : HttpStatus.OK).body(resultado.pessoa());
    }

    @PatchMapping("/{id}")
    public Pessoa alterar(@PathVariable String id,
                          @RequestHeader(value = "If-Match", required = false) String ifMatch,
                          @RequestBody JsonNode corpo) {
        UUID uuid = idDoCaminho(id);
        return service.alterar(uuid, EntradaPessoa.alterar(corpo, EntradaPessoa.versaoDoCabecalho(ifMatch)));
    }

    @DeleteMapping("/{id}")
    public Pessoa excluir(@PathVariable String id) {
        return service.excluir(idDoCaminho(id));
    }

    @PostMapping("/{id}/restaurar")
    public Pessoa restaurar(@PathVariable String id) {
        return service.restaurar(idDoCaminho(id));
    }

    /** Id que não é UUID não pode existir: 404. */
    private static UUID idDoCaminho(String id) {
        if (!UUID_RE.matcher(id).matches()) {
            throw ApiException.naoEncontrado();
        }
        return UUID.fromString(id);
    }

    private static LocalDate data(String campo, String valor) {
        if (valor == null) {
            return null;
        }
        try {
            if (DATA_RE.matcher(valor).matches()) {
                return LocalDate.parse(valor);
            }
        } catch (DateTimeParseException ignorado) {
            // cai no erro abaixo
        }
        throw ApiException.validacao("Dados inválidos.", Map.of("campos", Map.of(campo, "Use o formato AAAA-MM-DD.")));
    }
}
