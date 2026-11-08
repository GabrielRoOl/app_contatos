import { useCallback, useEffect, useRef, useState, type UIEvent } from 'react';

/** Altura do cabeçalho recolhido, usada até a primeira medição real. */
const RECOLHIDO_PADRAO = 160;
/** Folga extra para não encostar no limite. */
const FOLGA = 16;

/**
 * Recolhe ao descer (scrollTop > 80) e expande ao subir mais de 12 px ou perto do topo.
 *
 * Recolher encolhe o cabeçalho e a lista ganha altura, então o fim da rolagem sobe. Se o usuário
 * está perto do fim (lista curta, 6 ou 7 pessoas), o navegador joga o scrollTop para trás, o hook
 * lê isso como "subiu" e expande, e a rolagem seguinte recolhe de novo: fica indo e voltando.
 * Por isso só recolhe quando sobra rolagem suficiente para absorver a diferença de altura.
 */
export function useCollapseOnScroll() {
  const [collapsed, setCollapsed] = useState(false);
  const last = useRef(0);
  const headerRef = useRef<HTMLElement>(null);
  const alturaExpandido = useRef(0);
  const alturaRecolhido = useRef(RECOLHIDO_PADRAO);

  // mede o cabeçalho recolhido depois da animação (0,2 s) para a folga ficar exata
  useEffect(() => {
    if (!collapsed) return;
    const t = setTimeout(() => {
      if (headerRef.current) alturaRecolhido.current = headerRef.current.offsetHeight;
    }, 300);
    return () => clearTimeout(t);
  }, [collapsed]);

  const onScroll = useCallback((e: UIEvent<HTMLElement>) => {
    const el = e.currentTarget;
    const y = el.scrollTop;
    const prev = last.current;
    last.current = y;
    setCollapsed((c) => {
      if (!c && headerRef.current) alturaExpandido.current = headerRef.current.offsetHeight;
      if (!c && y > 80 && y - prev > 4) {
        const ganho = Math.max(alturaExpandido.current - alturaRecolhido.current, 0);
        const sobra = el.scrollHeight - el.clientHeight - y;
        return sobra >= ganho + FOLGA;
      }
      if (c && (y < 12 || prev - y > 12)) return false;
      return c;
    });
  }, []);
  return { collapsed, setCollapsed, onScroll, headerRef };
}
