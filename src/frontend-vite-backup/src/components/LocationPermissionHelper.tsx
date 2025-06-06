import React from 'react'
import Alert from './Alert'
import Button from './Button'

interface LocationPermissionHelperProps {
  error?: string | null
  isIOS?: boolean
  onRetry: () => void
}

export const LocationPermissionHelper: React.FC<LocationPermissionHelperProps> = ({ 
  error, 
  isIOS = false,
  onRetry 
}) => {
  if (!error) return null

  const isDenied = error.includes('拒否')
  const isTimeout = error.includes('タイムアウト')
  const isUnavailable = error.includes('利用できません')

  return (
    <Alert type={isDenied ? 'error' : 'warning'} title="位置情報の問題">
      <div className="space-y-3">
        <p className="text-sm">{error}</p>
        
        {isDenied && (
          <div className="space-y-2">
            <p className="text-sm font-semibold">設定方法：</p>
            {isIOS ? (
              <ol className="text-sm list-decimal list-inside space-y-1">
                <li>設定アプリを開く</li>
                <li>Safari → 位置情報 → 「確認」または「許可」を選択</li>
                <li>プライバシー → 位置情報サービス → オンを確認</li>
                <li>このページをリロードして再試行</li>
              </ol>
            ) : (
              <ol className="text-sm list-decimal list-inside space-y-1">
                <li>ブラウザのアドレスバー左側の🔒アイコンをクリック</li>
                <li>「位置情報」の設定を「許可」に変更</li>
                <li>ページをリロードして再試行</li>
              </ol>
            )}
          </div>
        )}

        {isTimeout && (
          <p className="text-sm">
            電波状況が悪い可能性があります。Wi-Fiに接続するか、電波の良い場所で再試行してください。
          </p>
        )}

        {isUnavailable && (
          <p className="text-sm">
            デバイスの位置情報サービスがオフになっている可能性があります。設定で位置情報サービスをオンにしてください。
          </p>
        )}

        <div className="flex gap-2">
          <Button
            onClick={onRetry}
            variant="primary"
            size="small"
          >
            再試行
          </Button>
          
          {isDenied && (
            <Button
              onClick={() => window.location.reload()}
              variant="secondary"
              size="small"
            >
              ページをリロード
            </Button>
          )}
        </div>
      </div>
    </Alert>
  )
}