package br.com.gabriel.contatos.sync;

import br.com.gabriel.contatos.config.AppProperties;
import br.com.gabriel.contatos.pessoa.PessoaService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/** Apaga de vez, uma vez por dia, os registros excluídos há mais de 30 dias. */
@Component
public class LimpezaExcluidos {

    private static final Logger log = LoggerFactory.getLogger(LimpezaExcluidos.class);

    private final PessoaService pessoas;
    private final AppProperties props;

    public LimpezaExcluidos(PessoaService pessoas, AppProperties props) {
        this.pessoas = pessoas;
        this.props = props;
    }

    @Scheduled(cron = "${app.limpeza-cron}", zone = "America/Sao_Paulo")
    public void executar() {
        try {
            int apagados = pessoas.limparExcluidos(props.retencaoExcluidosDias());
            log.info("Limpeza de excluídos: {} registro(s) apagado(s).", apagados);
        } catch (RuntimeException e) {
            log.error("Falha na limpeza de excluídos", e);
        }
    }
}
