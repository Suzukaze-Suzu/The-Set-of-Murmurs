import { useState, FormEvent, useRef, DragEvent } from 'react';
import { useGallery } from '../context/GalleryContext';
import { useAuth } from '../context/AuthContext';

export default function Gallery() {
  const { images, addImage, removeImage } = useGallery();
  const { isAdmin } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState('');
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const [zoomImage, setZoomImage] = useState<{ url: string; caption: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const acceptFile = (f: File | null | undefined) => {
    if (!f) return;
    if (!f.type.startsWith('image/')) {
      setError('请拖入图片文件（jpg/png/gif 等）');
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
      setError('请选择或拖入一张图片');
      return;
    }
    setError('');
    try {
      const msg = await addImage(file, caption);
      if (msg) {
        setError(msg);
        alert('上传失败：' + msg);
        return;
      }
    } catch (err) {
      const em = err instanceof Error ? err.message : String(err);
      setError('上传异常：' + em);
      alert('上传异常：' + em);
      return;
    }
    setFile(null);
    setCaption('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="page gallery-page">
      <h1 className="page-title">我喜欢的图片</h1>
      <p className="gallery-desc">直接把图片拖进来即可添加，也可以点击选择文件。</p>

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
            <p>{dragging ? '松开即可添加！' : '拖拽图片到这里，或点击选择文件'}</p>
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
            <img src={URL.createObjectURL(file)} alt="预览" />
            <span>{file.name}</span>
          </div>
        )}

        <input
          type="text"
          className="gallery-input gallery-input-sm"
          placeholder="给这张图命名（可选）"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
        />

        {error && <p className="gallery-error">{error}</p>}
        <button type="submit" className="btn btn-primary">添加图片</button>
      </form>
      )}

      {images.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon empty-icon-gallery" />
          <p>还没有收藏任何图片，快添加一张吧。</p>
        </div>
      ) : (
        <div className="gallery-grid">
          {images.map((img) => (
            <figure key={img.id} className="gallery-item">
              <div
                className="gallery-thumb"
                onClick={() => setZoomImage({ url: img.url, caption: img.caption })}
              >
                <img src={img.url} alt={img.caption || '图片'} loading="lazy" />
              </div>
              <figcaption className="gallery-caption">
                <span>{img.caption || '未命名图片'}</span>
                {isAdmin && (
                  <button
                    className="gallery-remove"
                    onClick={() => removeImage(img.id)}
                    title="移除这张图片"
                  >
                    移除
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
            <img src={zoomImage.url} alt={zoomImage.caption || '图片'} />
            {zoomImage.caption && <p className="zoom-caption">{zoomImage.caption}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
