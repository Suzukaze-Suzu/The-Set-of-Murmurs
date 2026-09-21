import { useState, FormEvent, useRef, DragEvent } from 'react';
import { useGallery } from '../context/GalleryContext';
import { useAuth } from '../context/AuthContext';
import { usePageTitle } from '../hooks/usePageTitle';
import { useT } from '../i18n';

export default function Gallery() {
  const t = useT();
  usePageTitle(t('gallery.title'));
  const { images, addImage, removeImage } = useGallery();
  const { isAdmin } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState('');
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [zoomImage, setZoomImage] = useState<{ url: string; caption: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const acceptFile = (f: File | null | undefined) => {
    if (!f) return;
    if (!f.type.startsWith('image/')) {
      setError(t('gallery.wrongType'));
      return;
    }
    setFile(f);
    setError('');
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    acceptFile(f);
  };

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError(t('gallery.pickOne'));
      return;
    }
    setError('');
    setUploading(true);
    try {
      const msg = await addImage(file, caption);
      if (msg) {
        setError(msg);
        alert(t('common.uploadFailed') + msg);
        return;
      }
    } catch (err) {
      const em = err instanceof Error ? err.message : String(err);
      setError(t('common.uploadFailed') + em);
      alert(t('common.uploadFailed') + em);
      return;
    } finally {
      setUploading(false);
    }
    setFile(null);
    setCaption('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="page gallery-page">
      <h1 className="page-title">{t('gallery.heading')}</h1>
      <p className="gallery-desc">{t('gallery.desc')}</p>

      {isAdmin && (
      <form
        className="gallery-form card"
        onSubmit={handleAdd}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        <div className="gallery-dropzone">
          <div className="gallery-drop-hint">
            <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 16V4m0 0l-4 4m4-4l4 4"/><path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/></svg>
            <p>{dragging ? t('gallery.releaseToAdd') : t('gallery.dropHint')}</p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="gallery-input"
            onChange={(e) => acceptFile(e.target.files?.[0])}
          />
        </div>

        {file && (
          <div className="gallery-file-preview">
            <img src={URL.createObjectURL(file)} alt={t('gallery.preview')} />
            <span>{file.name}</span>
          </div>
        )}

        <input
          type="text"
          className="gallery-input gallery-input-sm"
          placeholder={t('gallery.captionPlaceholder')}
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
        />

        {error && <p className="gallery-error">{error}</p>}
        <button type="submit" className="btn btn-primary" disabled={uploading}>{uploading ? t('gallery.uploading') : t('gallery.addImage')}</button>
      </form>
      )}

      {images.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon empty-icon-gallery" />
          <p>{t('gallery.empty')}</p>
        </div>
      ) : (
        <div className="gallery-grid">
          {images.map((img) => (
            <figure key={img.id} className="gallery-item">
              <div
                className="gallery-thumb"
                onClick={() => setZoomImage({ url: img.url, caption: img.caption })}
              >
                <img src={img.url} alt={img.caption || t('gallery.imageAlt')} loading="lazy" />
              </div>
              <figcaption className="gallery-caption">
                <span>{img.caption || t('gallery.unnamed')}</span>
                {isAdmin && (
                  <button
                    className="gallery-remove"
                    onClick={() => removeImage(img.id)}
                    title={t('gallery.removeTitle')}
                  >
                    {t('gallery.remove')}
                  </button>
                )}
              </figcaption>
            </figure>
          ))}
        </div>
      )}

      {zoomImage && (
        <div className="modal-overlay" onClick={() => setZoomImage(null)}>
          <div className="zoom-modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setZoomImage(null)}>×</button>
            <img src={zoomImage.url} alt={zoomImage.caption || t('gallery.imageAlt')} />
            {zoomImage.caption && <p className="zoom-caption">{zoomImage.caption}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
