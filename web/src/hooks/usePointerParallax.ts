// 鼠标视差：监听 mousemove，rAF 节流，输出极小偏移量 {x,y}（像素，范围 ±max）。
// reduced-motion 时恒为 {0,0}。只供组件写进 transform: translate（不动布局）。
import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from './useReducedMotion';

export interface ParallaxOffset {
  x: number;
  y: number;
}

/**
 * @param max 最大偏移像素（docs/04 §3：6–12px）。
 * 实现：把鼠标相对视口中心的位置归一化到 [-1,1]，乘以 max；rAF 合并多次 mousemove。
 */
export function usePointerParallax(max = 10): ParallaxOffset {
  const reduced = useReducedMotion();
  const [offset, setOffset] = useState<ParallaxOffset>({ x: 0, y: 0 });
  const frame = useRef<number | null>(null);
  const pending = useRef<ParallaxOffset>({ x: 0, y: 0 });

  useEffect(() => {
    if (reduced) {
      setOffset({ x: 0, y: 0 });
      return;
    }
    const onMove = (e: MouseEvent) => {
      const nx = (e.clientX / window.innerWidth) * 2 - 1; // [-1,1]
      const ny = (e.clientY / window.innerHeight) * 2 - 1;
      pending.current = { x: nx * max, y: ny * max };
      if (frame.current == null) {
        frame.current = requestAnimationFrame(() => {
          frame.current = null;
          setOffset(pending.current);
        });
      }
    };
    window.addEventListener('mousemove', onMove);
    return () => {
      window.removeEventListener('mousemove', onMove);
      if (frame.current != null) cancelAnimationFrame(frame.current);
      frame.current = null;
    };
  }, [reduced, max]);

  return offset;
}
