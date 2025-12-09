import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  verticalListSortingStrategy,
  useSortable
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import "./App.css";

// THEME COLORS (primary: #3b82f6, success: #06b6d4, text: #111827, background: #f9fafb, surface: #ffffff)
const THEME = {
  primary: "#3b82f6",
  success: "#06b6d4",
  text: "#111827",
  background: "#f9fafb",
  surface: "#fff"
};

/**
 * Sortable Image Item for the collage grid
 */
function SortableImage({ id, src, alt, index, onRemove, selected, setSelected }) {
  const {attributes, listeners, setNodeRef, transform, transition, isDragging} = useSortable({id});
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 2 : 1,
    outline: selected ? `3px solid ${THEME.primary}` : "none",
    cursor: "grab",
    userSelect: "none",
    background: THEME.surface,
    borderRadius: 8,
    overflow: "hidden",
    position: "relative",
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      tabIndex={0}
      aria-label={`Photo ${index + 1}`}
      {...attributes}
      {...listeners}
      className="collage-photo-item"
      onClick={() => setSelected(index)}
      role="button"
    >
      <img
        src={src}
        alt={alt || `Photo ${index + 1}`}
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        draggable={false}
      />
      <button
        type="button"
        onClick={e => { e.stopPropagation(); onRemove(index); }}
        aria-label="Remove photo"
        className="remove-btn"
        tabIndex={0}
        style={{
          position: "absolute",
          top: 4, right: 4,
          background: THEME.error || "#ef4444",
          border: "none",
          color: "#fff",
          borderRadius: "50%",
          width: 24,
          height: 24,
          fontSize: 16,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer"
        }}
      >×</button>
    </div>
  );
}

/**
 * Returns a promise that resolves to a DataURL of the File object
 */
// PUBLIC_INTERFACE
function readImageFile(file) {
  /** Reads an image file and returns a data URL. */
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (ev) => resolve(ev.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * CollageMaker Main Component
 */
// PUBLIC_INTERFACE
function App() {
  /* Collage state */
  const [images, setImages] = useState([]); // Array of {id: string, src: dataURL, file: File}
  const [selected, setSelected] = useState(null); // Index of selected image for keyboard remove
  const [rows, setRows] = useState(2);
  const [cols, setCols] = useState(2);
  const [gap, setGap] = useState(8); // px
  const [canvasW, setCanvasW] = useState(800);
  const [canvasH, setCanvasH] = useState(600);
  const [bgColor, setBgColor] = useState(THEME.background);
  const [downloading, setDownloading] = useState(false);

  /* Drag-and-drop setup */
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor)
  );

  /* Upload handler */
  const handleUpload = async (e) => {
    const files = Array.from(e.target.files);
    // Remove any non-image files
    const imageFiles = files.filter(f => f.type.startsWith("image/"));
    const loaded = await Promise.all(
      imageFiles.map(async (file, idx) => ({
        id: `${file.name}-${Date.now()}-${idx}`,
        src: await readImageFile(file),
        file
      }))
    );
    setImages(prev => [...prev, ...loaded]);
    setSelected(loaded.length > 0 ? images.length : null);
    e.target.value = ""; // reset input
  };

  /* Remove image handler */
  const removeImage = (idxToRemove) => {
    setImages(images => images.filter((img, idx) => idx !== idxToRemove));
    setSelected(selected === idxToRemove ? null : selected);
  };

  /* Drag-and-drop reorder */
  const handleDragEnd = (evt) => {
    const {active, over} = evt;
    if (!over || active.id === over.id) return;
    const oldIndex = images.findIndex(img => img.id === active.id);
    const newIndex = images.findIndex(img => img.id === over.id);
    setImages(arrayMove(images, oldIndex, newIndex));
    setSelected(newIndex);
  };

  /* Canvas composition and download */
  const canvasRef = useRef();

  // Compute grid cell sizes and positions for preview
  const cellWidth = Math.floor((canvasW - gap * (cols - 1)) / cols);
  const cellHeight = Math.floor((canvasH - gap * (rows - 1)) / rows);

  // Draw preview to canvas whenever grid/images change
  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    // Fill background
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvasW, canvasH);

    for (let i = 0; i < rows * cols; ++i) {
      const imgObj = images[i];
      if (!imgObj) continue;
      const row = Math.floor(i / cols);
      const col = i % cols;
      const x = col * (cellWidth + gap);
      const y = row * (cellHeight + gap);
      // Draw with "cover" fit (centered, fills cell, preserves aspect ratio)
      const img = new window.Image();
      img.src = imgObj.src;
      img.onload = () => {
        // Aspect fill
        const arCell = cellWidth / cellHeight;
        const arImg = img.width / img.height;
        let drawW, drawH, dx, dy;
        if (arImg > arCell) {
          // Fill width
          drawH = cellHeight;
          drawW = Math.ceil(cellHeight * arImg);
        } else {
          // Fill height
          drawW = cellWidth;
          drawH = Math.ceil(cellWidth / arImg);
        }
        dx = x + (cellWidth - drawW) / 2;
        dy = y + (cellHeight - drawH) / 2;
        ctx.drawImage(img, dx, dy, drawW, drawH);
      };
    }
  }, [images, rows, cols, gap, canvasW, canvasH, bgColor, cellWidth, cellHeight]);

  // Download handler
  const handleDownload = () => {
    setDownloading(true);
    const url = canvasRef.current.toDataURL("image/png");
    const link = document.createElement("a");
    link.download = "collage.png";
    link.href = url;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => setDownloading(false), 600);
  };

  // Keyboard accessibility handler
  const handleKeyDown = (e) => {
    if (selected === null) return;
    if (e.key === "Delete" || e.key === "Backspace") {
      removeImage(selected);
    } else if(e.key === "ArrowLeft" && selected > 0) {
      setSelected(selected - 1);
    } else if(e.key === "ArrowRight" && selected < images.length - 1) {
      setSelected(selected + 1);
    }
  };

  // Responsive preview size
  const [previewW, setPreviewW] = useState(0);
  const previewContainerRef = useRef();
  useEffect(() => {
    const resize = () => {
      if (previewContainerRef.current) {
        setPreviewW(
          Math.min(
            previewContainerRef.current.offsetWidth,
            canvasW
          )
        );
      }
    };
    window.addEventListener("resize", resize);
    resize();
    return () => window.removeEventListener("resize", resize);
  }, [canvasW]);

  // THEME: light with custom colors
  useEffect(() => {
    document.body.style.background = THEME.background;
    document.body.style.color = THEME.text;
  }, []);

  // PUBLIC_INTERFACE
  return (
    <div className="collage-app" style={{minHeight: "100vh", background: THEME.background, color: THEME.text}}>
      <header className="collage-header" style={{
        fontWeight: 700,
        fontSize: 28,
        letterSpacing: "-.01em",
        background: THEME.surface,
        color: THEME.primary,
        borderBottom: `1.5px solid ${THEME.primary}22`,
        padding: "2.4rem 0 .8rem 0",
        textAlign: "center"
      }}>
        <span style={{fontWeight: 800, letterSpacing: "-.04em"}}>📸 Photo Collage Maker</span>
        <div style={{
          color: THEME.secondary,
          fontWeight: 400,
          fontSize: 18,
          paddingTop: ".5rem",
          paddingBottom: ".5rem"
        }}>
          Arrange, preview, and download your collage instantly.
        </div>
      </header>
      <main style={{maxWidth: 1024, margin: "0 auto", padding: "2rem 1rem 3rem 1rem"}}>
        {/* 1. Upload Controls */}
        <div style={{
          display: "flex",
          flexDirection: "row",
          flexWrap: "wrap",
          gap: 16,
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 24,
          background: THEME.surface,
          borderRadius: 8,
          boxShadow: "0 2px 10px #1112  ",
          padding: 16
        }}>
          <label htmlFor="image-upload" className="upload-label"
            style={{
              background: THEME.primary,
              color: "#fff",
              padding: "12px 22px",
              borderRadius: 8,
              fontWeight: 600,
              cursor: "pointer",
              transition: "background 0.2s",
              fontSize: 16,
              marginRight: 12
            }}>
            + Add Images
            <input
              id="image-upload"
              type="file"
              accept="image/*"
              multiple
              onChange={handleUpload}
              style={{display: "none"}}
            />
          </label>
          <span style={{fontSize: 15, color: THEME.text}}>
            {images.length === 0
              ? "No images yet."
              : `${images.length} image${images.length > 1 ? "s" : ""} loaded`}
          </span>
        </div>
        {/* 2. Control Panel */}
        <div className="collage-controls" style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 20,
          justifyContent: "center",
          alignItems: "center",
          marginBottom: 22,
          background: THEME.surface,
          padding: 14,
          borderRadius: 8,
        }}>
          <div className="ctrl-group">
            <label htmlFor="rows" style={ctrlLabelStyle}>Rows</label>
            <input id="rows" type="number" min={1} max={10} value={rows}
              style={ctrlInputStyle} onChange={e => setRows(Math.max(1, Math.min(10, Number(e.target.value))))} />
          </div>
          <div className="ctrl-group">
            <label htmlFor="cols" style={ctrlLabelStyle}>Columns</label>
            <input id="cols" type="number" min={1} max={10} value={cols}
              style={ctrlInputStyle} onChange={e => setCols(Math.max(1, Math.min(10, Number(e.target.value))))} />
          </div>
          <div className="ctrl-group">
            <label htmlFor="gap" style={ctrlLabelStyle}>Spacing (px)</label>
            <input id="gap" type="number" min={0} max={80} value={gap}
              style={ctrlInputStyle} onChange={e => setGap(Math.max(0, Math.min(80, Number(e.target.value))))} />
          </div>
          <div className="ctrl-group">
            <label htmlFor="canvasW" style={ctrlLabelStyle}>Width (px)</label>
            <input id="canvasW" type="number" min={200} max={1920} value={canvasW}
              style={ctrlInputStyle} onChange={e => setCanvasW(Number(e.target.value))} />
          </div>
          <div className="ctrl-group">
            <label htmlFor="canvasH" style={ctrlLabelStyle}>Height (px)</label>
            <input id="canvasH" type="number" min={200} max={1920} value={canvasH}
              style={ctrlInputStyle} onChange={e => setCanvasH(Number(e.target.value))} />
          </div>
          <div className="ctrl-group">
            <label htmlFor="bgColor" style={ctrlLabelStyle}>Background</label>
            <input id="bgColor" type="color" value={bgColor}
              style={{...ctrlInputStyle, width: 38, padding: 0}}
              onChange={e => setBgColor(e.target.value)} />
          </div>
        </div>
        {/* 3. Drag-drop Grid Preview */}
        <section
          ref={previewContainerRef}
          style={{
            width: "100%",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            minHeight: 340,
            paddingBottom: "1rem"
          }}
        >
          <div
            style={{
              width: previewW || canvasW,
              maxWidth: "100%",
              background: THEME.surface,
              border: `2px solid ${THEME.primary}22`,
              borderRadius: 16,
              boxShadow: "0 2px 20px #1111",
              padding: 16,
              position: "relative"
            }}
            tabIndex={0}
            aria-label="Collage preview grid"
            onKeyDown={handleKeyDown}
          >
            <div
              className="collage-grid"
              style={{
                width: canvasW,
                height: canvasH,
                display: "grid",
                gridTemplateRows: `repeat(${rows}, 1fr)`,
                gridTemplateColumns: `repeat(${cols}, 1fr)`,
                gap: gap,
                background: bgColor,
                position: "relative"
              }}>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext
                  items={images.map(img => img.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {Array.from({length: rows * cols}).map((_, idx) => {
                    const imgObj = images[idx];
                    if (!imgObj) {
                      return (
                        <div
                          key={`placeholder-${idx}`}
                          style={{
                            border: "1.5px dashed #d2d5d7",
                            borderRadius: 7,
                            background: "#f3f4f6",
                            width: "100%",
                            height: "100%",
                            minHeight: 60,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center"
                          }}
                          tabIndex={-1}
                        />
                      );
                    }
                    return (
                      <SortableImage
                        key={imgObj.id}
                        id={imgObj.id}
                        src={imgObj.src}
                        alt={imgObj.file?.name}
                        index={idx}
                        onRemove={removeImage}
                        selected={idx === selected}
                        setSelected={setSelected}
                      />
                    );
                  })}
                </SortableContext>
              </DndContext>
            </div>
            {/* Preview Canvas - visually hidden but used for download */}
            <canvas
              ref={canvasRef}
              width={canvasW}
              height={canvasH}
              style={{
                visibility: "hidden",
                position: "absolute",
                left: 0,
                top: 0,
                pointerEvents: "none",
                width: canvasW,
                height: canvasH
              }}
              aria-hidden
              tabIndex={-1}
            />
          </div>
        </section>
        {/* 4. Download button */}
        <div style={{textAlign: "center"}}>
          <button
            style={{
              background: downloading ? THEME.success : THEME.primary,
              color: "#fff",
              fontWeight: 700,
              fontSize: 18,
              padding: "10px 40px",
              border: "none",
              borderRadius: 8,
              boxShadow: "0 2px 12px #1113",
              margin: "0 auto",
              cursor: "pointer",
              outline: "none",
              transition: "background .18s"
            }}
            onClick={handleDownload}
            disabled={images.length === 0 || downloading}
            aria-disabled={images.length === 0 || downloading}
            tabIndex={0}
          >
            {downloading
              ? "Downloading..."
              : "Download Collage"}
          </button>
        </div>
      </main>
      {/* Footer: Accessibility and credits */}
      <footer style={{
        textAlign: "center",
        fontSize: 14,
        color: THEME.secondary,
        background: THEME.surface,
        padding: "1rem 0"
      }}>
        <span>
          Accessible controls • Use Tab and arrow keys to focus/remove images.<br/>
          &copy; {new Date().getFullYear()} Photo Collage Maker
        </span>
      </footer>
    </div>
  );
}

// -- UI Control Styles --
const ctrlLabelStyle = {
  display: "block",
  color: THEME.primary,
  marginBottom: 2,
  fontSize: 15,
  fontWeight: 600,
  letterSpacing: "-.01em"
};
const ctrlInputStyle = {
  border: `1.5px solid #d1d5db`,
  borderRadius: 6,
  padding: "3px 8px",
  fontSize: 15,
  width: 60
};

export default App;
