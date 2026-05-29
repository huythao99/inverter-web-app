import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Copy,
  Check,
  Wifi,
  Settings,
  CheckCircle,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
} from 'lucide-react';
import { Layout } from '../components/Layout';
import { useAuth } from '../contexts/AuthContext';

type SetupStep = 1 | 2 | 3;

export function AddDevice() {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);
  const [currentStep, setCurrentStep] = useState<SetupStep>(1);
  const [wifiSsid, setWifiSsid] = useState('');
  const [wifiPassword, setWifiPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const userId = user?.uid || '';

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(userId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const validateWifiCredentials = (): string | null => {
    // SSID validation
    if (!wifiSsid.trim()) {
      return 'Vui lòng nhập tên WiFi';
    }
    if (wifiSsid.length > 32) {
      return 'Tên WiFi không được vượt quá 32 ký tự';
    }
    if (/[^\x20-\x7E]/.test(wifiSsid)) {
      return 'Tên WiFi chứa ký tự không hợp lệ';
    }

    // Password validation
    if (!wifiPassword) {
      return 'Vui lòng nhập mật khẩu WiFi';
    }
    if (wifiPassword.length < 8) {
      return 'Mật khẩu WiFi phải có ít nhất 8 ký tự';
    }
    if (wifiPassword.length > 63) {
      return 'Mật khẩu WiFi không được vượt quá 63 ký tự';
    }

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitStatus('idle');
    setErrorMessage('');

    // Validate WiFi credentials before submitting
    const validationError = validateWifiCredentials();
    if (validationError) {
      setSubmitStatus('error');
      setErrorMessage(validationError);
      return;
    }

    setIsSubmitting(true);

    try {
      // Create form data for ESP32
      const formData = new URLSearchParams();
      formData.append('ssid', wifiSsid.trim());
      formData.append('password', wifiPassword);
      formData.append('uid', userId);

      // Post to ESP32's local IP
      // Note: Uses HTTP and no-cors mode because ESP32 device runs locally without HTTPS/CORS support
      // This is acceptable as the device is on a local network during setup
      await fetch('http://192.168.4.1/wifi', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
        mode: 'no-cors',
      });

      // With no-cors mode, we can't read the response
      // Assume success if no error thrown
      setSubmitStatus('success');
      setCurrentStep(3);
    } catch (error: any) {
      console.error('Failed to configure device:', error);
      setSubmitStatus('error');
      setErrorMessage(
        'Không thể kết nối với thiết bị. Hãy chắc chắn bạn đã kết nối với mạng WiFi "GTIControl963".'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center space-x-4 mb-8">
          <Link
            to="/"
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Thêm thiết bị mới</h1>
            <p className="text-gray-500">Cấu hình thiết bị inverter ESP32 của bạn</p>
          </div>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center mb-8">
          {[1, 2, 3].map((step) => (
            <div key={step} className="flex items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                  currentStep >= step
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-500'
                }`}
              >
                {currentStep > step ? <Check className="w-5 h-5" /> : step}
              </div>
              {step < 3 && (
                <div
                  className={`w-16 h-1 mx-2 ${
                    currentStep > step ? 'bg-blue-600' : 'bg-gray-200'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step Content */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          {/* Step 1: Prepare */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Wifi className="w-8 h-8 text-blue-600" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900">
                  Bước 1: Kết nối WiFi thiết bị
                </h2>
                <p className="text-gray-500 mt-2">
                  Đầu tiên, kết nối điện thoại/máy tính của bạn với mạng WiFi của thiết bị
                </p>
              </div>

              {/* User ID Section */}
              <div className="bg-gray-50 rounded-lg p-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  ID người dùng của bạn (lưu lại cho Bước 2)
                </label>
                <div className="flex items-center space-x-2">
                  <code className="flex-1 bg-white border border-gray-300 rounded-lg px-4 py-3 text-sm font-mono break-all">
                    {userId}
                  </code>
                  <button
                    onClick={copyToClipboard}
                    className="p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    title="Sao chép"
                  >
                    {copied ? (
                      <Check className="w-5 h-5" />
                    ) : (
                      <Copy className="w-5 h-5" />
                    )}
                  </button>
                </div>
                {copied && (
                  <p className="text-green-600 text-sm mt-2">Đã sao chép!</p>
                )}
              </div>

              {/* Instructions */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h3 className="font-medium text-yellow-800 mb-2">Hướng dẫn:</h3>
                <ol className="list-decimal list-inside space-y-2 text-yellow-700 text-sm">
                  <li>Bật nguồn thiết bị ESP32</li>
                  <li>Mở cài đặt WiFi trên điện thoại/máy tính</li>
                  <li>
                    Kết nối với mạng: <strong>"GTIControl963"</strong>
                  </li>
                  <li>Quay lại trang này sau khi kết nối</li>
                </ol>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-blue-700 text-sm">
                  <strong>Lưu ý:</strong> Trang này hoạt động ngoại tuyến! Sau khi kết nối WiFi thiết bị,
                  bạn sẽ mất internet nhưng trang này vẫn hoạt động.
                </p>
              </div>

              <button
                onClick={() => setCurrentStep(2)}
                className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                Tôi đã kết nối GTIControl963
              </button>
            </div>
          )}

          {/* Step 2: Configure */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Settings className="w-8 h-8 text-blue-600" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900">
                  Bước 2: Cấu hình thiết bị
                </h2>
                <p className="text-gray-500 mt-2">
                  Nhập thông tin WiFi nhà bạn để kết nối thiết bị
                </p>
              </div>

              {submitStatus === 'error' && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start space-x-3">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-red-700 text-sm">{errorMessage}</p>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tên WiFi nhà (SSID)
                  </label>
                  <input
                    type="text"
                    value={wifiSsid}
                    onChange={(e) => setWifiSsid(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Nhập tên WiFi nhà bạn"
                    required
                    maxLength={32}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Mật khẩu WiFi
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={wifiPassword}
                      onChange={(e) => setWifiPassword(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 pr-12"
                      placeholder="Nhập mật khẩu WiFi"
                      required
                      minLength={8}
                      maxLength={63}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    >
                      {showPassword ? (
                        <EyeOff className="w-5 h-5" />
                      ) : (
                        <Eye className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    ID người dùng
                  </label>
                  <input
                    type="text"
                    value={userId}
                    readOnly
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 text-gray-600 font-mono text-sm"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Liên kết thiết bị với tài khoản của bạn
                  </p>
                </div>

                <div className="flex space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(1)}
                    className="flex-1 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                  >
                    Quay lại
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin mr-2" />
                        Đang cấu hình...
                      </>
                    ) : (
                      'Cấu hình thiết bị'
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Step 3: Complete */}
          {currentStep === 3 && (
            <div className="space-y-6 text-center">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle className="w-10 h-10 text-green-600" />
              </div>

              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  Đã gửi cấu hình!
                </h2>
                <p className="text-gray-500 mt-2">
                  Thiết bị đang kết nối với WiFi nhà bạn
                </p>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 text-left">
                <h3 className="font-medium text-gray-900 mb-2">Tiếp theo:</h3>
                <ol className="list-decimal list-inside space-y-2 text-gray-600 text-sm">
                  <li>Thiết bị sẽ khởi động lại và kết nối WiFi nhà bạn</li>
                  <li>Thiết bị sẽ đăng ký với máy chủ</li>
                  <li>Thiết bị sẽ xuất hiện trên bảng điều khiển trong 1-2 phút</li>
                  <li>Kết nối lại điện thoại/máy tính với WiFi nhà bạn</li>
                </ol>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-blue-700 text-sm">
                  <strong>Lưu ý:</strong> Kết nối lại với mạng WiFi nhà để truy cập bảng điều khiển.
                </p>
              </div>

              <Link
                to="/"
                className="inline-block w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                Đi đến Bảng điều khiển
              </Link>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
