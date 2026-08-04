import { useEffect, useRef, useState, useCallback } from 'react';

interface Props {
  open: boolean;
  imageSrc: string | null;
  onCancel: () => void;
  onConfirm: (cropped: string) => void;
}

// 圆形裁剪视口尺寸（像素）
const VIEW_SIZE = 220;
const OUTPUT_SIZE = 200;

export function cropToCircle(imageSrc: string, offsetX: number, offsetY: number, scale: number, outSize = OUTPUT_SIZE): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = outSize;
      canvas.height = outSize;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('no ctx'));
      const cx = outSize / 2;
      const cy = outSize / 2;
      // 以“覆盖填满”为基准，scale 为额外放大，offset 为相对中心平移
      const baseFill = Math.max(outSize / img.width, outSize / img.height);
      const total = baseFill * scale;
      const drawW = img.width * total;
      const drawH = img.height * total;
      const drawX = cx - drawW / 2 + offsetX;
      const drawY = cy - drawH / 2 + offsetY;
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, outSize / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(img, drawX, drawY, drawW, drawH);
      ctx.restore();
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => reject(new Error('img load error'));
    img.src = imageSrc;
  });
}

export default function AvatarCropModal({ open, imageSrc, onCancel, onConfirm }: Props) {
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 });
  // 相对中心点的偏移量与缩放
  const stateRef = useRef({ x: 0, y: 0, scale: 1 });
  const draggingRef = useRef<{ startX: number; startY: number; ox: number; oy: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 读取图片尺寸并重置
  useEffect(() => {
    if (!open || !imageSrc) return;
    const img = new Image();
    img.onload = () => {
      setImgSize({ w: img.width, h: img.height });
    };
    img.src = imageSrc;
    stateRef.current = { x: 0, y: 0, scale: 1 };
  }, [open, imageSrc]);

  const applyDraw = useCallback((x: number, y: number, scale: number) => {
    const canvas = containerRef.current?.querySelector('canvas') as HTMLCanvasElement | null;
    const img = new Image();
    img.onload = () => {
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const size = VIEW_SIZE;
      canvas.width = size;
      canvas.height = size;
      ctx.clearRect(0, 0, size, size);
      const cx = size / 2;
      const cy = size / 2;
      const baseFill = Math.max(size / img.width, size / img.height);
      const total = baseFill * scale;
      const drawW = img.width * total;
      const drawH = img.height * total;
      const drawX = cx - drawW / 2 + x;
      const drawY = cy - drawH / 2 + y;
      ctx.save();
      // 图片裁到圆形内
      ctx.beginPath();
      ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
      ctx.clip();
      // 画一个半透明底，便于观察圆形边界
      ctx.fillStyle = 'rgba(91,168,216,0.15)';
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(img, drawX, drawY, drawW, drawH);
      ctx.restore();
    };
    img.src = imageSrc || '';
  }, [imageSrc]);

  useEffect(() => {
    if (open && imageSrc && imgSize.w) {
      applyDraw(stateRef.current.x, stateRef.current.y, stateRef.current.scale);
    }
  }, [open, imageSrc, imgSize, applyDraw]);

  if (!open || !imageSrc) return null;

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    draggingRef.current = { startX: e.clientX, startY: e.clientY, ox: stateRef.current.x, oy: stateRef.current.y };
    const move = (ev: MouseEvent) => {
      if (!draggingRef.current) return;
      const dx = ev.clientX - draggingRef.current.startX;
      const dy = ev.clientY - draggingRef.current.startY;
      const s = stateRef.current.scale;
      // 拖拽幅度随缩放适当放大一点，手感更跟手
      stateRef.current.x = draggingRef.current.ox + dx;
      stateRef.current.y = draggingRef.current.oy + dy;
      applyDraw(stateRef.current.x, stateRef.current.y, s);
    };
    const up = () => {
      draggingRef.current = null;
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    const ns = Math.min(6, Math.max(0.5, stateRef.current.scale * factor));
    stateRef.current.scale = ns;
    applyDraw(stateRef.current.x, stateRef.current.y, ns);
  };

  const onSlider = (v: number) => {
    stateRef.current.scale = v;
    applyDraw(stateRef.current.x, stateRef.current.y, v);
  };

  const confirm = async () => {
    try {
      const out = await cropToCircle(imageSrc, stateRef.current.x, stateRef.current.y, stateRef.current.scale);
      onConfirm(out);
    } catch {
      alert('图片处理失败，请重试');
    }
  };

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="avatar-crop-modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onCancel} aria-label="关闭">×</button>
        <h3 className="avatar-crop-title">调整头像</h3>
        <p className="avatar-crop-hint">拖动图片调整位置，滚动滚轮（或拖动滑块）缩放。</p>

        <div
          ref={containerRef}
          className="avatar-crop-view"
          onMouseDown={onMouseDown}
          onWheel={onWheel}
          style={{ cursor: 'grab' }}
        >
          <canvas width={VIEW_SIZE} height={VIEW_SIZE} />
          <div className="avatar-crop-ring" />
        </div>

        <input
          className="avatar-crop-range"
          type="range"
          min={0.5}
          max={6}
          step={0.01}
          value={stateRef.current.scale}
          onChange={(e) => onSlider(Number(e.target.value))}
        />

        <div className="avatar-crop-actions">
          <button className="btn btn-primary" onClick={confirm}>确定</button>
          <button className="btn" onClick={onCancel}>取消</button>
        </div>
      </div>
    </div>
  );
}
