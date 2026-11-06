import { useCallback, useRef, useState, type UIEvent } from 'react';

/** Recolhe ao descer (scrollTop > 80) e expande ao subir mais de 12 px ou perto do topo. */
export function useCollapseOnScroll() {
  const [collapsed, setCollapsed] = useState(false);
  const last = useRef(0);
  const onScroll = useCallback((e: UIEvent<HTMLElement>) => {
    const y = e.currentTarget.scrollTop;
    const prev = last.current;
    last.current = y;
    setCollapsed((c) => {
      if (!c && y > 80 && y - prev > 4) return true;
      if (c && (y < 12 || prev - y > 12)) return false;
      return c;
    });
  }, []);
  return { collapsed, setCollapsed, onScroll };
}
