// 设置弹层（阶段 7）：导出目录 / AI 知识笔记目录 / AI provider·key(脱敏)·model·温度·超时·skill 路径。
// 读写已就绪的 GET/PUT /api/config（apiKey 传 ******** 表示不改）。
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { getConfig, putConfig, type ApiError } from '@/lib/api';
import type { AiProvider, AppConfig } from '@/lib/types';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Segmented } from '@/components/ui/segmented';
import { cn } from '@/lib/utils';

const PROVIDERS: { value: AiProvider; label: string }[] = [
  { value: 'openai-compatible', label: 'OpenAI 兼容' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'ollama', label: 'Ollama' },
];

export function SettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [cfg, setCfg] = useState<AppConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setLoading(true);
    getConfig()
      .then((c) => setCfg(c))
      .catch((e) => setError((e as ApiError).message))
      .finally(() => setLoading(false));
  }, [open]);

  const patch = useCallback((p: Partial<AppConfig>) => setCfg((c) => (c ? { ...c, ...p } : c)), []);
  const patchAi = useCallback(
    (p: Partial<AppConfig['ai']>) => setCfg((c) => (c ? { ...c, ai: { ...c.ai, ...p } } : c)),
    [],
  );

  async function save() {
    if (!cfg) return;
    setSaving(true);
    setError(null);
    try {
      await putConfig(cfg);
      onClose();
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="设置"
      footer={
        <>
          {error && <span className="mr-auto text-xs text-destructive">{error}</span>}
          <Button variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button variant="accent" onClick={save} disabled={!cfg || saving}>
            {saving ? '保存中…' : '保存'}
          </Button>
        </>
      }
    >
      {loading || !cfg ? (
        <p className="text-sm text-muted-foreground">加载中…</p>
      ) : (
        <div className="flex flex-col gap-5 text-sm">
          <section className="flex flex-col gap-3">
            <h3 className="font-medium text-foreground">目录</h3>
            <Field label="手动导出目录（对话存档）">
              <Input value={cfg.exportDir} onChange={(e) => patch({ exportDir: e.target.value })} />
            </Field>
            <Field label="AI 知识笔记目录">
              <Input value={cfg.aiNotesDir} onChange={(e) => patch({ aiNotesDir: e.target.value })} />
            </Field>
          </section>

          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-foreground">AI 整理</h3>
              <label className="flex items-center gap-2 text-muted-foreground">
                启用
                <Switch checked={cfg.ai.enabled} onCheckedChange={(v) => patchAi({ enabled: v })} />
              </label>
            </div>
            {cfg.ai.enabled && (
              <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                开启后，所选对话内容会发送到下方配置的模型 API。请确认服务与额度。
              </p>
            )}
            <Field label="Provider">
              <Segmented
                options={PROVIDERS}
                value={cfg.ai.provider}
                onChange={(v) => patchAi({ provider: v })}
                ariaLabel="provider"
              />
            </Field>
            <Field label="Base URL">
              <Input
                value={cfg.ai.baseUrl}
                onChange={(e) => patchAi({ baseUrl: e.target.value })}
                placeholder="https://api.deepseek.com/v1"
              />
            </Field>
            <Field label="API Key">
              <Input
                type="password"
                value={cfg.ai.apiKey}
                onChange={(e) => patchAi({ apiKey: e.target.value })}
                placeholder="留 ******** 表示不修改"
              />
            </Field>
            <Field label="模型">
              <Input
                value={cfg.ai.model}
                onChange={(e) => patchAi({ model: e.target.value })}
                placeholder="deepseek-chat"
              />
            </Field>
            <div className="flex gap-3">
              <Field label="温度" className="flex-1">
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  max="2"
                  value={String(cfg.ai.temperature)}
                  onChange={(e) => patchAi({ temperature: Number(e.target.value) })}
                />
              </Field>
              <Field label="超时(ms)" className="flex-1">
                <Input
                  type="number"
                  step="1000"
                  min="1000"
                  value={String(cfg.ai.timeoutMs)}
                  onChange={(e) => patchAi({ timeoutMs: Number(e.target.value) })}
                />
              </Field>
            </div>
            <Field label="Skill 路径（含 SKILL.md 的目录）">
              <Input value={cfg.ai.skillPath} onChange={(e) => patchAi({ skillPath: e.target.value })} />
            </Field>
          </section>
        </div>
      )}
    </Modal>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn('flex flex-col gap-1', className)}>
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
