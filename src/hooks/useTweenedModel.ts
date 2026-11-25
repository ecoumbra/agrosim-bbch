import { useEffect, useRef, useState } from 'react';
import { lerpModel, plantModel, type PlantModel } from '../engine/plantModel';

/** Плавно «довирощує» рослину до моделі нового коду BBCH. */
export function useTweenedModel(code: number, ms = 450): PlantModel {
  const [model, setModel] = useState<PlantModel>(() => plantModel(code));
  const cur = useRef(model);
  cur.current = model;
  useEffect(() => {
    const from = cur.current, to = plantModel(code);
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / ms), e = t * t * (3 - 2 * t);
      setModel(lerpModel(from, to, e));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [code, ms]);
  return model;
}
