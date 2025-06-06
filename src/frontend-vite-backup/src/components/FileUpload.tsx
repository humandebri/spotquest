import React, { useCallback } from 'react';

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  accept?: string;
  maxSize?: number; // in bytes
  disabled?: boolean;
  preview?: string | null;
  className?: string;
}

export default function FileUpload({
  onFileSelect,
  accept = 'image/*',
  maxSize = 5 * 1024 * 1024, // 5MB default
  disabled = false,
  preview,
  className = ''
}: FileUploadProps) {
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check file size
    if (file.size > maxSize) {
      alert(`File size must be less than ${Math.round(maxSize / 1024 / 1024)}MB`);
      return;
    }

    // Check file type
    if (accept && !file.type.match(accept.replace('*', '.*'))) {
      alert(`Please select a file matching: ${accept}`);
      return;
    }

    onFileSelect(file);
  }, [onFileSelect, accept, maxSize]);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    if (disabled) return;

    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    // Check file size
    if (file.size > maxSize) {
      alert(`File size must be less than ${Math.round(maxSize / 1024 / 1024)}MB`);
      return;
    }

    // Check file type
    if (accept && !file.type.match(accept.replace('*', '.*'))) {
      alert(`Please select a file matching: ${accept}`);
      return;
    }

    onFileSelect(file);
  }, [onFileSelect, accept, maxSize, disabled]);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <div 
      className={`mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md hover:border-primary-400 transition-colors ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      <div className="space-y-1 text-center">
        {preview ? (
          <img src={preview} alt="Preview" className="mx-auto h-64 w-auto rounded-md" />
        ) : (
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            stroke="currentColor"
            fill="none"
            viewBox="0 0 48 48"
          >
            <path
              d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
        <div className="flex text-sm text-gray-600">
          <label
            htmlFor="file-upload"
            className={`relative cursor-pointer bg-white rounded-md font-medium text-primary-600 hover:text-primary-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-primary-500 ${disabled ? 'pointer-events-none' : ''}`}
          >
            <span>{preview ? 'Change file' : 'Upload a file'}</span>
            <input
              id="file-upload"
              name="file-upload"
              type="file"
              className="sr-only"
              accept={accept}
              onChange={handleFileSelect}
              disabled={disabled}
            />
          </label>
          <p className="pl-1">or drag and drop</p>
        </div>
        <p className="text-xs text-gray-500">
          {accept.includes('image') && `PNG, JPG up to ${Math.round(maxSize / 1024 / 1024)}MB`}
        </p>
      </div>
    </div>
  );
}