// KT18.Charts — отрисовка графиков продаж на <canvas> без внешних библиотек.
// Публичный API: drawBarChart, drawLineChart, renderChart, disposeChart.

const states = new WeakMap();
const PAD = { left: 60, right: 16, top: 16, bottom: 36 };
const DEFAULTS = { accent: "#2563eb", unit: "", locale: "ru-RU", emptyText: "Нет данных" };
const FONT = "12px system-ui, -apple-system, 'Segoe UI', sans-serif";

function fmt(value, opts) {
    return new Intl.NumberFormat(opts.locale, { maximumFractionDigits: 1 }).format(value);
}

// «Красивая» верхняя граница оси и шаг сетки (1/2/5 × 10^n).
function niceScale(maxValue, tickCount = 5) {
    if (!(maxValue > 0)) return { max: 1, step: 0.2, ticks: 5 };
    const rawStep = maxValue / tickCount;
    const mag = Math.pow(10, Math.floor(Math.log10(rawStep)));
    const norm = rawStep / mag;
    const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag;
    const ticks = Math.ceil(maxValue / step);
    return { max: ticks * step, step, ticks };
}

// Подгоняет canvas под реальный размер и devicePixelRatio, очищает его.
function prepare(canvas) {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));

    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);

    const plot = {
        x: PAD.left,
        y: PAD.top,
        w: Math.max(1, rect.width - PAD.left - PAD.right),
        h: Math.max(1, rect.height - PAD.top - PAD.bottom)
    };
    // Цвет текста берём у страницы — график корректно выглядит и в тёмной теме.
    const color = getComputedStyle(canvas).color || "#333";
    return { ctx, w: rect.width, h: rect.height, plot, color };
}

function drawEmpty({ ctx, w, h, color }, opts) {
    ctx.font = FONT;
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.6;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(opts.emptyText, w / 2, h / 2);
    ctx.globalAlpha = 1;
}

// Сетка, подписи осей. Возвращает шкалу для расчёта высоты столбцов/точек.
function drawFrame({ ctx, plot, color }, labels, values, opts) {
    const scale = niceScale(Math.max(...values, 0));
    ctx.font = FONT;
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";

    for (let i = 0; i <= scale.ticks; i++) {
        const v = i * scale.step;
        const y = plot.y + plot.h - (v / scale.max) * plot.h;
        ctx.globalAlpha = 0.12;
        ctx.beginPath();
        ctx.moveTo(plot.x, y);
        ctx.lineTo(plot.x + plot.w, y);
        ctx.stroke();
        ctx.globalAlpha = 0.7;
        ctx.fillText(fmt(v, opts), plot.x - 8, y);
    }

    const slot = plot.w / labels.length;
    const every = Math.ceil(labels.length / Math.max(1, Math.floor(plot.w / 56)));
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    labels.forEach((label, i) => {
        if (i % every === 0) ctx.fillText(label, plot.x + slot * (i + 0.5), plot.y + plot.h + 10);
    });
    ctx.globalAlpha = 1;
    return scale;
}

function pathRoundRect(ctx, x, y, w, h, r) {
    if (typeof ctx.roundRect === "function") ctx.roundRect(x, y, w, h, r);
    else ctx.rect(x, y, w, h);
}

function drawTooltip({ ctx, w }, title, valueText, ax, ay) {
    ctx.font = FONT;
    const pad = 8;
    const tw = Math.max(ctx.measureText(title).width, ctx.measureText(valueText).width) + pad * 2;
    const th = 40;
    const x = Math.min(Math.max(ax - tw / 2, 4), Math.max(4, w - tw - 4));
    let y = ay - th - 10;
    if (y < 4) y = ay + 14;

    ctx.fillStyle = "rgba(20, 20, 30, 0.92)";
    ctx.beginPath();
    pathRoundRect(ctx, x, y, tw, th, 6);
    ctx.fill();

    ctx.fillStyle = "#fff";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.globalAlpha = 0.75;
    ctx.fillText(title, x + pad, y + 7);
    ctx.globalAlpha = 1;
    ctx.fillText(valueText, x + pad, y + 22);
}

const valueText = (v, opts) => `${fmt(v, opts)}${opts.unit ? " " + opts.unit : ""}`;

/** Столбчатая диаграмма. hover — индекс подсвеченного столбца (-1 — нет). */
export function drawBarChart(canvas, labels, values, options = {}, hover = -1) {
    const opts = { ...DEFAULTS, ...options };
    const view = prepare(canvas);
    if (!values.length) return drawEmpty(view, opts);

    const { ctx, plot } = view;
    const scale = drawFrame(view, labels, values, opts);
    const slot = plot.w / values.length;
    const barW = Math.min(slot * 0.62, 64);

    values.forEach((v, i) => {
        const bh = (v / scale.max) * plot.h;
        const x = plot.x + slot * i + (slot - barW) / 2;
        const y = plot.y + plot.h - bh;
        ctx.globalAlpha = hover === -1 || hover === i ? 1 : 0.55;
        ctx.fillStyle = opts.accent;
        ctx.beginPath();
        pathRoundRect(ctx, x, y, barW, bh, [4, 4, 0, 0]);
        ctx.fill();
    });
    ctx.globalAlpha = 1;

    if (hover >= 0 && hover < values.length) {
        const top = plot.y + plot.h - (values[hover] / scale.max) * plot.h;
        drawTooltip(view, labels[hover], valueText(values[hover], opts), plot.x + slot * (hover + 0.5), top);
    }
}

/** Линейный график с заливкой под линией. */
export function drawLineChart(canvas, labels, values, options = {}, hover = -1) {
    const opts = { ...DEFAULTS, ...options };
    const view = prepare(canvas);
    if (!values.length) return drawEmpty(view, opts);

    const { ctx, plot } = view;
    const scale = drawFrame(view, labels, values, opts);
    const slot = plot.w / values.length;
    const pts = values.map((v, i) => ({
        x: plot.x + slot * (i + 0.5),
        y: plot.y + plot.h - (v / scale.max) * plot.h
    }));

    // заливка
    ctx.globalAlpha = 0.14;
    ctx.fillStyle = opts.accent;
    ctx.beginPath();
    ctx.moveTo(pts[0].x, plot.y + plot.h);
    pts.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.lineTo(pts[pts.length - 1].x, plot.y + plot.h);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;

    // линия
    ctx.strokeStyle = opts.accent;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = "round";
    ctx.beginPath();
    pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.stroke();

    // маркеры
    pts.forEach((p, i) => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, i === hover ? 6 : 3.5, 0, Math.PI * 2);
        ctx.fillStyle = i === hover ? opts.accent : "#fff";
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.stroke();
    });

    if (hover >= 0 && hover < values.length) {
        drawTooltip(view, labels[hover], valueText(values[hover], opts), pts[hover].x, pts[hover].y);
    }
}

function paint(canvas) {
    const s = states.get(canvas);
    if (!s) return;
    (s.type === "line" ? drawLineChart : drawBarChart)(canvas, s.labels, s.values, s.options, s.hover);
}

/** Точка входа для Blazor: сохраняет данные, подписывается на мышь и ресайз, рисует. */
export function renderChart(canvas, type, labels, values, options = {}) {
    let s = states.get(canvas);
    if (!s) {
        s = { hover: -1 };
        s.onMove = e => {
            const rect = canvas.getBoundingClientRect();
            const n = s.values.length;
            const slot = (rect.width - PAD.left - PAD.right) / Math.max(1, n);
            const x = e.clientX - rect.left - PAD.left;
            const idx = x >= 0 && x < slot * n ? Math.floor(x / slot) : -1;
            if (idx !== s.hover) {
                s.hover = idx;
                canvas.style.cursor = idx >= 0 ? "pointer" : "default";
                paint(canvas);
            }
        };
        s.onLeave = () => {
            canvas.style.cursor = "default";
            if (s.hover !== -1) {
                s.hover = -1;
                paint(canvas);
            }
        };
        canvas.addEventListener("mousemove", s.onMove);
        canvas.addEventListener("mouseleave", s.onLeave);
        s.observer = new ResizeObserver(() => paint(canvas));
        s.observer.observe(canvas.parentElement ?? canvas);
        states.set(canvas, s);
    }
    Object.assign(s, { type, labels, values, options, hover: -1 });
    paint(canvas);
}

/** Снимает обработчики и наблюдатель — вызывается из DisposeAsync компонента. */
export function disposeChart(canvas) {
    const s = states.get(canvas);
    if (!s) return;
    canvas.removeEventListener("mousemove", s.onMove);
    canvas.removeEventListener("mouseleave", s.onLeave);
    s.observer.disconnect();
    states.delete(canvas);
}
