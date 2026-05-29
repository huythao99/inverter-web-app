import { Link } from 'react-router-dom';
import { Cpu, ChevronRight, Wifi } from 'lucide-react';
import type { Device } from '../types';

interface DeviceCardProps {
  device: Device;
}

export function DeviceCard({ device }: DeviceCardProps) {
  return (
    <Link
      to={`/devices/${device.deviceId}`}
      className="block bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md hover:border-blue-300 transition-all"
    >
      <div className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-blue-50 rounded-lg">
              <Cpu className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                {device.deviceName || device.deviceId}
              </h3>
              <p className="text-sm text-gray-500 flex items-center mt-1">
                <Wifi className="w-4 h-4 mr-1" />
                {device.deviceId}
              </p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-400" />
        </div>

        <div className="mt-4 pt-4 border-t border-gray-100">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Firmware</span>
            <span className="font-medium text-gray-900">
              {device.firmwareVersion || 'Unknown'}
            </span>
          </div>
          {device.updatedAt && (
            <div className="flex items-center justify-between text-sm mt-2">
              <span className="text-gray-500">Last updated</span>
              <span className="text-gray-700">
                {new Date(device.updatedAt).toLocaleString()}
              </span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
