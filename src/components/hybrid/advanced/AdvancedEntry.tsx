import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, Lock, SlidersHorizontal } from 'lucide-react';
import { getHybridAdvanced } from '../../../services/api';
import { CARD } from '../styles';
import { AdvancedDialog } from './AdvancedDialog';

/** Dòng "Cài đặt nâng cao" trong tab Cài đặt; ẩn khi STM32 chưa hỗ trợ. */
export function HybridAdvancedSection({ deviceId, online }: { deviceId: string; online: boolean }) {
  const { data } = useQuery({
    queryKey: ['hybrid-advanced', deviceId],
    queryFn: () => getHybridAdvanced(deviceId),
    staleTime: 30_000,
  });
  const [open, setOpen] = useState(false);
  if (data && !data.supported) return null; // STM32 cũ: không có menu nâng cao
  const local = data?.src === 'LOCAL';
  const disabled = local || !online;
  return (
    <section>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        className={`${CARD} w-full flex items-center gap-3 p-4 text-left transition-colors hover:bg-white disabled:opacity-60`}
      >
        <span className="p-2 rounded-lg bg-blue-50 text-blue-600 shrink-0">
          <SlidersHorizontal className="w-5 h-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 text-sm font-semibold text-gray-900">
            Cài đặt nâng cao <Lock className="w-3.5 h-3.5 text-gray-400" />
          </span>
          <span className="block text-xs text-gray-500 mt-0.5">
            {local
              ? 'Chọn "Cai dat tu = APP" trên máy để mở mục này'
              : !online
                ? 'Thiết bị đang mất kết nối'
                : 'Hệ pin, biến áp, ngưỡng pin, cửa sổ lưới, hiệu chỉnh'}
          </span>
        </span>
        <ChevronRight className="w-5 h-5 text-gray-400 shrink-0" />
      </button>
      {open && <AdvancedDialog deviceId={deviceId} onClose={() => setOpen(false)} />}
    </section>
  );
}
