import { useRef, useState } from 'react';
import { Camera, X, Upload } from 'lucide-react';

interface Props {
  photos: string[];
  onChange: (photos: string[]) => void;
  maxPhotos?: number;
}

export default function PhotoCapture({ photos, onChange, maxPhotos = 5 }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [previewing, setPreviewing] = useState<string | null>(null);

  function handleFiles(files: FileList | null) {
    if (!files) return;
    const remaining = maxPhotos - photos.length;
    const toProcess = Array.from(files).slice(0, remaining);

    toProcess.forEach(file => {
      const reader = new FileReader();
      reader.onload = e => {
        const result = e.target?.result as string;
        onChange([...photos, result]);
      };
      reader.readAsDataURL(file);
    });
  }

  function removePhoto(idx: number) {
    onChange(photos.filter((_, i) => i !== idx));
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {photos.map((photo, idx) => (
          <div key={idx} className="relative group">
            <img
              src={photo}
              alt={`Photo ${idx + 1}`}
              className="photo-thumbnail cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() => setPreviewing(photo)}
            />
            <button
              type="button"
              onClick={() => removePhoto(idx)}
              className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}

        {photos.length < maxPhotos && (
          <div className="flex gap-2">
            {/* Camera capture (mobile) */}
            <button
              type="button"
              onClick={() => cameraRef.current?.click()}
              className="w-20 h-20 border-2 border-dashed border-green-400 rounded-lg flex flex-col items-center justify-center gap-1 text-green-600 hover:bg-green-50 transition-colors"
              title="Take photo"
            >
              <Camera className="h-6 w-6" />
              <span className="text-xs">Camera</span>
            </button>

            {/* File upload */}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="w-20 h-20 border-2 border-dashed border-blue-400 rounded-lg flex flex-col items-center justify-center gap-1 text-blue-600 hover:bg-blue-50 transition-colors"
              title="Upload photo"
            >
              <Upload className="h-6 w-6" />
              <span className="text-xs">Upload</span>
            </button>
          </div>
        )}
      </div>

      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={e => handleFiles(e.target.files)}
      />
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={e => handleFiles(e.target.files)}
      />

      {photos.length > 0 && (
        <p className="text-xs text-gray-500">
          {photos.length}/{maxPhotos} photos — click to enlarge
        </p>
      )}

      {/* Lightbox */}
      {previewing && (
        <div
          className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-[9999] p-4"
          onClick={() => setPreviewing(null)}
        >
          <div className="relative max-w-3xl max-h-full">
            <img
              src={previewing}
              alt="Preview"
              className="max-w-full max-h-[85vh] rounded-lg object-contain"
            />
            <button
              className="absolute top-2 right-2 bg-white rounded-full p-1 text-gray-800 hover:bg-gray-100"
              onClick={() => setPreviewing(null)}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
