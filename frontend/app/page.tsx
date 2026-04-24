"use client";
import { useRef, useState, useEffect, useCallback } from "react";

const API = "http://127.0.0.1:8000";

// ─── API helpers ────────────────────────────────────────────────────────────
async function uploadClips(files: FileList) {
  const fd = new FormData();
  Array.from(files).forEach((f) => fd.append("clips", f));
  const r = await fetch(`${API}/upload/`, { method: "POST", body: fd });
  return r.json();
}

async function uploadOutro(file: File) {
  const fd = new FormData();
  fd.append("clips", file);
  const r = await fetch(`${API}/uploadoutro/`, { method: "POST", body: fd });
  return r.json();
}

async function clearAll() {
  const r = await fetch(`${API}/clear/`, { method: "DELETE" });
  return r.json();
}

async function postTimestamps(timestamps: string[]) {
  const r = await fetch(`${API}/posttimestamps`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(timestamps),
  });
  return r.json();
}

async function editClips() {
  const r = await fetch(`${API}/editclips`, { method: "POST" });
  return r.json();
}

// ─── Types ───────────────────────────────────────────────────────────────────
type Page = "upload" | "trim" | "download";

interface ClipFile {
  file: File;
  url: string;
  duration: number;
  trimTo: number;
}

// ─── Formatters ──────────────────────────────────────────────────────────────
function fmt(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toFixed(2).padStart(5, "0")}`;
}

// ─── Page 1 – Upload ─────────────────────────────────────────────────────────
function UploadPage({
  onStart,
}: {
  onStart: (clips: File[], outro: File) => void;
}) {
  const clipsRef = useRef<HTMLInputElement>(null);
  const outroRef = useRef<HTMLInputElement>(null);
  const [clipNames, setClipNames] = useState<string[]>([]);
  const [outroName, setOutroName] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleStart = async () => {
    const clips = clipsRef.current?.files;
    const outro = outroRef.current?.files?.[0];
    if (!clips || clips.length === 0) return setError("Add at least one clip.");
    if (!outro) return setError("Add an outro.");
    setError("");
    setLoading(true);
    try {
      await clearAll();
      await uploadClips(clips);
      await uploadOutro(outro);
      onStart(Array.from(clips), outro);
    } catch (e) {
      setError("Upload failed – is the API running?");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page upload-page">
      <header>
        <div className="logo">
          <span className="logo-bracket">[</span>
          CLIPFORGE
          <span className="logo-bracket">]</span>
        </div>
        <p className="tagline">batch edit. trim. export.</p>
      </header>

      <main className="upload-grid">
        <section className="drop-zone clips-zone">
          <div className="zone-label">
            <span className="zone-num">01</span>
            <span>VIDEO CLIPS</span>
          </div>
          <label className="drop-label" htmlFor="clips-input">
            <div className="drop-icon">▤</div>
            <span>
              {clipNames.length
                ? `${clipNames.length} clip${clipNames.length > 1 ? "s" : ""} selected`
                : "Click or drag clips here"}
            </span>
            {clipNames.length > 0 && (
              <ul className="file-list">
                {clipNames.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            )}
          </label>
          <input
            id="clips-input"
            ref={clipsRef}
            type="file"
            multiple
            accept="video/*"
            onChange={(e) =>
              setClipNames(
                Array.from(e.target.files ?? []).map((f) => f.name)
              )
            }
          />
        </section>

        <section className="drop-zone outro-zone">
          <div className="zone-label">
            <span className="zone-num">02</span>
            <span>OUTRO</span>
          </div>
          <label className="drop-label" htmlFor="outro-input">
            <div className="drop-icon">◼</div>
            <span>{outroName || "Click to select outro"}</span>
          </label>
          <input
            id="outro-input"
            ref={outroRef}
            type="file"
            accept="video/*"
            onChange={(e) => setOutroName(e.target.files?.[0]?.name ?? "")}
          />
        </section>
      </main>

      {error && <p className="err">{error}</p>}

      <button
        className="cta-btn"
        onClick={handleStart}
        disabled={loading}
      >
        {loading ? (
          <span className="spinner" />
        ) : (
          <>START EDITING <span className="arrow">→</span></>
        )}
      </button>
    </div>
  );
}

// ─── Page 2 – Trim ────────────────────────────────────────────────────────────
function TrimPage({
  clips,
  onDone,
}: {
  clips: ClipFile[];
  onDone: () => void;
}) {
  const [idx, setIdx] = useState(0);
  const [trimValues, setTrimValues] = useState<number[]>(
    clips.map((c) => c.duration)
  );
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [playing, setPlaying] = useState(false);

  const clip = clips[idx];
  const trimTo = trimValues[idx];

  // pause & rewind when clip changes
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.pause();
    v.currentTime = 0;
    setCurrentTime(0);
    setPlaying(false);
  }, [idx]);

  // pause at trim point
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const handler = () => {
      setCurrentTime(v.currentTime);
      if (v.currentTime >= trimTo) {
        v.pause();
        setPlaying(false);
      }
    };
    v.addEventListener("timeupdate", handler);
    return () => v.removeEventListener("timeupdate", handler);
  }, [trimTo]);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (playing) {
      v.pause();
      setPlaying(false);
    } else {
      if (v.currentTime >= trimTo) v.currentTime = 0;
      v.play();
      setPlaying(true);
    }
  };

  const handleScrub = (val: number) => {
    const v = videoRef.current;
    if (v) v.currentTime = val;
    setCurrentTime(val);
  };

  const handleTrim = (val: number) => {
    setTrimValues((prev) => {
      const next = [...prev];
      next[idx] = val;
      return next;
    });
    // push playhead back if it's past new trim
    if (currentTime > val) handleScrub(val);
  };

  const handleFinish = async () => {
    setProcessing(true);
    setError("");
    try {
      await postTimestamps(trimValues.map(String));
      await editClips();
      onDone();
    } catch (e) {
      setError("Processing failed – check the API.");
      setProcessing(false);
    }
  };

  const progress = clip.duration > 0 ? (currentTime / clip.duration) * 100 : 0;
  const trimProgress = clip.duration > 0 ? (trimTo / clip.duration) * 100 : 100;

  return (
    <div className="page trim-page">
      <div className="trim-header">
        <div className="logo small">
          <span className="logo-bracket">[</span>CLIPFORGE<span className="logo-bracket">]</span>
        </div>
        <div className="clip-counter">
          {clips.map((_, i) => (
            <button
              key={i}
              className={`counter-dot ${i === idx ? "active" : ""} ${i < idx ? "done" : ""}`}
              onClick={() => setIdx(i)}
            >
              {i < idx ? "✓" : i + 1}
            </button>
          ))}
        </div>
      </div>

      <div className="trim-body">
        <div className="clip-title">
          <span className="clip-num">CLIP {idx + 1} / {clips.length}</span>
          <span className="clip-name">{clip.file.name}</span>
        </div>

        {/* Video preview */}
        <div className="video-wrap">
          <video
            ref={videoRef}
            src={clip.url}
            className="preview-video"
            onLoadedMetadata={(e) => {
              /* duration already known */
            }}
          />
          {/* trim curtain overlay */}
          <div
            className="trim-curtain"
            style={{ left: `${trimProgress}%` }}
          />
        </div>

        {/* Playhead scrubber */}
        <div className="scrubber-row">
          <span className="time-label">{fmt(currentTime)}</span>
          <div className="scrubber-track">
            {/* trim marker */}
            <div
              className="trim-marker"
              style={{ left: `${trimProgress}%` }}
            />
            <input
              type="range"
              className="scrubber"
              min={0}
              max={clip.duration}
              step={0.01}
              value={currentTime}
              onChange={(e) => handleScrub(parseFloat(e.target.value))}
            />
          </div>
          <span className="time-label">{fmt(clip.duration)}</span>
        </div>

        {/* Trim slider */}
        <div className="trim-row">
          <span className="trim-label">CUT AT</span>
          <div className="scrubber-track">
            <input
              type="range"
              className="scrubber trim-slider"
              min={0}
              max={clip.duration}
              step={0.01}
              value={trimTo}
              onChange={(e) => handleTrim(parseFloat(e.target.value))}
            />
          </div>
          <span className="trim-time">{fmt(trimTo)}</span>
        </div>

        {/* Controls */}
        <div className="controls-row">
          <button className="ctrl-btn play-btn" onClick={togglePlay}>
            {playing ? "⏸ PAUSE" : "▶ PLAY"}
          </button>

          <div className="nav-btns">
            {idx > 0 && (
              <button className="ctrl-btn" onClick={() => setIdx(idx - 1)}>
                ← PREV
              </button>
            )}
            {idx < clips.length - 1 ? (
              <button
                className="ctrl-btn next-btn"
                onClick={() => setIdx(idx + 1)}
              >
                NEXT →
              </button>
            ) : (
              <button
                className="ctrl-btn finish-btn"
                onClick={handleFinish}
                disabled={processing}
              >
                {processing ? <span className="spinner" /> : "PROCESS ALL →"}
              </button>
            )}
          </div>
        </div>
      </div>

      {error && <p className="err">{error}</p>}
    </div>
  );
}

// ─── Page 3 – Download ────────────────────────────────────────────────────────
function DownloadPage({ onReset }: { onReset: () => void }) {
  const [downloaded, setDownloaded] = useState(false);

  const handleDownload = () => {
    window.open(`${API}/downloadclips`, "_blank");
    setDownloaded(true);
  };

  return (
    <div className="page download-page">
      <div className="logo">
        <span className="logo-bracket">[</span>CLIPFORGE<span className="logo-bracket">]</span>
      </div>
      <div className="done-badge">✓</div>
      <h2 className="done-title">CLIPS READY</h2>
      <p className="done-sub">
        Your clips have been trimmed and the outro has been appended.
      </p>

      <button className="cta-btn download-btn" onClick={handleDownload}>
        ↓ DOWNLOAD ZIP
      </button>

      {downloaded && (
        <button className="cta-btn reset-btn" onClick={onReset}>
          ↺ START OVER
        </button>
      )}
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function Home() {
  const [page, setPage] = useState<Page>("upload");
  const [clips, setClips] = useState<ClipFile[]>([]);

  const handleStart = async (files: File[], _outro: File) => {
    // build ClipFile objects with object URLs + durations
    const resolved: ClipFile[] = await Promise.all(
      files.map(
        (f) =>
          new Promise<ClipFile>((res) => {
            const url = URL.createObjectURL(f);
            const v = document.createElement("video");
            v.src = url;
            v.onloadedmetadata = () =>
              res({ file: f, url, duration: v.duration, trimTo: v.duration });
          })
      )
    );
    setClips(resolved);
    setPage("trim");
  };

  const handleReset = () => {
    clips.forEach((c) => URL.revokeObjectURL(c.url));
    setClips([]);
    setPage("upload");
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Barlow+Condensed:wght@300;400;600;700;900&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        :root {
          --bg: #0a0a0c;
          --surface: #111116;
          --surface2: #1a1a22;
          --border: #2a2a38;
          --accent: #e8ff47;
          --accent2: #ff4766;
          --text: #e8e8f0;
          --muted: #5a5a72;
          --font-mono: 'Share Tech Mono', monospace;
          --font-body: 'Barlow Condensed', sans-serif;
        }

        html, body { height: 100%; background: var(--bg); color: var(--text); }

        .page {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 2rem;
          font-family: var(--font-body);
          position: relative;
          overflow: hidden;
        }

        /* noise texture overlay */
        .page::before {
          content: '';
          position: fixed;
          inset: 0;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E");
          pointer-events: none;
          z-index: 0;
        }

        .page > * { position: relative; z-index: 1; }

        /* ── Logo ── */
        .logo {
          font-family: var(--font-mono);
          font-size: 2.4rem;
          letter-spacing: 0.15em;
          color: var(--text);
          margin-bottom: 0.4rem;
        }
        .logo.small { font-size: 1.1rem; margin-bottom: 0; }
        .logo-bracket { color: var(--accent); }

        .tagline {
          font-family: var(--font-mono);
          font-size: 0.75rem;
          color: var(--muted);
          letter-spacing: 0.3em;
          text-transform: uppercase;
          margin-bottom: 3rem;
        }

        /* ── Upload page ── */
        .upload-page header { text-align: center; }

        .upload-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1.5rem;
          width: 100%;
          max-width: 760px;
          margin-bottom: 2rem;
        }

        .drop-zone {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 4px;
          padding: 0;
          position: relative;
          transition: border-color 0.2s;
        }
        .drop-zone:hover { border-color: var(--accent); }

        .zone-label {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.6rem 1rem;
          border-bottom: 1px solid var(--border);
          font-family: var(--font-mono);
          font-size: 0.7rem;
          letter-spacing: 0.2em;
          color: var(--muted);
        }
        .zone-num { color: var(--accent); }

        .drop-label {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.6rem;
          padding: 2rem 1.5rem;
          cursor: pointer;
          text-align: center;
          font-size: 0.9rem;
          color: var(--muted);
          min-height: 140px;
          justify-content: center;
        }

        .drop-icon {
          font-size: 2rem;
          color: var(--accent);
          line-height: 1;
        }

        .file-list {
          list-style: none;
          font-family: var(--font-mono);
          font-size: 0.65rem;
          color: var(--text);
          text-align: left;
          width: 100%;
          max-height: 80px;
          overflow-y: auto;
          margin-top: 0.3rem;
        }
        .file-list li {
          padding: 0.15rem 0;
          border-bottom: 1px solid var(--border);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        input[type="file"] { display: none; }

        /* ── CTA Button ── */
        .cta-btn {
          background: var(--accent);
          color: #0a0a0c;
          border: none;
          font-family: var(--font-mono);
          font-size: 1rem;
          letter-spacing: 0.15em;
          padding: 1rem 3rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 0.75rem;
          transition: transform 0.15s, box-shadow 0.15s;
          clip-path: polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px));
        }
        .cta-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 32px rgba(232,255,71,0.25);
        }
        .cta-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .cta-btn .arrow { font-size: 1.2rem; }

        .reset-btn {
          background: transparent;
          color: var(--muted);
          border: 1px solid var(--border);
          margin-top: 1rem;
          clip-path: none;
        }
        .reset-btn:hover { color: var(--text); border-color: var(--text); }

        /* ── Error ── */
        .err {
          color: var(--accent2);
          font-family: var(--font-mono);
          font-size: 0.75rem;
          margin-bottom: 1rem;
          letter-spacing: 0.1em;
        }

        /* ── Spinner ── */
        .spinner {
          width: 18px; height: 18px;
          border: 2px solid rgba(0,0,0,0.3);
          border-top-color: #000;
          border-radius: 50%;
          display: inline-block;
          animation: spin 0.7s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* ── Trim page ── */
        .trim-page {
          justify-content: flex-start;
          padding-top: 1.5rem;
        }

        .trim-header {
          width: 100%;
          max-width: 860px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.5rem;
          padding-bottom: 1rem;
          border-bottom: 1px solid var(--border);
        }

        .clip-counter {
          display: flex;
          gap: 0.5rem;
        }

        .counter-dot {
          width: 32px; height: 32px;
          border-radius: 50%;
          border: 1px solid var(--border);
          background: var(--surface);
          color: var(--muted);
          font-family: var(--font-mono);
          font-size: 0.7rem;
          cursor: pointer;
          transition: all 0.15s;
          display: flex; align-items: center; justify-content: center;
        }
        .counter-dot.active { border-color: var(--accent); color: var(--accent); }
        .counter-dot.done { background: var(--accent); color: #000; border-color: var(--accent); }

        .trim-body {
          width: 100%;
          max-width: 860px;
        }

        .clip-title {
          display: flex;
          align-items: baseline;
          gap: 1rem;
          margin-bottom: 1rem;
        }
        .clip-num {
          font-family: var(--font-mono);
          font-size: 0.7rem;
          color: var(--accent);
          letter-spacing: 0.2em;
        }
        .clip-name {
          font-size: 1.1rem;
          font-weight: 600;
          color: var(--text);
          letter-spacing: 0.05em;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          max-width: 480px;
        }

        /* ── Video preview ── */
        .video-wrap {
          position: relative;
          width: 100%;
          background: #000;
          border: 1px solid var(--border);
          border-radius: 4px;
          overflow: hidden;
          aspect-ratio: 16/9;
          margin-bottom: 1.2rem;
        }

        .preview-video {
          width: 100%; height: 100%;
          object-fit: contain;
          display: block;
        }

        .trim-curtain {
          position: absolute;
          top: 0; bottom: 0; right: 0;
          background: rgba(255, 71, 102, 0.25);
          border-left: 2px solid var(--accent2);
          pointer-events: none;
          transition: left 0.05s;
        }

        /* ── Scrubber ── */
        .scrubber-row, .trim-row {
          display: flex;
          align-items: center;
          gap: 1rem;
          margin-bottom: 0.8rem;
        }

        .time-label, .trim-time {
          font-family: var(--font-mono);
          font-size: 0.72rem;
          color: var(--muted);
          min-width: 62px;
          white-space: nowrap;
        }
        .trim-label {
          font-family: var(--font-mono);
          font-size: 0.65rem;
          letter-spacing: 0.2em;
          color: var(--accent2);
          min-width: 62px;
        }
        .trim-time { color: var(--accent2); text-align: right; }

        .scrubber-track {
          flex: 1;
          position: relative;
          height: 20px;
          display: flex;
          align-items: center;
        }

        .trim-marker {
          position: absolute;
          top: 0; bottom: 0;
          width: 2px;
          background: var(--accent2);
          pointer-events: none;
          transform: translateX(-50%);
          z-index: 2;
        }

        .scrubber {
          -webkit-appearance: none;
          appearance: none;
          width: 100%;
          height: 3px;
          background: var(--border);
          outline: none;
          cursor: pointer;
          border-radius: 2px;
          position: relative;
          z-index: 3;
        }
        .scrubber::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 14px; height: 14px;
          border-radius: 50%;
          background: var(--accent);
          cursor: pointer;
          border: none;
        }
        .trim-slider::-webkit-slider-thumb {
          background: var(--accent2);
        }
        .scrubber::-webkit-slider-runnable-track { background: transparent; }

        /* ── Controls ── */
        .controls-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-top: 1.2rem;
        }

        .nav-btns { display: flex; gap: 0.75rem; }

        .ctrl-btn {
          background: var(--surface2);
          color: var(--text);
          border: 1px solid var(--border);
          font-family: var(--font-mono);
          font-size: 0.8rem;
          letter-spacing: 0.12em;
          padding: 0.6rem 1.4rem;
          cursor: pointer;
          transition: all 0.15s;
          display: flex; align-items: center; gap: 0.4rem;
        }
        .ctrl-btn:hover:not(:disabled) { border-color: var(--text); }
        .ctrl-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .play-btn { border-color: var(--accent); color: var(--accent); }
        .play-btn:hover { background: var(--accent); color: #000; }
        .next-btn { border-color: var(--muted); }
        .finish-btn {
          border-color: var(--accent);
          color: var(--accent);
          background: rgba(232,255,71,0.05);
        }
        .finish-btn:hover:not(:disabled) { background: var(--accent); color: #000; }

        /* ── Download page ── */
        .download-page { text-align: center; gap: 1.2rem; }

        .done-badge {
          width: 80px; height: 80px;
          border-radius: 50%;
          background: var(--accent);
          color: #000;
          font-size: 2.2rem;
          display: flex; align-items: center; justify-content: center;
          margin: 0 auto;
          animation: pop 0.4s cubic-bezier(0.175,0.885,0.32,1.275);
        }
        @keyframes pop {
          from { transform: scale(0); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }

        .done-title {
          font-size: 2.5rem;
          font-weight: 900;
          letter-spacing: 0.2em;
          color: var(--text);
        }
        .done-sub {
          color: var(--muted);
          font-size: 1rem;
          letter-spacing: 0.05em;
          max-width: 360px;
        }

        .download-btn { font-size: 1.1rem; padding: 1.1rem 3.5rem; }
      `}</style>

      {page === "upload" && <UploadPage onStart={handleStart} />}
      {page === "trim" && (
        <TrimPage clips={clips} onDone={() => setPage("download")} />
      )}
      {page === "download" && <DownloadPage onReset={handleReset} />}
    </>
  );
}