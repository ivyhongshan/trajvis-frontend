import React, { useEffect, useMemo, useState } from "react";

import { interpolatePlasma } from "d3-scale-chromatic";
import { interpolateRgb } from "d3-interpolate";
import { interpolateTurbo } from "d3-scale-chromatic";

const BACKEND_URL =
  "https://hliu-trajvis-backend-77662524617.us-central1.run.app";
const SIZE = 640;
const MARGIN = 24;

const COLOR_UNITS = { age: "year", egfr: "mL/min/1.73m²" };

// ===== 工具函数 =====
function normalizeToRect(points) {
  const xs = points.map((p) => p[0]),
    ys = points.map((p) => p[1]);
  const minX = Math.min(...xs),
    maxX = Math.max(...xs);
  const minY = Math.min(...ys),
    maxY = Math.max(...ys);
  const sx = 2 / Math.max(1e-12, maxX - minX);
  const sy = 2 / Math.max(1e-12, maxY - minY);
  const cx = (minX + maxX) / 2,
    cy = (minY + maxY) / 2;
  const aspect = Math.max(1e-12, (maxX - minX)) / Math.max(1e-12, (maxY - minY));
  return { cx, cy, sx, sy, aspect };
}

function baseXform(p, base) {
  return [(p[0] - base.cx) * base.sx, (p[1] - base.cy) * base.sy];
}
function mirrorY(p) {
  return [p[0], -p[1]];
}
function toPixel(p, plotW, plotH) {
  const [x, y] = p;
  const w = plotW - 2 * MARGIN,
    h = plotH - 2 * MARGIN;
  return [MARGIN + ((x + 1) / 2) * w, MARGIN + ((1 - (y + 1) / 2)) * h];
}


function getColormap(key) {
  if (key === "age") {
    // 🎨 Age: 黄 (#ffff33) → 深紫 (#3b0a45)
    const yellowToPurple = interpolateRgb("#ffff33", "#3b0a45");
    return (t) => {
      const gamma = 1.2; // <1 让黄色占比更大
      const tg = Math.pow(t, gamma);
      return yellowToPurple(tg);
    };
  } else if (key === "egfr") {
    // 🎨 eGFR: 蓝 (#2c7bb6) → 青绿 (#00ccbc) → 黄 (#ffff33)
    return (t) => {
      const gamma = 0.8; // >1 让高值黄色占比更大
      const tg = Math.pow(t, gamma);
      if (tg < 0.5) {
        return interpolateRgb("#2c7bb6", "#00ccbc")(tg * 2);
      } else {
        return interpolateRgb("#00ccbc", "#ffff33")((tg - 0.5) * 2);
      }
    };
  } else {
    return (t) => "#999";
  }
}


// ===== 主组件 =====
export default function UmapView({ selectedId }) {
  const [embedXY, setEmbedXY] = useState([]);
  const [ages, setAges] = useState([]);
  const [egfrs, setEgfrs] = useState([]);
  const [traj, setTraj] = useState([]);
  const [projPts, setProjPts] = useState([]);
  const [colorKey, setColorKey] = useState("age");

  // ---- 加载 embedding ----
  useEffect(() => {
    (async () => {
      const r = await fetch(`${BACKEND_URL}/api/umap?color=egfr`);
      const j = await r.json();
      if (Array.isArray(j.embed)) {
        setEmbedXY(j.embed.map((row) => [row[0], row[1]]));
        setAges(j.embed.map((row) => row[2]));
        setEgfrs(j.embed.map((row) => row[3]));
      }
      if (Array.isArray(j.traj)) setTraj(j.traj);
    })();
  }, []);

  // ---- 加载单个患者 ----
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${BACKEND_URL}/api/umap/${selectedId}`);
        const j = await r.json();
        const pts = Array.isArray(j.embed)
          ? j.embed.map((row) => [Number(row[0]), Number(row[1])])
          : [];
        setProjPts(pts.filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y)));
      } catch {
        setProjPts([]);
      }
    })();
  }, [selectedId]);

  // ---- 数据准备 ----
  const values = colorKey === "age" ? ages : egfrs;
  // const domain = colorKey === "age" ? [0, 100] : [0, 160];
  // const domain = colorKey === "age" ? [30, 100] : [45, 105];
  const domain = useMemo(() => {
  const v = values.filter(Number.isFinite);
    if (!v.length) {
      // 🟡 当没有有效值时，保持你原来的默认区间
      return colorKey === "age" ? [30, 100] : [45, 105];
    }

    // 🧮 排序数据
    const sorted = [...v].sort((a, b) => a - b);
    const n = sorted.length;

    // 🎯 使用 5% - 95% 分位区间，自动适应色域
    const q05 = sorted[Math.floor(0.05 * n)];
    const q95 = sorted[Math.floor(0.95 * n)];

    // 🧩 稍微扩一点边界，让视觉更自然
    const buffer = (q95 - q05) * 0.05;
    const vmin = q05 - buffer;
    const vmax = q95 + buffer;

    // ✅ 返回最终 domain
    return [vmin, vmax];
  }, [values, colorKey]);

  const cmap = getColormap(colorKey);

  const base = useMemo(
    () => (embedXY.length ? normalizeToRect(embedXY) : null),
    [embedXY]
  );

  const embedNorm = useMemo(() => {
    if (!base) return [];
    return embedXY.map((p) => mirrorY(baseXform(p, base)));
  }, [embedXY, base]);

  const trajNorm = useMemo(() => {
    if (!base) return [];
    return traj.map(([name, line]) => [
      name,
      (line || []).map((p) => mirrorY(baseXform(p, base))),
    ]);
  }, [traj, base]);

  const projNorm = useMemo(() => {
    if (!base) return [];
    return projPts.map((p) => mirrorY(baseXform(p, base)));
  }, [projPts, base]);

  // ---- 尺寸参数 ----
  const aspect = base?.aspect || 1;
  const plotW = SIZE;
  const plotH = SIZE / aspect;
  const cbGap = 12;
  const cbW = 14;
  const cbPad = 36;
  const svgW = plotW + cbGap + cbW + cbPad;
  const svgH = plotH;
  const innerH = svgH - 2 * MARGIN;
  const gradId = useMemo(
    () => `grad-${colorKey}-${Math.random().toString(36).slice(2)}`,
    [colorKey]
  );
  const clipId = useMemo(() => `clip-${Math.random().toString(36).slice(2)}`, []);
  const unit = COLOR_UNITS[colorKey] || "";

  // ---- 绘图 ----
  return (
    <section
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        padding: 16,
        background: "#fff",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 8,
        }}
      >
        <h2 style={{ margin: 0 }}>Trajectory View</h2>
        <label>
          <span style={{ marginRight: 8 }}>Color by:</span>
          <select
            value={colorKey}
            onChange={(e) => setColorKey(e.target.value)}
          >
            <option value="age">age</option>
            <option value="egfr">eGFR</option>
          </select>
        </label>
      </div>

      <svg
        style={{ width: "100%", height: "auto" }}
        viewBox={`0 0 ${svgW} ${svgH}`}
        preserveAspectRatio="xMidYMid meet"
      >
        <rect x="0" y="0" width={plotW} height={plotH} fill="#fafafa" />

        <defs>
          <clipPath id={clipId}>
            <rect x="0" y="0" width={plotW} height={plotH} />
          </clipPath>
          <linearGradient id={gradId} x1="0" y1="1" x2="0" y2="0">
            {Array.from({ length: 256 }).map((_, i) => {
              const t = i / 255;
              return (
                <stop key={i} offset={`${t * 100}%`} stopColor={cmap(t)} />
              );
            })}
          </linearGradient>
        </defs>

        {/* 点云 + 轨迹 */}
        <g clipPath={`url(#${clipId})`}>
          {embedNorm.map((p, i) => {
            const [px, py] = toPixel(p, plotW, plotH);
            const v = values[i];
            if (!Number.isFinite(v)) return null;
            const [vmin, vmax] = domain;
            const tRaw = (v - vmin) / Math.max(1e-12, vmax - vmin);
            const t = Math.pow((v - vmin) / Math.max(1e-12, vmax - vmin), 0.7);

            return (
              <circle
                key={i}
                cx={px}
                cy={py}
                r={1.0}
                fill={cmap(t)}
                opacity={0.45}   // ← 添加这一行
              />
            );
          })}

          {trajNorm.map(([name, line], idx) => {
            if (!line.length) return null;
            const stroke =
              name === "green"
                ? "#22c55e"
                : name === "blue"
                ? "#3b82f6"
                : "#c97a2b";
            const validLine = line
              .map((p) => toPixel(p, plotW, plotH))
              .filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));

            if (validLine.length < 2) return null; // 不足2个点就不画线

            const d = validLine
              .map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x} ${y}`)
              .join(" ");
            const mirroredPath = d.replace(
              /(-?\d+(?:\.\d+)?(?:e-?\d+)?)[ ,]+(-?\d+(?:\.\d+)?(?:e-?\d+)?)/gi,
              (_, x, y) => `${plotW - parseFloat(x)} ${plotH - parseFloat(y)}`
            );

            const OFFSET_X = 0;
            const OFFSET_Y = -100;

            return (
              <g key={idx} transform={`translate(${OFFSET_X}, ${OFFSET_Y})`}>
                <path
                  d={mirroredPath}
                  stroke={stroke}
                  strokeWidth={10}
                  opacity={0.5}
                  fill="none"
                />
              </g>
            );
          })}
        </g>

        {/* 红点（clip外） */}
        {projNorm.map((p, i) => {
          const [px, py] = toPixel(p, plotW, plotH);
          return (
            <g key={`pat_${i}`}>
              <circle cx={px} cy={py} r={6.5} fill="white" opacity={0.9} />
              <circle
                cx={px}
                cy={py}
                r={4.5}
                fill="red"
                stroke="white"
                strokeWidth={1.5}
              />
            </g>
          );
        })}

        {/* color bar */}
        <rect
          x={plotW + cbGap}
          y={MARGIN}
          width={cbW}
          height={innerH}
          fill={`url(#${gradId})`}
          stroke="#333"
          strokeWidth="0.5"
          rx="2"
        />
        <g fontSize="12">
          <text x={plotW + cbGap + cbW + 8} y={MARGIN + 4} dominantBaseline="hanging">
            {domain[1]}
          </text>
          <text
            x={plotW + cbGap + cbW + 8}
            y={MARGIN + innerH / 2}
            dominantBaseline="middle"
          >
            {(domain[0] + domain[1]) / 2}
          </text>
          <text
            x={plotW + cbGap + cbW + 5}
            y={MARGIN + innerH}
            dominantBaseline="ideographic"
          >
            {domain[0]}
          </text>

          <text
            x={plotW + cbGap + cbW + 38}
            y={MARGIN + innerH / 2}
            transform={`rotate(-90 ${plotW + cbGap + cbW + 33},${MARGIN + innerH / 2})`}
            textAnchor="middle"
          >
            {colorKey} ({unit})
          </text>
        </g>
      </svg>
    </section>
  );
}
