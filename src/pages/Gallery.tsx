import { useState, FormEvent, useRef } from 'react';
import { useGallery } from '../context/GalleryContext';
import { useAuth } from '../context/AuthContext';

export default function Gallery() {
  const { images, addImage, removeImage } = useGallery();
  const { isAdmin } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState('');
  const [error, setError] = useState('');
  const [zoomImage, setZoomImage] = useState<{ url: string; caption: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError('请选择要上传的图片文件');
      return;
    }
    setError('');
    const msg = await addImage(file, caption);
    if (msg) {
      setError(msg);
      return;
    }
    setFile(null);
    setCaption('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="page gallery-page">
      <h1 className="page-title">我喜欢的图片</h1>
      <p className="gallery-desc">
        收藏你喜欢的图片吧，可以粘贴任意网络图片链接。
      </p>

      {isAdmin && (
      <form className="gallery-form card" onSubmit={handleAdd}>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="gallery-input"
          onChange={(e) => {
            const f = e.target.files?.[0] || null;
            setFile(f);
            setError('');
          }}
        />
        {file && (
          <div className="gallery-file-preview">
            <img src={URL.createObjectURL(file)} alt="预览" />
            <span>{file.name}</span>
          </div>
        )}
        <input
          type="text"
          className="gallery-input gallery-input-sm"
          placeholder="备注（可选）"
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

