import { AlertTriangle } from 'lucide-react';
import type { HybridNak } from '../../types';
import { FIELDS, NAK_LABEL } from '../../services/hinvlf';

/** Máy từ chối lệnh / cài đặt ($NAK): lý do + lúc nào. */
export function NakNotice({ nak }: { nak: HybridNak }) {
  const field = FIELDS.find((f) => f.key === nak.key);
  return (
    <div className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
      <AlertTriangle className="w-4 h-4 shrink-0" />
      <div>
        <p>
          Máy từ chối {nak.of.startsWith('CMD') ? 'lệnh' : 'cài đặt'}
          {field ? ` (${field.label})` : nak.key ? ` (${nak.key})` : ''}:{' '}
          {NAK_LABEL[nak.err] ?? nak.err}
        </p>
        <p className="mt-0.5 text-amber-600">
          {new Date(nak.at).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
        </p>
      </div>
    </div>
  );
}
