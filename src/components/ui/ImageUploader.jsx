import { useState, useRef } from 'react';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../../lib/firebase';
import { Button } from './Button';

export default function ImageUploader({ value, onChange, label, folder = 'uploads' }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(value || '');
  const fileInputRef = useRef(null);

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Vérifications
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      setError('L\'image ne doit pas dépasser 5MB');
      return;
    }

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setError('Format non supporté. Utilisez JPG, PNG ou WebP');
      return;
    }

    setError('');
    setUploading(true);

    try {
      // Créer un nom unique pour le fichier
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substring(2, 9);
      const fileName = `${timestamp}_${randomId}_${file.name}`;
      const path = `${folder}/${fileName}`;

      // Upload vers Firebase Storage
      const imageRef = storageRef(storage, path);
      await uploadBytes(imageRef, file);

      // Récupérer l'URL publique
      const downloadUrl = await getDownloadURL(imageRef);

      setPreview(downloadUrl);
      onChange(downloadUrl);

      console.log('[PLANIZZA] Image uploadée:', downloadUrl);
    } catch (err) {
      console.error('Erreur upload image:', err);
      setError('Erreur lors de l\'upload. Réessayez.');
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = () => {
    setPreview('');
    onChange('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-3">
      {label && (
        <label className="block text-sm font-medium text-gray-700">{label}</label>
      )}

      {/* Aperçu de l'image */}
      {preview && (
        <div className="relative rounded-lg overflow-hidden border border-gray-300 bg-gray-50">
          <img
            src={preview}
            alt="Aperçu"
            className="w-full h-48 object-cover"
          />
          <button
            type="button"
            onClick={handleRemove}
            className="absolute top-2 right-2 bg-red-600 text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-red-700 shadow-lg"
          >
            ✕
          </button>
        </div>
      )}

      {/* Zone d'upload */}
      {!preview && (
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-primary transition-colors">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp"
            onChange={handleFileSelect}
            className="hidden"
            id={`file-upload-${folder}`}
          />
          
          <div className="space-y-3">
            <div className="text-4xl">📸</div>
            <div>
              <label
                htmlFor={`file-upload-${folder}`}
                className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
              >
                {uploading ? (
                  <>
                    <span className="animate-spin">⏳</span>
                    Upload en cours...
                  </>
                ) : (
                  <>
                    📁 Choisir une image
                  </>
                )}
              </label>
            </div>
            <p className="text-xs text-gray-500">
              JPG, PNG ou WebP • Max 5MB
            </p>
          </div>
        </div>
      )}

      {/* Message d'erreur */}
      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm">
          {error}
        </div>
      )}
    </div>
  );
}
