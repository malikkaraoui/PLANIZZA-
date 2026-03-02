import { useState, useRef, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Check, Upload, Loader2 } from 'lucide-react';
import { ref as storageRef, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import imageCompression from 'browser-image-compression';
import { storage } from '../../../../lib/firebase';
import { PIZZA_PHOTO_PRESETS } from '../../constants/pizzaPhotoPresets';

/**
 * Carrousel de sélection de photo pour le formulaire pizzaiolo.
 * Permet de choisir un preset OU d'uploader sa propre photo.
 */
export default function PizzaPhotoCarousel({ selectedPhotoUrl, onSelectPhoto, truckId, label = 'Photo du produit' }) {
  const [scrollPosition, setScrollPosition] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [customPhotoUrl, setCustomPhotoUrl] = useState(null);
  const containerRef = useRef(null);
  const fileInputRef = useRef(null);

  // Si la photo selectionnee est une URL Firebase (custom), la tracker
  useEffect(() => {
    if (selectedPhotoUrl && selectedPhotoUrl.includes('firebasestorage.googleapis.com')) {
      setCustomPhotoUrl(selectedPhotoUrl);
    }
  }, [selectedPhotoUrl]);

  const scroll = (direction) => {
    if (!containerRef.current) return;

    const scrollAmount = 320;
    const newPosition = direction === 'left'
      ? Math.max(0, scrollPosition - scrollAmount)
      : scrollPosition + scrollAmount;

    containerRef.current.scrollTo({
      left: newPosition,
      behavior: 'smooth'
    });

    setScrollPosition(newPosition);
  };

  const handleScroll = () => {
    if (containerRef.current) {
      setScrollPosition(containerRef.current.scrollLeft);
    }
  };

  const canScrollLeft = scrollPosition > 0;
  const canScrollRight = containerRef.current
    ? scrollPosition < containerRef.current.scrollWidth - containerRef.current.clientWidth - 10
    : true;

  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, []);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      alert('L\'image ne doit pas depasser 10MB');
      return;
    }

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      alert('Format non supporte. Utilisez JPG, PNG ou WebP');
      return;
    }

    setUploading(true);
    try {
      // Supprimer l'ancienne photo custom si elle existe
      if (customPhotoUrl && customPhotoUrl.includes('firebasestorage.googleapis.com')) {
        try {
          const urlParts = customPhotoUrl.split('/o/')[1]?.split('?')[0];
          if (urlParts) {
            const oldPath = decodeURIComponent(urlParts);
            await deleteObject(storageRef(storage, oldPath));
          }
        } catch {
          // Ignorer les erreurs de suppression
        }
      }

      // Compresser en WebP ~200Ko max
      const compressed = await imageCompression(file, {
        maxSizeMB: 0.2,
        maxWidthOrHeight: 1200,
        useWebWorker: true,
        fileType: 'image/webp',
      });

      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substring(2, 9);
      const baseName = file.name.replace(/\.[^.]+$/, '');
      const folder = truckId ? `menu-photos/${truckId}` : 'menu-photos';
      const path = `${folder}/${timestamp}_${randomId}_${baseName}.webp`;

      const imageRef = storageRef(storage, path);
      await uploadBytes(imageRef, compressed);
      const downloadUrl = await getDownloadURL(imageRef);

      setCustomPhotoUrl(downloadUrl);
      onSelectPhoto(downloadUrl);
    } catch (err) {
      console.error('[PLANIZZA] Erreur upload photo menu:', err);
      alert('Erreur lors de l\'upload. Reessayez.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const isCustomSelected = selectedPhotoUrl && selectedPhotoUrl.includes('firebasestorage.googleapis.com');

  return (
    <div className="space-y-3">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp"
        onChange={handleFileSelect}
        className="hidden"
      />

      <div className="flex items-center justify-between">
        <label className="text-sm font-bold text-gray-700">
          {label}
          <span className="ml-2 text-xs font-normal text-gray-500">(optionnel)</span>
        </label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => scroll('left')}
            disabled={!canScrollLeft}
            className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            aria-label="Defiler vers la gauche"
          >
            <ChevronLeft className="h-5 w-5 text-gray-600" />
          </button>
          <button
            type="button"
            onClick={() => scroll('right')}
            disabled={!canScrollRight}
            className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            aria-label="Defiler vers la droite"
          >
            <ChevronRight className="h-5 w-5 text-gray-600" />
          </button>
        </div>
      </div>

      <p className="text-xs text-gray-600">
        Uploadez votre propre photo ou choisissez un preset
      </p>

      <div
        ref={containerRef}
        className="overflow-x-auto pb-4 -mx-2 px-2 scrollbar-hide"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        <div className="flex gap-3 min-w-min">
          {/* Bouton "Ma photo" */}
          {customPhotoUrl ? (
            <button
              type="button"
              onClick={() => onSelectPhoto(customPhotoUrl)}
              className={`relative shrink-0 w-32 h-32 rounded-2xl overflow-hidden border-2 transition-all hover:scale-105 ${
                isCustomSelected
                  ? 'border-primary shadow-lg shadow-primary/20'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <img
                src={customPhotoUrl}
                alt="Ma photo"
                className="w-full h-full object-cover"
              />
              {isCustomSelected && (
                <div className="absolute top-2 right-2 w-6 h-6 bg-primary rounded-full flex items-center justify-center shadow-lg">
                  <Check className="h-4 w-4 text-white" />
                </div>
              )}
              <div className="absolute bottom-0 left-0 right-0 bg-linear-to-t from-black/60 to-transparent p-2 flex items-center justify-between">
                <div className="text-[10px] font-medium text-white">Ma photo</div>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleUploadClick(); }}
                  className="text-white/80 hover:text-white"
                >
                  <Upload className="h-3 w-3" />
                </button>
              </div>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleUploadClick}
              disabled={uploading}
              className="shrink-0 w-32 h-32 rounded-2xl border-2 border-dashed border-primary/40 bg-primary/5 transition-all hover:scale-105 hover:border-primary/60 flex items-center justify-center"
            >
              <div className="text-center p-3">
                {uploading ? (
                  <>
                    <Loader2 className="h-7 w-7 text-primary mx-auto animate-spin" />
                    <div className="text-[10px] font-medium text-primary mt-1">Compression...</div>
                  </>
                ) : (
                  <>
                    <Upload className="h-7 w-7 text-primary mx-auto" />
                    <div className="text-[10px] font-medium text-primary mt-1">Ma photo</div>
                  </>
                )}
              </div>
            </button>
          )}

          {/* Option "Sans photo" */}
          <button
            type="button"
            onClick={() => onSelectPhoto(null)}
            className={`shrink-0 w-32 h-32 rounded-2xl border-2 transition-all hover:scale-105 flex items-center justify-center ${
              !selectedPhotoUrl
                ? 'border-primary bg-primary/5 shadow-lg shadow-primary/20'
                : 'border-gray-200 bg-gray-50 hover:border-gray-300'
            }`}
          >
            <div className="text-center p-3">
              <div className="text-3xl mb-1">📷</div>
              <div className="text-xs font-medium text-gray-600">Sans photo</div>
            </div>
            {!selectedPhotoUrl && (
              <div className="absolute top-2 right-2 w-6 h-6 bg-primary rounded-full flex items-center justify-center shadow-lg">
                <Check className="h-4 w-4 text-white" />
              </div>
            )}
          </button>

          {/* Photos predefinies */}
          {PIZZA_PHOTO_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => onSelectPhoto(preset.url)}
              className={`relative shrink-0 w-32 h-32 rounded-2xl overflow-hidden border-2 transition-all hover:scale-105 ${
                selectedPhotoUrl === preset.url
                  ? 'border-primary shadow-lg shadow-primary/20'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <img
                src={preset.url}
                alt={preset.name}
                className="w-full h-full object-cover"
                loading="lazy"
              />
              {selectedPhotoUrl === preset.url && (
                <div className="absolute top-2 right-2 w-6 h-6 bg-primary rounded-full flex items-center justify-center shadow-lg">
                  <Check className="h-4 w-4 text-white" />
                </div>
              )}
              <div className="absolute bottom-0 left-0 right-0 bg-linear-to-t from-black/60 to-transparent p-2">
                <div className="text-[10px] font-medium text-white line-clamp-1">
                  {preset.name}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
