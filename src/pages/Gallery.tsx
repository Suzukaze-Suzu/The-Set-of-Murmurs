import { useState, FormEvent } from 'react';
import { useGallery } from '../context/GalleryContext';

export default function Gallery() {
  const { images, addImage, removeImage } = useGallery();
  const [url, setUrl] = useState('');
  const [caption, setCaption] = useState('');
  const [error, setError] = useState('');
  const [zoomImage, setZoomImage] = useState<{ url: string; caption: string } | null>(null);

  const handleAdd = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = url.trim();
    if (!/^https?:\/\/.+/i.test(trimmed)) {
      setError('请输入以 http:// 或 https:// 开头的图片地址');
      return;
    }
    addImage(trimmed, caption);
    setUrl('');
    setCaption('');
    setError('');
  };

  return (
    <div className="page gallery-page">
      <h1 className="page-title">我喜欢的图片</h1>
      <p className="gallery-desc">
        收藏你喜欢的图片吧，可以粘贴任意网络图片链接。
      </p>

      <form className="gallery-form card" onSubmit={handleAdd}>
        <input
          type="text"
          className="gallery-input"
          placeholder="图片链接（http:// 或 https://）"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setError('');
          }}
        />
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
                <button
                  className="gallery-remove"
                  onClick={() => removeImage(img.id)}
                  title="移除这张图片"
                >
                  移除
                </button>
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
