import React, { useState } from 'react'
import Button from './Button'
import Modal from './Modal'

interface ManualLocationInputProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (lat: number, lon: number) => void
}

export const ManualLocationInput: React.FC<ManualLocationInputProps> = ({
  isOpen,
  onClose,
  onSubmit
}) => {
  const [latitude, setLatitude] = useState('')
  const [longitude, setLongitude] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const lat = parseFloat(latitude)
    const lon = parseFloat(longitude)

    if (isNaN(lat) || isNaN(lon)) {
      setError('有効な数値を入力してください')
      return
    }

    if (lat < -90 || lat > 90) {
      setError('緯度は-90〜90の範囲で入力してください')
      return
    }

    if (lon < -180 || lon > 180) {
      setError('経度は-180〜180の範囲で入力してください')
      return
    }

    onSubmit(lat, lon)
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="位置情報を手動で入力">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <p className="text-sm text-gray-600 mb-4">
            GPSが利用できない場合は、撮影場所の緯度・経度を手動で入力できます。
          </p>
          
          <div className="space-y-3">
            <div>
              <label htmlFor="latitude" className="block text-sm font-medium text-gray-700 mb-1">
                緯度 (Latitude)
              </label>
              <input
                type="number"
                id="latitude"
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
                step="0.000001"
                placeholder="例: 35.6812"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
            
            <div>
              <label htmlFor="longitude" className="block text-sm font-medium text-gray-700 mb-1">
                経度 (Longitude)
              </label>
              <input
                type="number"
                id="longitude"
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
                step="0.000001"
                placeholder="例: 139.7671"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
          </div>
          
          {error && (
            <p className="text-sm text-red-600 mt-2">{error}</p>
          )}
          
          <div className="mt-4 text-xs text-gray-500">
            <p>💡 ヒント: Google Mapsで場所を右クリックすると緯度・経度が表示されます</p>
          </div>
        </div>
        
        <div className="flex gap-3">
          <Button type="submit" variant="primary" fullWidth>
            設定
          </Button>
          <Button type="button" variant="secondary" fullWidth onClick={onClose}>
            キャンセル
          </Button>
        </div>
      </form>
    </Modal>
  )
}