import { Link } from 'react-router-dom';
import { BatteryCharging, ChevronRight, Cpu, Eye, Wifi } from 'lucide-react';
import type { SharedDevice } from '../services/api';

interface SharedDeviceCardProps {
  device: SharedDevice;
  onLeave: (device: SharedDevice) => void;
  leaving?: boolean;
}

/** A device someone else shared read-only with the signed-in user. */
export function SharedDeviceCard({ device, onLeave, leaving }: SharedDeviceCardProps) {
  const isCharger = device.kind === 'charger';
  const Icon = isCharger ? BatteryCharging : Cpu;
  const to = `${isCharger ? '/chargers' : '/devices'}/${encodeURIComponent(
    device.deviceId
  )}?owner=${encodeURIComponent(device.ownerUid)}`;

  return (
    <div className="min-w-0 bg-white rounded-lg shadow-sm border border-amber-200 hover:shadow-md transition-all">
      <Link to={to} className="block p-4 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
            <div className={`shrink-0 p-3 rounded-lg ${isCharger ? 'bg-green-50' : 'bg-blue-50'}`}>
              <Icon className={`w-6 h-6 ${isCharger ? 'text-green-600' : 'text-blue-600'}`} />
            </div>
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 break-words line-clamp-2">
                {device.deviceName?.trim() || device.deviceId}
              </h3>
              <p className="text-sm text-gray-500 flex items-start mt-1 min-w-0">
                <Wifi className="w-4 h-4 mr-1 mt-0.5 shrink-0" />
                <span className="break-all">{device.deviceId}</span>
              </p>
              <span className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-xs font-medium">
                <Eye className="w-3 h-3" /> Chỉ xem
              </span>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-400 shrink-0 mt-1" />
        </div>
      </Link>
      <div className="px-4 sm:px-6 pb-4 -mt-1 flex justify-end">
        <button
          onClick={() => onLeave(device)}
          disabled={leaving}
          className="text-xs text-gray-500 hover:text-red-600 disabled:opacity-50"
        >
          Bỏ theo dõi
        </button>
      </div>
    </div>
  );
}
