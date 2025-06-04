import { useState, useCallback } from 'react'
import EXIF from 'exif-js'
import {
  AuthGuard,
  PageContainer,
  Card,
  FileUpload,
  AzimuthSelector,
  Alert,
  Button,
  ProgressBar
} from '../components'

interface PhotoMetadata {
  lat: number
  lon: number
  timestamp: number
}

export default function Upload() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [metadata, setMetadata] = useState<PhotoMetadata | null>(null)
  const [azimuth, setAzimuth] = useState<number>(0)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)

  const extractMetadata = (file: File): Promise<PhotoMetadata | null> => {
    return new Promise((resolve) => {
      EXIF.getData(file as any, function(this: any) {
        const lat = EXIF.getTag(this, 'GPSLatitude')
        const lon = EXIF.getTag(this, 'GPSLongitude')
        const latRef = EXIF.getTag(this, 'GPSLatitudeRef')
        const lonRef = EXIF.getTag(this, 'GPSLongitudeRef')
        const dateTime = EXIF.getTag(this, 'DateTimeOriginal')

        if (lat && lon) {
          // Convert GPS coordinates to decimal
          const decimalLat = convertDMSToDD(lat, latRef)
          const decimalLon = convertDMSToDD(lon, lonRef)
          
          const timestamp = dateTime ? new Date(dateTime.replace(/:/g, '-')).getTime() : Date.now()

          resolve({
            lat: decimalLat,
            lon: decimalLon,
            timestamp
          })
        } else {
          resolve(null)
        }
      })
    })
  }

  const convertDMSToDD = (dms: number[], ref: string): number => {
    let dd = dms[0] + dms[1] / 60 + dms[2] / 3600
    if (ref === 'S' || ref === 'W') dd = dd * -1
    return dd
  }

  const handleFileSelect = useCallback(async (file: File) => {

    setSelectedFile(file)
    
    // Create preview
    const reader = new FileReader()
    reader.onload = (e) => {
      setPreview(e.target?.result as string)
    }
    reader.readAsDataURL(file)

    // Extract metadata
    const meta = await extractMetadata(file)
    setMetadata(meta)
  }, [])

  const handleUpload = async () => {
    if (!selectedFile || !metadata) return

    setUploading(true)
    setUploadProgress(0)

    try {
      // Simulate chunk upload progress
      const chunkSize = 256 * 1024 // 256KB
      const totalChunks = Math.ceil(selectedFile.size / chunkSize)
      
      for (let i = 0; i < totalChunks; i++) {
        // TODO: Implement actual chunk upload to PhotoNFT canister
        await new Promise(resolve => setTimeout(resolve, 500))
        setUploadProgress(((i + 1) / totalChunks) * 100)
      }

      alert('Photo uploaded successfully!')
      
      // Reset form
      setSelectedFile(null)
      setPreview(null)
      setMetadata(null)
      setAzimuth(0)
      setUploadProgress(0)
    } catch (error) {
      console.error('Upload failed:', error)
      alert('Upload failed. Please try again.')
    } finally {
      setUploading(false)
    }
  }


  return (
    <AuthGuard>
      <PageContainer title="Upload Photo" subtitle="Share your location photos and earn SPOT tokens" maxWidth="lg">
        <Card padding="large">

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Photo
          </label>
          <FileUpload
            onFileSelect={handleFileSelect}
            accept="image/*"
            maxSize={5 * 1024 * 1024}
            disabled={uploading}
            preview={preview}
          />
        </div>

        {metadata && (
          <Alert type="success" title="GPS Data Found!" className="mb-6">
            <div>
              <p>Location: {metadata.lat.toFixed(6)}°, {metadata.lon.toFixed(6)}°</p>
              <p>Timestamp: {new Date(metadata.timestamp).toLocaleString()}</p>
            </div>
          </Alert>
        )}

        {!metadata && selectedFile && (
          <Alert type="warning" title="No GPS Data Found" className="mb-6">
            This photo doesn't contain GPS information. Only photos with location data can be uploaded.
          </Alert>
        )}

        {metadata && (
          <div className="mb-6">
            <AzimuthSelector
              value={azimuth}
              onChange={setAzimuth}
              disabled={uploading}
            />
            <p className="text-sm text-gray-600 mt-2">
              Set the direction the camera was facing when the photo was taken.
            </p>
          </div>
        )}

        {uploading && (
          <ProgressBar
            progress={uploadProgress}
            label="Uploading..."
            className="mb-6"
          />
        )}

        <Button
          onClick={handleUpload}
          disabled={!selectedFile || !metadata}
          loading={uploading}
          fullWidth
          size="large"
        >
          Upload Photo
        </Button>

        <Alert type="info" title="Earn SPOT Tokens" className="mt-6">
          Each time someone plays a round with your photo, you'll earn 30% of their rewards.
          High-quality, challenging photos earn more over time!
        </Alert>
        </Card>
      </PageContainer>
    </AuthGuard>
  )
}