import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import { LoadingSpinner } from './LoadingSpinner';

/**
 * Nút thùng rác + hộp xác nhận xoá thiết bị (bộ sạc / hybrid). Xoá xong:
 * làm mới danh sách `listQueryKey` và về Bảng điều khiển. Máy bị ngắt khỏi
 * broker (tài khoản MQTT bị thu hồi), muốn dùng lại phải thêm lại bằng app.
 */
export function DeleteDeviceButton({
  deviceName,
  listQueryKey,
  onDelete,
}: {
  deviceName: string;
  listQueryKey: string;
  onDelete: () => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const del = useMutation({
    mutationFn: onDelete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [listQueryKey] });
      navigate('/');
    },
  });

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="p-2 hover:bg-red-100 rounded-lg transition-colors text-red-600 flex-shrink-0"
        title="Xóa thiết bị"
        aria-label="Xóa thiết bị"
      >
        <Trash2 className="w-5 h-5" />
      </button>
      {open && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-sm mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Xóa thiết bị?</h3>
            <p className="text-gray-600 mb-6">
              Bạn có chắc chắn muốn xóa thiết bị "{deviceName}"? Thiết bị sẽ bị ngắt kết nối,
              muốn dùng lại phải thêm lại bằng ứng dụng. Hành động này không thể hoàn tác.
            </p>
            {del.isError && (
              <p className="mb-4 text-sm text-red-600">Không xóa được thiết bị, hãy thử lại.</p>
            )}
            <div className="flex space-x-3">
              <button
                onClick={() => setOpen(false)}
                disabled={del.isPending}
                className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={() => del.mutate()}
                disabled={del.isPending}
                className="flex-1 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center"
              >
                {del.isPending ? <LoadingSpinner size="sm" className="text-white" /> : 'Xóa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
