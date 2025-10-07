// hooks/useContainerSize.ts
import {useEffect, useRef, useState} from "react";

export function useContainerSize() {
  const ref = useRef<HTMLDivElement|null>(null);
  const [w, setW] = useState(0);
  const [h, setH] = useState(0);

  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    const ro = new ResizeObserver(([entry]) => {
      const cr = entry.contentRect;
      setW(Math.floor(cr.width));
      setH(Math.floor(cr.height));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return {ref, w, h};
}
