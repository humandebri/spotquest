import { Modal, Button } from '.'

interface PermissionDialogProps {
  isOpen: boolean
  onClose: () => void
  onAccept: () => void
  permission: 'camera' | 'location' | 'both'
  title?: string
  description?: string
}

export default function PermissionDialog({
  isOpen,
  onClose,
  onAccept,
  permission,
  title,
  description
}: PermissionDialogProps) {
  const getPermissionInfo = () => {
    switch (permission) {
      case 'camera':
        return {
          icon: (
            <svg className="w-12 h-12 mx-auto text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          ),
          title: title || 'カメラへのアクセス許可',
          description: description || 'Guess-the-Spotでは、写真を撮影するためにカメラへのアクセスが必要です。',
          features: [
            '位置推理ゲーム用の写真撮影',
            '写真の品質確認',
            '撮影データはあなたのデバイスで処理されます'
          ]
        }
      case 'location':
        return {
          icon: (
            <svg className="w-12 h-12 mx-auto text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          ),
          title: title || '位置情報へのアクセス許可',
          description: description || 'Guess-the-Spotでは、写真の撮影位置を記録するために位置情報へのアクセスが必要です。',
          features: [
            '写真撮影時の正確な位置情報記録',
            'ゲームの公平性を保つための位置検証',
            '位置情報は±15m程度の精度で匿名化されます'
          ]
        }
      case 'both':
        return {
          icon: (
            <div className="flex justify-center space-x-2">
              <svg className="w-10 h-10 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <svg className="w-10 h-10 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
          ),
          title: title || 'カメラと位置情報へのアクセス許可',
          description: description || 'Guess-the-Spotでは、位置情報付きの写真を撮影するために、カメラと位置情報へのアクセスが必要です。',
          features: [
            '位置情報付きの写真撮影',
            '正確な位置データの記録',
            'ゲームの品質保証',
            'プライバシーは十分に保護されます'
          ]
        }
    }
  }

  const permissionInfo = getPermissionInfo()

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="large">
      <div className="text-center p-6">
        <div className="mb-4">
          {permissionInfo.icon}
        </div>
        
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          {permissionInfo.title}
        </h3>
        
        <p className="text-gray-600 mb-6">
          {permissionInfo.description}
        </p>
        
        <div className="text-left mb-6">
          <h4 className="font-medium text-gray-900 mb-3">使用目的：</h4>
          <ul className="space-y-2">
            {permissionInfo.features.map((feature, index) => (
              <li key={index} className="flex items-start">
                <svg className="w-5 h-5 text-green-500 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                <span className="text-sm text-gray-700">{feature}</span>
              </li>
            ))}
          </ul>
        </div>
        
        <div className="bg-blue-50 rounded-lg p-4 mb-6">
          <div className="flex items-start">
            <svg className="w-5 h-5 text-blue-400 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <div>
              <p className="text-sm font-medium text-blue-800">プライバシーについて</p>
              <p className="text-sm text-blue-700 mt-1">
                収集された位置情報は適切に暗号化され、ゲームの公平性を保つ目的でのみ使用されます。
                個人を特定できる形での情報共有は一切行いません。
              </p>
            </div>
          </div>
        </div>
        
        <div className="flex space-x-3">
          <Button
            variant="secondary"
            onClick={onClose}
            fullWidth
          >
            キャンセル
          </Button>
          <Button
            variant="primary"
            onClick={onAccept}
            fullWidth
          >
            許可する
          </Button>
        </div>
      </div>
    </Modal>
  )
}