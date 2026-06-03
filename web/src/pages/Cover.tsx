// 封面页（docs/04 §4）：雾白底居中、呼吸光晕 + 鼠标视差、单一「进入」CTA。
// 点击进入：先淡出当前页（crossfade ≤300ms）再跳 /app；reduced-motion 直接跳。
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GlowOrb } from '@/components/GlowOrb';
import { useReducedMotion } from '@/hooks/useReducedMotion';

export function Cover() {
  const navigate = useNavigate();
  const reduced = useReducedMotion();
  const [leaving, setLeaving] = useState(false);

  function enter() {
    if (reduced) {
      navigate('/app');
      return;
    }
    setLeaving(true);
    window.setTimeout(() => navigate('/app'), 280); // 与 crossfade 时长一致
  }

  return (
    <main
      className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 text-center transition-opacity duration-[280ms] ease-out"
      style={{ opacity: leaving ? 0 : 1 }}
    >
      <GlowOrb />

      <h1 className="font-serif text-[clamp(2rem,6vw,3rem)] font-semibold tracking-tight text-foreground">
        AI 对话档案
      </h1>
      <p className="mt-4 max-w-md text-base text-muted-foreground sm:text-lg">
        把与 AI 的对话，安静地沉淀成笔记
      </p>

      <Button
        variant="accent"
        size="lg"
        onClick={enter}
        className="mt-10 gap-2 rounded-full px-10 shadow-sm"
      >
        进 入
        <ArrowRight className="size-4" />
      </Button>
    </main>
  );
}
