import React, { useEffect, useMemo, useRef, useState } from "react";

type TransitionKind =
  | "cut"
  | "fade"
  | "zoom"
  | "slide-left"
  | "slide-right"
  | "slide-up"
  | "slide-down"
  | "pan";

interface Slide {
  id: string;
  start: number;
  duration: number;
  imageUrl?: string | null;
  title?: string;
  subtitle?: string;
  transition?: TransitionKind;
  fitMode?: "contain" | "cover";
  zoom?: number; // 1 = оригинал, 1.2 = увеличено
  offsetX?: number; // -50..50 в % ширины
  offsetY?: number; // -50..50 в % высоты
}

interface AudioPlayerProps {
  src: string | null;
  currentTime: number;
  setCurrentTime: (t: number) => void;
  isPlaying: boolean;
  setIsPlaying: (v: boolean) => void;
  onDuration: (d: number) => void;
}

const formatTime = (seconds: number): string => {
  if (!isFinite(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });

const AudioPlayer: React.FC<AudioPlayerProps> = ({
  src,
  currentTime,
  setCurrentTime,
  isPlaying,
  setIsPlaying,
  onDuration,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (Math.abs(audio.currentTime - currentTime) > 0.25) {
      audio.currentTime = currentTime;
    }
  }, [currentTime]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !src) return;
    if (isPlaying) {
      audio
        .play()
        .catch(() => {
          setIsPlaying(false);
        });
    } else {
      audio.pause();
    }
  }, [isPlaying, src, setIsPlaying]);

  const handleTimeUpdate = () => {
    const audio = audioRef.current;
    if (!audio) return;
    setCurrentTime(audio.currentTime);
  };

  const handleLoadedMetadata = () => {
    const audio = audioRef.current;
    if (!audio) return;
    onDuration(audio.duration);
  };

  return (
    <div className="flex items-center gap-3 text-xs">
      <button
        className="px-3 py-1 rounded-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
        disabled={!src}
        onClick={() => setIsPlaying(!isPlaying)}
      >
        {isPlaying ? "Pause" : "Play"}
      </button>
      <span className="opacity-80">{formatTime(currentTime)}</span>
      <audio
        ref={audioRef}
        src={src ?? undefined}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
      />
    </div>
  );
};

const transitionStyles: Record<TransitionKind, string> = {
  cut: "",
  fade: "transition-opacity duration-700",
  zoom: "transition-transform duration-700 scale-[1.05]",
  "slide-left": "transition-transform duration-700 translate-x-1.5",
  "slide-right": "transition-transform duration-700 -translate-x-1.5",
  "slide-up": "transition-transform duration-700 translate-y-1.5",
  "slide-down": "transition-transform duration-700 -translate-y-1.5",
  pan: "transition-transform duration-[1200ms] scale-[1.02]",
};

const SlidePreview: React.FC<{ slide: Slide | null }> = ({ slide }) => {
  const transitionClass = slide?.transition
    ? transitionStyles[slide.transition]
    : transitionStyles.cut;

  const fitMode = slide?.fitMode ?? "contain";
  const zoom = slide?.zoom ?? 1;
  const offsetX = slide?.offsetX ?? 0;
  const offsetY = slide?.offsetY ?? 0;
  const transform = `translate(${offsetX / 2}%, ${offsetY / 2}%) scale(${zoom})`;

  return (
    <div className="w-full aspect-video bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden flex items-center justify-center relative">
      {!slide && (
        <div className="text-slate-500 text-sm">Нет активного слайда</div>
      )}
      {slide && (
        <div className={`w-full h-full relative ${transitionClass}`}>
          {slide.imageUrl && (
            <img
              src={slide.imageUrl}
              alt={slide.title ?? "slide"}
              className={`w-full h-full ${
                fitMode === "contain" ? "object-contain" : "object-cover"
              }`}
              style={{ transform, transformOrigin: "center" }}
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent pointer-events-none" />
          <div className="absolute left-6 right-6 bottom-6">
            {slide.title && (
              <h1 className="text-2xl md:text-3xl font-bold drop-shadow-lg">
                {slide.title}
              </h1>
            )}
            {slide.subtitle && (
              <p className="mt-1 text-xs md:text-sm text-slate-100 drop-shadow">
                {slide.subtitle}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

interface TimelineProps {
  slides: Slide[];
  duration: number;
  currentTime: number;
  onSeek: (t: number) => void;
  onSelectSlide: (id: string) => void;
}

const Timeline: React.FC<TimelineProps> = ({
  slides,
  duration,
  currentTime,
  onSeek,
  onSelectSlide,
}) => {
  const safeDuration = duration || 1;

  const handleClick: React.MouseEventHandler<HTMLDivElement> = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    onSeek(Math.max(0, Math.min(ratio * safeDuration, duration)));
  };

  return (
    <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3 flex flex-col gap-2">
      <div className="flex justify-between text-[11px] text-slate-400">
        <span>Timeline</span>
        <span>{formatTime(duration)}</span>
      </div>
      <div
        className="relative h-14 bg-slate-900 rounded-xl border border-slate-800 overflow-hidden cursor-pointer"
        onClick={handleClick}
      >
        {slides.map((s) => {
          const startRatio = s.start / safeDuration;
          const endRatio = (s.start + s.duration) / safeDuration;
          const left = `${startRatio * 100}%`;
          const width = `${Math.max((endRatio - startRatio) * 100, 1)}%`;
          return (
            <div
              key={s.id}
              className="absolute top-1.5 bottom-1.5 rounded-md bg-emerald-400/80 hover:bg-emerald-300/90 text-[10px] px-1 py-0.5 overflow-hidden whitespace-nowrap text-ellipsis"
              style={{ left, width }}
              onClick={(evt) => {
                evt.stopPropagation();
                onSelectSlide(s.id);
              }}
            >
              {s.title || "Slide"}
            </div>
          );
        })}
        <div
          className="absolute top-0 bottom-0 w-[2px] bg-rose-400 pointer-events-none"
          style={{ left: `${(currentTime / safeDuration) * 100}%` }}
        />
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [audioSrc, setAudioSrc] = useState<string | null>(null);
  const [audioDuration, setAudioDuration] = useState<number>(0);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);

  const [slides, setSlides] = useState<Slide[]>([]);
  const [selectedSlideId, setSelectedSlideId] = useState<string | null>(null);

  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [titleInput, setTitleInput] = useState<string>("");
  const [subtitleInput, setSubtitleInput] = useState<string>("");
  const [durationInput, setDurationInput] = useState<number>(4);
  const [bulkDuration, setBulkDuration] = useState<number>(4);

  const [isExporting, setIsExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState<string>("");

  const projectDuration = useMemo(() => {
    if (audioDuration) return audioDuration;
    const lastSlide = slides.reduce(
      (max, s) => Math.max(max, s.start + s.duration),
      0
    );
    return Math.max(lastSlide, 1);
  }, [audioDuration, slides]);

  useEffect(() => {
    if (!isPlaying || audioSrc) return;
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const delta = (now - last) / 1000;
      last = now;
      setCurrentTime((t) => {
        const next = Math.min(t + delta, projectDuration);
        if (next >= projectDuration) {
          setIsPlaying(false);
          return projectDuration;
        }
        return next;
      });
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [isPlaying, audioSrc, projectDuration]);

  useEffect(() => {
    setCurrentTime((t) => Math.min(t, projectDuration));
  }, [projectDuration]);

  const handleAudioFileChange: React.ChangeEventHandler<HTMLInputElement> = (
    e
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setAudioSrc(url);
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const handleImageFileChange: React.ChangeEventHandler<HTMLInputElement> = (
    e
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPendingImage(url);
  };

  const handleBulkImageChange: React.ChangeEventHandler<HTMLInputElement> = (
    e
  ) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    let nextStart = slides.length
      ? Math.max(...slides.map((s) => s.start + s.duration))
      : currentTime;
    const newSlides: Slide[] = files.map((file, idx) => {
      const url = URL.createObjectURL(file);
      const slide: Slide = {
        id: crypto.randomUUID(),
        start: nextStart,
        duration: bulkDuration || 4,
        imageUrl: url,
        title: `Кадр ${slides.length + idx + 1}`,
        subtitle: "Добавлено массовым импортом",
        transition: "fade",
        fitMode: "contain",
        zoom: 1,
        offsetX: 0,
        offsetY: 0,
      };
      nextStart += slide.duration;
      return slide;
    });
    setSlides((prev) => [...prev, ...newSlides]);
    setSelectedSlideId(newSlides[0].id);
  };

  const handleAddSlide = () => {
    if (!projectDuration) return;
    const newSlide: Slide = {
      id: crypto.randomUUID(),
      start: currentTime,
      duration: durationInput || 4,
      imageUrl: pendingImage || null,
      title: titleInput || "You're Sixteen",
      subtitle:
        subtitleInput || "You're beautiful and you're mine • birthday clip",
      transition: "fade",
      fitMode: "contain",
      zoom: 1,
      offsetX: 0,
      offsetY: 0,
    };

    setSlides((prev) => [...prev, newSlide]);
    setSelectedSlideId(newSlide.id);
  };

  const activeSlide = useMemo(() => {
    return (
      slides.find(
        (s) => currentTime >= s.start && currentTime < s.start + s.duration
      ) ?? null
    );
  }, [slides, currentTime]);

  const selectedSlide = useMemo(
    () => slides.find((s) => s.id === selectedSlideId) ?? null,
    [slides, selectedSlideId]
  );

  const handleUpdateSelected = (patch: Partial<Slide>) => {
    if (!selectedSlide) return;
    setSlides((prev) =>
      prev.map((s) => (s.id === selectedSlide.id ? { ...s, ...patch } : s))
    );
  };

  const handleDeleteSelected = () => {
    if (!selectedSlide) return;
    setSlides((prev) => prev.filter((s) => s.id !== selectedSlide.id));
    setSelectedSlideId(null);
  };

  const moveSlide = (id: string, direction: "up" | "down") => {
    setSlides((prev) => {
      const index = prev.findIndex((s) => s.id === id);
      if (index === -1) return prev;
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;
      const newSlides = [...prev];
      const [removed] = newSlides.splice(index, 1);
      newSlides.splice(targetIndex, 0, removed);
      return newSlides;
    });
  };

  const alignSequential = () => {
    setSlides((prev) => {
      let t = 0;
      return prev.map((s) => {
        const updated = { ...s, start: t };
        t += s.duration;
        return updated;
      });
    });
  };

  const drawSlideOnCanvas = (
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    slide: Slide,
    image: HTMLImageElement | null,
    progress: number
  ) => {
    ctx.fillStyle = "#020617";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const fadeIn = Math.min(1, progress / 0.2);
    const fadeOut = Math.min(1, (1 - progress) / 0.2);
    const visibility = slide.transition === "fade" ? Math.min(fadeIn, fadeOut) : 1;

    if (image) {
      const baseZoom = slide.zoom ?? 1;
      const transitionZoom = slide.transition === "zoom" ? 1.05 + progress * 0.08 : 1;
      const combinedZoom = baseZoom * transitionZoom;
      const fitMode = slide.fitMode ?? "contain";
      const iw = image.width;
      const ih = image.height;

      const ratio =
        fitMode === "contain"
          ? Math.min(canvas.width / iw, canvas.height / ih)
          : Math.max(canvas.width / iw, canvas.height / ih);

      const dw = iw * ratio * combinedZoom;
      const dh = ih * ratio * combinedZoom;

      const offsetX = clamp(slide.offsetX ?? 0, -50, 50);
      const offsetY = clamp(slide.offsetY ?? 0, -50, 50);
      const pxOffsetX = (canvas.width * offsetX) / 200;
      const pxOffsetY = (canvas.height * offsetY) / 200;

      let transitionOffsetX = 0;
      let transitionOffsetY = 0;
      if (slide.transition === "slide-left") {
        transitionOffsetX = canvas.width * (0.08 - progress * 0.08);
      } else if (slide.transition === "slide-right") {
        transitionOffsetX = -canvas.width * (0.08 - progress * 0.08);
      } else if (slide.transition === "slide-up") {
        transitionOffsetY = canvas.height * (0.08 - progress * 0.08);
      } else if (slide.transition === "slide-down") {
        transitionOffsetY = -canvas.height * (0.08 - progress * 0.08);
      } else if (slide.transition === "pan") {
        transitionOffsetX = canvas.width * 0.02 * Math.sin(progress * Math.PI);
        transitionOffsetY = canvas.height * 0.02 * Math.cos(progress * Math.PI);
      }

      ctx.save();
      ctx.globalAlpha = visibility;
      ctx.drawImage(
        image,
        (canvas.width - dw) / 2 + pxOffsetX + transitionOffsetX,
        (canvas.height - dh) / 2 + pxOffsetY + transitionOffsetY,
        dw,
        dh
      );
      ctx.restore();
    }

    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(0, canvas.height - 180, canvas.width, 180);
    ctx.fillStyle = "#ecfeff";
    ctx.font = "bold 38px Inter, system-ui, sans-serif";
    if (slide.title) {
      ctx.fillText(slide.title, 48, canvas.height - 80);
    }
    ctx.fillStyle = "rgba(226, 232, 240, 0.9)";
    ctx.font = "20px Inter, system-ui, sans-serif";
    if (slide.subtitle) {
      ctx.fillText(slide.subtitle, 48, canvas.height - 44);
    }
    ctx.restore();
  };

  const exportToVideo = async () => {
    if (!slides.length) {
      setExportMessage("Добавьте хотя бы один слайд перед экспортом.");
      return;
    }
    if (typeof MediaRecorder === "undefined" || typeof HTMLCanvasElement.prototype.captureStream !== "function") {
      setExportMessage("Экспорт недоступен в этом браузере: нет поддержки MediaRecorder/captureStream.");
      return;
    }

    setIsExporting(true);
    setExportMessage("Рендерим кадры и записываем WebM...");
    const canvas = document.createElement("canvas");
    canvas.width = 1280;
    canvas.height = 720;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setIsExporting(false);
      setExportMessage("Не удалось инициализировать canvas.");
      return;
    }

    const fps = 30;
    const videoStream = canvas.captureStream(fps);
    let combinedStream: MediaStream = videoStream;
    let audioCleanup: (() => void) | null = null;

    if (audioSrc) {
      const audio = new Audio(audioSrc);
      const audioContext = new AudioContext();
      const source = audioContext.createMediaElementSource(audio);
      const destination = audioContext.createMediaStreamDestination();
      source.connect(destination);
      source.connect(audioContext.destination);
      combinedStream = new MediaStream([
        ...videoStream.getVideoTracks(),
        ...destination.stream.getAudioTracks(),
      ]);
      audio.play();
      audioCleanup = () => {
        audio.pause();
        audioContext.close();
      };
    }

    const recorder = new MediaRecorder(combinedStream, {
      mimeType: "video/webm;codecs=vp9,opus",
      videoBitsPerSecond: 5_000_000,
    });
    const chunks: BlobPart[] = [];
    recorder.ondataavailable = (evt) => {
      if (evt.data.size > 0) chunks.push(evt.data);
    };

    const recordingPromise = new Promise<Blob>((resolve) => {
      recorder.onstop = () => {
        audioCleanup?.();
        resolve(new Blob(chunks, { type: "video/webm" }));
      };
    });

    recorder.start();

    const loadedImages = await Promise.all(
      slides.map((s) => (s.imageUrl ? loadImage(s.imageUrl) : Promise.resolve(null)))
    );

    for (let i = 0; i < slides.length; i += 1) {
      const slide = slides[i];
      const image = loadedImages[i];
      const frames = Math.max(1, Math.round(slide.duration * fps));
      for (let frame = 0; frame < frames; frame += 1) {
        const progress = frames === 1 ? 1 : frame / (frames - 1);
        drawSlideOnCanvas(ctx, canvas, slide, image, progress);
        await new Promise((resolve) => setTimeout(resolve, 1000 / fps));
      }
      setExportMessage(`Рендерим: ${(i + 1)}/${slides.length} кадров`);
    }

    recorder.stop();
    const blob = await recordingPromise;
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "slideshow.webm";
    anchor.click();
    setExportMessage("Готово! Файл сохранён как slideshow.webm.");
    setIsExporting(false);
  };

  return (
    <div className="min-h-screen flex flex-col text-slate-100">
      <header className="border-b border-slate-900 px-4 py-3 flex items-center justify-between backdrop-blur bg-slate-950/60 sticky top-0 z-10">
        <div>
          <h1 className="text-base font-bold tracking-tight">Гибкий редактор слайд-шоу</h1>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Фото → переходы → музыка → WebM. Всё прямо в браузере.
          </p>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-slate-400">
          <span className="px-2 py-1 rounded-full bg-slate-900 border border-slate-800">
            {slides.length} кадров
          </span>
          <span className="px-2 py-1 rounded-full bg-slate-900 border border-slate-800">
            Длительность: {formatTime(projectDuration)}
          </span>
          <button
            onClick={() => setIsPlaying((v) => !v)}
            className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-500 text-slate-950 font-semibold hover:bg-emerald-400 transition"
          >
            {isPlaying ? "⏸ Пауза" : "▶ Предпросмотр"}
          </button>
        </div>
      </header>

      <main className="flex-1 p-4 md:p-6 max-w-6xl w-full mx-auto flex flex-col gap-4">
        <div className="grid gap-4 lg:grid-cols-[2fr,1fr] items-start">
          <div className="flex flex-col gap-3">
            <SlidePreview slide={activeSlide ?? selectedSlide} />
            <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-3 flex flex-col gap-2 shadow-xl shadow-emerald-500/5">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsPlaying((v) => !v)}
                    className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500 text-slate-950 font-semibold hover:bg-emerald-400"
                  >
                    {isPlaying ? "⏸ Пауза" : "▶ Плей"}
                  </button>
                  <button
                    onClick={() => setCurrentTime(0)}
                    className="px-3 py-1 rounded-full bg-slate-900 border border-slate-800 hover:border-emerald-400"
                  >
                    В начало
                  </button>
                  {activeSlide && (
                    <button
                      onClick={() => setCurrentTime(activeSlide.start)}
                      className="px-3 py-1 rounded-full bg-slate-900 border border-slate-800 hover:border-emerald-400"
                    >
                      К активному кадру
                    </button>
                  )}
                </div>
                <span className="text-[11px] text-slate-400">
                  {formatTime(currentTime)} / {formatTime(projectDuration)}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={Math.max(projectDuration, 0.1)}
                step={0.05}
                value={currentTime}
                onChange={(e) => setCurrentTime(Number(e.target.value))}
                className="accent-emerald-400"
              />
            </div>
          </div>

          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 flex flex-col gap-3 shadow-xl shadow-emerald-500/5">
            <section className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold">Шаг 1. Загрузите песню</h2>
              <input
                type="file"
                accept="audio/*"
                onChange={handleAudioFileChange}
                className="text-xs file:mr-2 file:px-2 file:py-1 file:rounded-full file:border-0 file:bg-emerald-500 file:text-slate-950 file:text-xs file:font-semibold hover:file:bg-emerald-400"
              />
              <AudioPlayer
                src={audioSrc}
                currentTime={currentTime}
                setCurrentTime={setCurrentTime}
                isPlaying={isPlaying}
                setIsPlaying={setIsPlaying}
                onDuration={setAudioDuration}
              />
              <p className="text-[11px] text-slate-500">
                Лучше использовать оригинал: "You're Sixteen (You're Beautiful and You're Mine)".
              </p>
            </section>

            <div className="h-px bg-slate-800" />

            <section className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold">Шаг 2. Добавьте слайд в текущий момент</h2>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageFileChange}
                className="text-xs mb-1 file:mr-2 file:px-2 file:py-1 file:rounded-full file:border-0 file:bg-sky-500 file:text-slate-950 file:text-xs file:font-semibold hover:file:bg-sky-400"
              />
              <label className="text-[11px] flex flex-col gap-1">
                Заголовок
                <input
                  type="text"
                  value={titleInput}
                  onChange={(e) => setTitleInput(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs"
                  placeholder="Happy Sweet Sixteen"
                />
              </label>
              <label className="text-[11px] flex flex-col gap-1">
                Подзаголовок
                <input
                  type="text"
                  value={subtitleInput}
                  onChange={(e) => setSubtitleInput(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs"
                  placeholder="You're beautiful and you're mine"
                />
              </label>
              <label className="text-[11px] flex flex-col gap-1">
                Длительность (сек)
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={durationInput}
                  onChange={(e) => setDurationInput(Number(e.target.value) || 1)}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs w-20"
                />
              </label>
              <button
                onClick={handleAddSlide}
                className="mt-1 inline-flex items-center justify-center px-3 py-1.5 rounded-full bg-emerald-500 hover:bg-emerald-600 text-xs font-semibold text-slate-950 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Добавить слайд в {formatTime(currentTime)}
              </button>
            </section>

            <div className="h-px bg-slate-800" />

            <section className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold">Массовый импорт</h2>
              <p className="text-[11px] text-slate-500">
                Выберите сразу несколько изображений. Кадры автоматически встанут друг за другом.
              </p>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleBulkImageChange}
                className="text-xs mb-1 file:mr-2 file:px-2 file:py-1 file:rounded-full file:border-0 file:bg-purple-500 file:text-slate-950 file:text-xs file:font-semibold hover:file:bg-purple-400"
              />
              <label className="text-[11px] flex items-center gap-2">
                Длительность для пакета
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={bulkDuration}
                  onChange={(e) => setBulkDuration(Number(e.target.value) || 1)}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs w-20"
                />
              </label>
            </section>

            {selectedSlide && (
              <>
                <div className="h-px bg-slate-800" />
                <section className="flex flex-col gap-2">
                  <h2 className="text-sm font-semibold">Выбранный слайд</h2>
                  <p className="text-[11px] text-slate-400">
                    start: {formatTime(selectedSlide.start)} • duration: {selectedSlide.duration.toFixed(1)}s
                  </p>
                  <label className="text-[11px] flex flex-col gap-1">
                    Старт (сек)
                    <input
                      type="number"
                      min={0}
                      step={0.1}
                      value={selectedSlide.start}
                      onChange={(e) =>
                        handleUpdateSelected({ start: Number(e.target.value) || 0 })
                      }
                      className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs w-24"
                    />
                  </label>
                  <button
                    onClick={() => setCurrentTime(selectedSlide.start)}
                    className="inline-flex items-center justify-start text-left px-3 py-1 rounded-lg bg-slate-900 border border-slate-800 text-[11px] font-medium hover:border-emerald-400"
                  >
                    Перейти к началу кадра
                  </button>
                  <label className="text-[11px] flex flex-col gap-1">
                    Заголовок
                    <input
                      type="text"
                      value={selectedSlide.title ?? ""}
                      onChange={(e) => handleUpdateSelected({ title: e.target.value })}
                      className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs"
                    />
                  </label>
                  <label className="text-[11px] flex flex-col gap-1">
                    Подзаголовок
                    <input
                      type="text"
                      value={selectedSlide.subtitle ?? ""}
                      onChange={(e) => handleUpdateSelected({ subtitle: e.target.value })}
                      className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs"
                    />
                  </label>
                  <label className="text-[11px] flex flex-col gap-1">
                    Длительность (сек)
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={selectedSlide.duration}
                      onChange={(e) =>
                        handleUpdateSelected({
                          duration: Number(e.target.value) || 1,
                        })
                      }
                      className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs w-20"
                    />
                  </label>
                  <label className="text-[11px] flex flex-col gap-1">
                    Переход
                    <select
                      value={selectedSlide.transition ?? "cut"}
                      onChange={(e) =>
                        handleUpdateSelected({
                          transition: e.target.value as Slide["transition"],
                        })
                      }
                      className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs w-full"
                    >
                      <option value="cut">Мгновенный (cut)</option>
                      <option value="fade">Плавное появление (fade)</option>
                      <option value="zoom">Лёгкий зум (zoom)</option>
                      <option value="slide-left">Сдвиг слева</option>
                      <option value="slide-right">Сдвиг справа</option>
                      <option value="slide-up">Сдвиг снизу</option>
                      <option value="slide-down">Сдвиг сверху</option>
                      <option value="pan">Плавная прогулка (pan)</option>
                    </select>
                  </label>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <label className="flex flex-col gap-1">
                      Режим кадра
                      <select
                        value={selectedSlide.fitMode ?? "contain"}
                        onChange={(e) =>
                          handleUpdateSelected({
                            fitMode: e.target.value as Slide["fitMode"],
                          })
                        }
                        className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs w-full"
                      >
                        <option value="contain">Вписать (без обрезки)</option>
                        <option value="cover">Заполнить кадр</option>
                      </select>
                    </label>
                    <label className="flex flex-col gap-1">
                      Зум
                      <input
                        type="range"
                        min={0.5}
                        max={2}
                        step={0.01}
                        value={selectedSlide.zoom ?? 1}
                        onChange={(e) =>
                          handleUpdateSelected({
                            zoom: Number(e.target.value),
                          })
                        }
                        className="accent-emerald-400"
                      />
                      <span className="text-[10px] text-slate-400">
                        {((selectedSlide.zoom ?? 1) * 100).toFixed(0)}%
                      </span>
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <label className="flex flex-col gap-1">
                      Смещение X
                      <input
                        type="range"
                        min={-50}
                        max={50}
                        step={1}
                        value={selectedSlide.offsetX ?? 0}
                        onChange={(e) =>
                          handleUpdateSelected({
                            offsetX: Number(e.target.value),
                          })
                        }
                        className="accent-emerald-400"
                      />
                      <span className="text-[10px] text-slate-400">
                        {selectedSlide.offsetX?.toFixed(0) ?? 0}%
                      </span>
                    </label>
                    <label className="flex flex-col gap-1">
                      Смещение Y
                      <input
                        type="range"
                        min={-50}
                        max={50}
                        step={1}
                        value={selectedSlide.offsetY ?? 0}
                        onChange={(e) =>
                          handleUpdateSelected({
                            offsetY: Number(e.target.value),
                          })
                        }
                        className="accent-emerald-400"
                      />
                      <span className="text-[10px] text-slate-400">
                        {selectedSlide.offsetY?.toFixed(0) ?? 0}%
                      </span>
                    </label>
                  </div>
                  <button
                    onClick={handleDeleteSelected}
                    className="mt-1 inline-flex items-center justify-center px-3 py-1.5 rounded-full bg-rose-500 hover:bg-rose-600 text-xs font-semibold text-slate-950"
                  >
                    Удалить слайд
                  </button>
                </section>
              </>
            )}

            {slides.length > 0 && (
              <>
                <div className="h-px bg-slate-800" />
                <section className="flex flex-col gap-2">
                  <h2 className="text-sm font-semibold">Список кадров</h2>
                  <p className="text-[11px] text-slate-500">
                    Управляйте порядком, длительностью и стартом кадра.
                  </p>
                  <div className="flex flex-col gap-1 max-h-40 overflow-auto pr-1">
                    {slides.map((s, idx) => (
                      <div
                        key={s.id}
                        className={`flex items-center justify-between text-[11px] px-2 py-1 rounded-lg border cursor-pointer ${
                          s.id === selectedSlideId
                            ? "border-emerald-400 bg-emerald-500/10"
                            : "border-slate-800 bg-slate-900"
                        }`}
                        onClick={() => setSelectedSlideId(s.id)}
                      >
                        <div className="flex flex-col">
                          <span className="font-medium">#{idx + 1} {s.title || "Без названия"}</span>
                          <span className="text-slate-400">
                            {formatTime(s.start)} • {s.duration.toFixed(1)}s
                          </span>
                        </div>
                        <div className="flex gap-1">
                          <button
                            className="px-2 py-0.5 rounded-full bg-slate-800 text-[10px] disabled:opacity-40"
                            disabled={idx === 0}
                            onClick={(e) => {
                              e.stopPropagation();
                              moveSlide(s.id, "up");
                            }}
                          >
                            ↑
                          </button>
                          <button
                            className="px-2 py-0.5 rounded-full bg-slate-800 text-[10px] disabled:opacity-40"
                            disabled={idx === slides.length - 1}
                            onClick={(e) => {
                              e.stopPropagation();
                              moveSlide(s.id, "down");
                            }}
                          >
                            ↓
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={alignSequential}
                      className="inline-flex items-center justify-center px-3 py-1.5 rounded-full bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-100"
                    >
                      Выровнять начала по очереди
                    </button>
                    <button
                      onClick={exportToVideo}
                      disabled={isExporting}
                      className="inline-flex items-center justify-center px-3 py-1.5 rounded-full bg-emerald-500 hover:bg-emerald-600 text-xs font-semibold text-slate-950 disabled:opacity-50"
                    >
                      {isExporting ? "Экспорт..." : "Экспорт в WebM"}
                    </button>
                  </div>
                  {exportMessage && (
                    <p className="text-[11px] text-slate-400">{exportMessage}</p>
                  )}
                </section>
              </>
            )}
          </div>
        </div>

        <Timeline
          slides={slides}
          duration={projectDuration}
          currentTime={currentTime}
          onSeek={(t) => setCurrentTime(t)}
          onSelectSlide={(id) => setSelectedSlideId(id)}
        />
      </main>
    </div>
  );
};

export default App;
