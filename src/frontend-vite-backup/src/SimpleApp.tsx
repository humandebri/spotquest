function SimpleApp() {
  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          Guess the Spot - PWA対応完了
        </h1>
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-2">PWA機能:</h2>
          <ul className="list-disc list-inside space-y-1 text-gray-700">
            <li>Service Worker登録済み</li>
            <li>オフラインサポート</li>
            <li>インストール可能</li>
            <li>自動アップデート通知</li>
          </ul>
        </div>
        <div className="mt-4 bg-blue-100 rounded-lg p-4">
          <p className="text-blue-800">
            アプリが正常に動作しています。Tailwind CSSも適用されています。
          </p>
        </div>
      </div>
    </div>
  )
}

export default SimpleApp