// 雾青径向渐变光晕：缓慢呼吸（CSS keyframes）+ 鼠标极慢视差。
// 纯装饰：aria-hidden；只动 transform/opacity；reduced-motion 由 hook + 全局 CSS 双保险。
import { usePointerParallax } from '@/hooks/usePointerParallax';

export function GlowOrb() {
  const { x, y } = usePointerParallax(12);

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[clamp(320px,46vw,640px)] w-[clamp(320px,46vw,640px)] -translate-x-1/2 -translate-y-1/2"
      style={{
        // 外层负责视差位移 + 缓动跟随；内层负责呼吸缩放，互不打架。
        transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
        transition: 'transform 600ms cubic-bezier(0.22, 1, 0.36, 1)',
      }}
    >
      <div
        className="h-full w-full animate-[breathe_6s_ease-in-out_infinite] rounded-full"
        style={{
          background:
            'radial-gradient(circle at center, rgba(8,145,178,0.30) 0%, rgba(8,145,178,0.14) 38%, rgba(8,145,178,0) 70%)',
          filter: 'blur(8px)',
        }}
      />
      {/* 呼吸关键帧（局部声明，避免污染全局样式表） */}
      <style>{`
        @keyframes breathe {
          0%, 100% { transform: scale(1); opacity: 0.85; }
          50%      { transform: scale(1.08); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
