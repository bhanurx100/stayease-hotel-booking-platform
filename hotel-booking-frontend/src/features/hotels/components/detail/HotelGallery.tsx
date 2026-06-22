/**
 * Property photo gallery — desktop grid + compact mobile stack (max ~55vh).
 * Fullscreen modal shows every photo in allPhotos (no count cap).
 */

import React, { memo, useState, useEffect, useCallback } from "react";
import {
  ChevronLeft, ChevronRight, X, Images, Building2, Share2, Heart,
} from "lucide-react";

function imgErr(e: React.SyntheticEvent<HTMLImageElement>) {
  e.currentTarget.style.visibility = "hidden";
}

interface GalleryModalProps {
  images: string[];
  startIndex: number;
  onClose: () => void;
}

const GalleryModal = memo(({ images, startIndex, onClose }: GalleryModalProps) => {
  const [idx, setIdx] = useState(startIndex);
  const total = images.length;
  const prev = useCallback(() => setIdx((i) => (i - 1 + total) % total), [total]);
  const next = useCallback(() => setIdx((i) => (i + 1) % total), [total]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose, prev, next]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  return (
    <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col" onClick={onClose}>
      <div className="flex justify-between items-center px-4 py-3" onClick={(e) => e.stopPropagation()}>
        <span className="text-white/80 text-sm font-medium">{idx + 1} / {total}</span>
        <button type="button" onClick={onClose} className="text-white p-2 rounded-full hover:bg-white/10" aria-label="Close">
          <X className="w-6 h-6" />
        </button>
      </div>
      <div className="flex-1 flex items-center justify-center relative px-2 min-h-0" onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={prev} className="absolute left-2 p-2 text-white/80 hover:text-white z-10" aria-label="Previous">
          <ChevronLeft className="w-8 h-8" />
        </button>
        <img src={images[idx]} alt="" className="max-h-[75vh] max-w-full object-contain" onError={imgErr} />
        <button type="button" onClick={next} className="absolute right-2 p-2 text-white/80 hover:text-white z-10" aria-label="Next">
          <ChevronRight className="w-8 h-8" />
        </button>
      </div>
      <div className="flex gap-2 overflow-x-auto px-4 py-3 max-w-full shrink-0" onClick={(e) => e.stopPropagation()}>
        {images.map((url, i) => (
          <button
            key={`${url}-${i}`}
            type="button"
            onClick={() => setIdx(i)}
            className={`flex-shrink-0 w-14 h-10 rounded overflow-hidden border-2 ${i === idx ? "border-white" : "border-transparent opacity-50"}`}
          >
            <img src={url} alt="" className="w-full h-full object-cover" onError={imgErr} />
          </button>
        ))}
      </div>
    </div>
  );
});
GalleryModal.displayName = "GalleryModal";

export interface HotelGalleryProps {
  images: string[];
  propertyName?: string;
  middleSlot?: React.ReactNode;
  saved?: boolean;
  onSave?: () => void;
}

const GalleryActions = ({
  onViewAll,
  onShare,
  saved,
  onSave,
  photoCount,
}: {
  onViewAll: () => void;
  onShare: () => void;
  saved?: boolean;
  onSave?: () => void;
  photoCount: number;
}) => (
  <div className="flex flex-wrap items-center gap-2">
    <button
      type="button"
      onClick={onViewAll}
      className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-800 bg-white border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 shadow-sm"
    >
      <Images className="w-4 h-4" />
      View All Photos
    </button>
    <button
      type="button"
      onClick={onShare}
      className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-700 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50"
    >
      <Share2 className="w-4 h-4" />
      Share
    </button>
    {onSave && (
      <button
        type="button"
        onClick={onSave}
        className={`inline-flex items-center gap-1.5 text-sm font-semibold border rounded-lg px-3 py-1.5 ${
          saved ? "border-rose-300 bg-rose-50 text-rose-700" : "border-gray-200 text-gray-700 hover:bg-gray-50"
        }`}
      >
        <Heart className={`w-4 h-4 ${saved ? "fill-rose-500" : ""}`} />
        {saved ? "Saved" : "Save"}
      </button>
    )}
    {photoCount > 0 && (
      <span className="text-xs text-gray-500 ml-auto hidden sm:inline">{photoCount} photos</span>
    )}
  </div>
);

const HotelGallery = memo(({
  images,
  propertyName = "Property",
  middleSlot,
  saved,
  onSave,
}: HotelGalleryProps) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [modalStart, setModalStart] = useState(0);

  const open = (i: number) => {
    setModalStart(i);
    setModalOpen(true);
  };

  const handleShare = async () => {
    const url = window.location.href;
    const title = propertyName;
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
      } else {
        await navigator.clipboard.writeText(url);
      }
    } catch {
      /* user cancelled */
    }
  };

  if (!images.length) {
    return (
      <div className="w-full overflow-hidden rounded-xl bg-gray-100 h-40 sm:h-48 flex items-center justify-center">
        <div className="text-center text-gray-400">
          <Building2 className="w-8 h-8 mx-auto mb-1.5" />
          <p className="text-sm">No photos available</p>
        </div>
      </div>
    );
  }

  const hero = images[0];
  const thumbs = images.slice(1, 5);
  const extraCount = Math.max(0, images.length - 5);

  return (
    <>
      {modalOpen && (
        <GalleryModal images={images} startIndex={modalStart} onClose={() => setModalOpen(false)} />
      )}

      <div className="w-full max-w-full overflow-hidden">
        {/* Mobile — max 55vh for photo block */}
        <div className="md:hidden flex flex-col gap-2 max-h-[55vh]">
          <button
            type="button"
            className="relative w-full flex-[1.4] min-h-[120px] max-h-[32vh] overflow-hidden rounded-xl bg-gray-200"
            onClick={() => open(0)}
          >
            <img src={hero} alt={propertyName} className="w-full h-full object-cover" loading="eager" onError={imgErr} />
          </button>

          {middleSlot}

          {thumbs.length > 0 && (
            <div className="grid grid-cols-2 gap-1 flex-1 min-h-0 max-h-[22vh]">
              {thumbs.map((url, i) => (
                <button
                  key={`m-${url}-${i}`}
                  type="button"
                  className="relative overflow-hidden rounded-lg bg-gray-200 min-h-[72px]"
                  onClick={() => open(i + 1)}
                >
                  <img src={url} alt="" className="w-full h-full object-cover" loading="lazy" onError={imgErr} />
                  {i === thumbs.length - 1 && extraCount > 0 && (
                    <span className="absolute inset-0 bg-black/55 flex items-center justify-center text-white font-bold text-base">
                      +{extraCount} Photos
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          <GalleryActions
            onViewAll={() => open(0)}
            onShare={handleShare}
            saved={saved}
            onSave={onSave}
            photoCount={images.length}
          />
        </div>

        {/* Desktop */}
        <div className="hidden md:block space-y-2">
          <div className="relative rounded-xl overflow-hidden">
            <div className="grid grid-cols-[1.15fr_1fr] gap-1.5 h-[min(380px,42vh)]">
              <button
                type="button"
                className="relative overflow-hidden bg-gray-200 group h-full min-h-0"
                onClick={() => open(0)}
              >
                <img
                  src={hero}
                  alt={propertyName}
                  className="w-full h-full object-cover group-hover:brightness-[1.02] transition-all duration-300"
                  loading="eager"
                  onError={imgErr}
                />
              </button>
              <div className="grid grid-cols-2 grid-rows-2 gap-1.5 min-h-0">
                {thumbs.map((url, i) => (
                  <button
                    key={`d-${url}-${i}`}
                    type="button"
                    className="relative overflow-hidden bg-gray-200 group min-h-0"
                    onClick={() => open(i + 1)}
                  >
                    <img
                      src={url}
                      alt=""
                      className="w-full h-full object-cover group-hover:brightness-[1.02] transition-all"
                      loading="lazy"
                      onError={imgErr}
                    />
                    {i === thumbs.length - 1 && extraCount > 0 && (
                      <span className="absolute inset-0 bg-black/55 flex flex-col items-center justify-center text-white pointer-events-none">
                        <span className="text-xl font-bold leading-none">+{extraCount}</span>
                        <span className="text-[11px] opacity-90 mt-0.5">Photos</span>
                      </span>
                    )}
                  </button>
                ))}
                {thumbs.length < 4 &&
                  Array.from({ length: 4 - thumbs.length }).map((_, i) => (
                    <div key={`pad-${i}`} className="bg-gray-100 min-h-0" aria-hidden />
                  ))}
              </div>
            </div>
          </div>
          <GalleryActions
            onViewAll={() => open(0)}
            onShare={handleShare}
            saved={saved}
            onSave={onSave}
            photoCount={images.length}
          />
        </div>
      </div>
    </>
  );
});
HotelGallery.displayName = "HotelGallery";

export default HotelGallery;
