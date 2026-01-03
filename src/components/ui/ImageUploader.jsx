import { useState, useRef } from 'react';
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
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
      // ✅ SUPPRIMER L'ANCIENNE IMAGE si elle existe
      if (value && value.includes('firebasestorage.googleapis.com')) {
        try {
          // Extraire le chemin depuis l'URL Firebase Storage
          const urlParts = value.split('/o/')[1]?.split('?')[0];
          if (urlParts) {
            const oldPath = decodeURIComponent(urlParts);
            const oldImageRef = storageRef(storage, oldPath);
            await deleteObject(oldImageRef);
            console.log('[PLANIZZA] Ancienne image supprimée:', oldPath);
          }
        } catch (deleteErr) {
          console.warn('[PLANIZZA] Impossible de supprimer l\'ancienne image (peut-être déjà supprimée):', deleteErr);
          // Ne pas bloquer l'upload si la suppression échoue
        }
      }

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

  const handleRemove = async (e) => {
    e.stopPropagation();
    
    // ✅ SUPPRIMER L'IMAGE du Storage Firebase
    if (value && value.includes('firebasestorage.googleapis.com')) {
      try {
        const urlParts = value.split('/o/')[1]?.split('?')[0];
        if (urlParts) {
          const imagePath = decodeURIComponent(urlParts);
          const imageRef = storageRef(storage, imagePath);
          await deleteObject(imageRef);
          console.log('[PLANIZZA] Image supprimée du Storage:', imagePath);
        }
      } catch (deleteErr) {
        console.warn('[PLANIZZA] Impossible de supprimer l\'image:', deleteErr);
      }
    }
    
    setPreview('');
    onChange('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleImageClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <div className="space-y-3">
      {label && (
        <label className="block text-sm font-medium text-gray-700">{label}</label>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp"
        onChange={handleFileSelect}
        className="hidden"
        id={`file-upload-${folder}`}
      />

      {/* Aperçu de l'image */}
      {preview && (
        <div 
          className="relative rounded-lg overflow-hidden border border-gray-300 bg-gray-50 cursor-pointer hover:border-primary transition-all group"
          onClick={handleImageClick}
        >
          <img
            src={preview}
            alt="Aperçu"
            className="w-full h-48 object-cover group-hover:opacity-90 transition-opacity"
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-all flex items-center justify-center">
            <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 backdrop-blur-sm px-4 py-2 rounded-full text-sm font-bold text-gray-800">
              📁 Changer l'image
            </div>
          </div>
          <button
            type="button"
            onClick={handleRemove}
            className="absolute top-2 right-2 bg-red-600 text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-red-700 shadow-lg z-10"
          >
            ✕
          </button>
        </div>
      )}

      {/* Zone d'upload */}
      {!preview && (
        <div 
          className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-primary transition-colors cursor-pointer"
          onClick={handleImageClick}
        >
          <div className="space-y-3">
            <div className="text-4xl">📸</div>
            <div>
              <div className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors">
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
              </div>
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
