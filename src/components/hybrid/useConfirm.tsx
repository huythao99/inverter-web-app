import { useState } from 'react';
import { ConfirmDialog } from './ui';
import type { ConfirmAsk } from './ui';

/** Hỏi lại kiểu await: const ok = await ask({...}); render {dialog}. */
export function useConfirm() {
  const [pending, setPending] = useState<(ConfirmAsk & { resolve: (ok: boolean) => void }) | null>(null);
  const ask = (q: ConfirmAsk) => new Promise<boolean>((resolve) => setPending({ ...q, resolve }));
  const dialog = pending ? (
    <ConfirmDialog
      ask={pending}
      onResult={(ok) => {
        pending.resolve(ok);
        setPending(null);
      }}
    />
  ) : null;
  return { ask, dialog };
}
