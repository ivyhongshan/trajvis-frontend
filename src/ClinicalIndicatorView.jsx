// ClinicalIndicatorView.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";

const BACKEND_URL =
  "https://hliu-trajvis-backend-77662524617.us-central1.run.app";
// const PATIENT_ID = 42747;

// ---- 颜色（与全站一致）----
const COLORS = {
  // 前景：点位状态
  normal:   "#6b7280",   // 灰
  above:    "#8b5cf6",   // 紫
  under:    "#ef4444",   // 红
  gridEven: "#f8fafc",
  gridOdd:  "#eef2f7",

  // 背景：分型底色
  fast:     "#F28E2B",   // Fast CKD
  ckd:      "#4E79A7",   // CKD
  healthy:  "#59A14F",   // Healthy
};

// ---- 正常范围（与你现有一致）----
const NORMAL_RANGE = {
  EGFR:[60, 200],
  TBIL: [0.1, 1.2],
  BP_DIASTOLIC: [60, 80],
  BP_SYSTOLIC: [90, 120],
  WT: [90, 220],
  HT: [57, 78],
  CHOLESTEROL: [50, 200],
  CREATINE_KINASE: [22, 198],
  HEMOGLOBIN: [11.6, 17.2],
  INR: [0.8, 1.1],
  ALT_SGPT: [7, 56],
  AST_SGOT: [8, 45],
  ALK: [44, 147],
  HDL: [40, 100],
  LDL: [40, 100],
  TRIGLYCERIDES: [20, 150],
  HBA1C: [4, 6.5],
  TROPONIN: [0, 0.04],
};

const prettyConcept = (c) => {
  const map = {
    EGFR: "eGFR",
    BP_SYSTOLIC: "BP Systolic",
    BP_DIASTOLIC: "BP Diastolic",
    ALT_SGPT: "ALT SGPT",
    AST_SGOT: "AST SGOT",
    HDL: "High-Density Lipoprotein",
    LDL: "Low-Density Lipoprotein",
    TRIGLYCERIDES: "Triglycerides",
    HBA1C: "Hemoglobin A1C",
    TBIL: "Total Bilirubin",
    ALK: "Alkaline Phosphatase",
    WT: "Weight",
    HT: "Height",
    INR: "INR",
    HEMOGLOBIN: "Hemoglobin",
    TROPONIN: "Troponin Test",
    CREATINE_KINASE: "Creatine kinase",
  };
  return map[c] || c.replaceAll("_", " ").replace(/\b\w/g, m => m.toUpperCase());
};

// 小工具
const safeParse = (s) => { try { return JSON.parse(s); } catch { return s; } };
const normalize = (field) => {
  if (!field) return [];
  if (Array.isArray(field)) return field.map(x => (typeof x === "string" ? safeParse(x) : x));
  if (typeof field === "string") return normalize(safeParse(field));
  if (typeof field === "object") return [field];
  return [];
};

// 监听容器宽度
function useContainerWidth() {
  const ref = useRef(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver((entries) => {
      const el = entries[0]?.contentRect;
      if (el) setW(Math.max(0, Math.floor(el.width)));
    });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

// export default function ClinicalIndicatorView({ reusePatient }) {
export default function ClinicalIndicatorView({ reusePatient, selectedId }) {
  const [patient, setPatient]   = useState(reusePatient || null);
  const [loading, setLoading]   = useState(!reusePatient);
  // 新增：分型概率（来自 /api/analysis/:id）
  const [ageProbs, setAgeProbs] = useState([]); // [{age:int, key:'fast'|'ckd'|'healthy'}]

  useEffect(() => {
    (async () => {
      setPatient(null);
      setAgeProbs([]);
      if (reusePatient && reusePatient.demo) {
        setPatient(reusePatient);
        return;
      }
      if (!selectedId) return;
      setLoading(true);
      try {
        const r = await fetch(`${BACKEND_URL}/api/patient/${selectedId}`);
        const json = await r.json();
        json.records = normalize(json.records);
        setPatient(json);
      } catch (e) {
        console.error("load patient for indicator failed", e);
        setPatient(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [reusePatient, selectedId]);

  useEffect(() => {
    if (!selectedId) return;
    (async () => {
      try {
        const j = await fetch(`${BACKEND_URL}/api/analysis/${selectedId}`).then(r=>r.json());
        const xs = (j?.x_range || []).map(Number);
        const gp = (j?.green_poss || []).map(Number);
        const bp = (j?.blue_poss  || []).map(Number);
        const op = (j?.orange_poss|| []).map(Number);
        const n  = Math.min(xs.length, gp.length, bp.length, op.length);
        const rows = [];
        for (let i=0;i<n;i++){
          const a = Math.round(xs[i]);
          const max = Math.max(op[i]||0, bp[i]||0, gp[i]||0);
          const key = max === (op[i]||0) ? "fast" : max === (bp[i]||0) ? "ckd" : "healthy";
          rows.push({ age:a, key });
        }
        const mp = new Map();
        rows.forEach(r => { if(!mp.has(r.age)) mp.set(r.age, r.key); });
        setAgeProbs(Array.from(mp, ([age,key])=>({age, key})));
      } catch (e) {
        console.warn("load analysis for indicator background failed", e);
        setAgeProbs([]);
      }
    })();
  }, [selectedId]);


  // —— 从 records 构建矩阵（你现有逻辑） ——
  const { ages, concepts, cells } = useMemo(() => {
    const recs = normalize(patient?.records);
    if (!recs.length) return { ages: [], concepts: [], cells: [] };

    const getAge = (row) => Number(row.age ?? row["age"] ?? row["Age"] ?? row["AGE"]);
    const getConcept = (row) =>
      row["concept.cd"] ?? row.concept_cd ?? row.concept ?? row["concept"];
    const getVal = (row) =>
      Number(row["nval.num"] ?? row.nval_num ?? row.value ?? row["val"]);

    const ageSet = new Set();
    const conceptSet = new Set();
    const triples = [];

    for (const raw of recs) {
      const row = typeof raw === "string" ? safeParse(raw) : raw;
      const age = Math.trunc(getAge(row));
      const concept = String(getConcept(row) || "").trim();
      const value = getVal(row);
      if (!concept || !Number.isFinite(age) || !Number.isFinite(value)) continue;
      ageSet.add(age);
      conceptSet.add(concept);
      triples.push({ age, concept, value });
    }

    const agesSorted = [...ageSet].sort((a,b)=>a-b);
    const agesFull = agesSorted.length
      ? Array.from({length: agesSorted.at(-1)-agesSorted[0]+1}, (_,i)=>agesSorted[0]+i)
      : [];

    const conceptFreq = new Map();
    triples.forEach(t => conceptFreq.set(t.concept, (conceptFreq.get(t.concept)||0)+1));
    const conceptsOrdered = [...conceptSet].sort((a,b)=>
      (conceptFreq.get(b)||0)-(conceptFreq.get(a)||0) || a.localeCompare(b)
    );

    const box = new Map();
    for (const t of triples) {
      const rng = NORMAL_RANGE[t.concept];
      let cls = "normal";
      if (rng) {
        const [low, high] = rng;
        if (high!=null && t.value>high) cls = "above";
        else if (low!=null && t.value<low) cls = "under";
      }
      const key = `${t.age}|${t.concept}`;
      const cur = box.get(key) || { normal:0, above:0, under:0 };
      cur[cls] += 1;
      box.set(key, cur);
    }

    const cells = [];
    agesFull.forEach((age, ai) => {
      conceptsOrdered.forEach((c, ci) => {
        const k = `${age}|${c}`;
        const stat = box.get(k);
        if (!stat) return;
        let cls = "normal";
        if (stat.above >= stat.normal && stat.above >= stat.under) cls = "above";
        if (stat.under >  stat.normal && stat.under >= stat.above) cls = "under";
        cells.push({ ai, ci, cls, stat });
      });
    });

    return { ages: agesFull, concepts: conceptsOrdered, cells };
  }, [patient]);

  // ---- 尺寸参数 ----
  const labelW = 180;
  const topH   = 24;
  const padR   = 24;
  const padB   = 40;
  const cellH  = 24;
  const minCellW = 16;

  const [wrapRef, containerW] = useContainerWidth();
  const cellW = useMemo(() => {
    if (!ages.length || !containerW) return 22;
    const space = containerW - labelW - padR;
    if (space <= 0) return minCellW;
    return Math.max(minCellW, Math.floor(space / ages.length));
  }, [ages.length, containerW]);

  const innerW = labelW + ages.length * cellW + padR;
  const innerH = topH + concepts.length * cellH + padB;

  // 将 analysis 的年龄→分型 映射到矩阵列
  const ageBgByIndex = useMemo(() => {
    if (!ages.length || !ageProbs.length) return [];
    const m = new Map(ageProbs.map(d => [d.age, d.key]));
    return ages.map(a => m.get(a) || null); // [ 'fast'|'ckd'|'healthy'|null ]
  }, [ages, ageProbs]);

  // if (!patient) return <div>Loading Clinical Indicator View…</div>;
  // if (!ages.length) return <div>No data for Clinical Indicator View.</div>;
  if (loading) return <div>Loading Clinical Indicator View for patient {selectedId}…</div>;
  if (!patient) return <div>No patient data available.</div>;
  if (!ages.length) return <div>No clinical indicator records for patient {selectedId}.</div>;

  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        padding: 12,
        background: "#fff",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <div style={{ fontSize: 18, fontWeight: 700 }}>Clinical Indicator View</div>
        <div style={{ display:"flex", gap:16, alignItems:"center", flexWrap:"wrap" }}>
          <LegendSwatch color={COLORS.normal}  label="Normal" />
          <LegendSwatch color={COLORS.above}   label="Above" />
          <LegendSwatch color={COLORS.under}   label="Under" />
          <span style={{ width:12, height:1, background:"#e5e7eb", display:"inline-block" }} />
          <LegendSwatch color={COLORS.fast}    label="Fast Progression CKD" box />
          <LegendSwatch color={COLORS.ckd}     label="CKD" box />
          <LegendSwatch color={COLORS.healthy} label="Healthy" box />
        </div>
      </div>

      <div
        ref={wrapRef}
        style={{
          width: "100%",
          minWidth: 0,
          overflowX: innerW > containerW ? "auto" : "hidden",
          overflowY: "hidden",
          border: "1px solid #eef2f7",
          borderRadius: 8,
          background: "#fff",
        }}
      >
        <svg
          width="100%"
          height={innerH}
          viewBox={`0 0 ${innerW} ${innerH}`}
          preserveAspectRatio="xMinYMin meet"
        >
          {/* 背景 pattern（虚线色块，接近原版） */}
          <defs>
            <pattern id="p-fast" width="6" height="6" patternUnits="userSpaceOnUse">
              <rect width="6" height="6" fill="transparent" />
              <rect x="0" y="0" width="6" height="6" fill={COLORS.fast} opacity="0.12"/>
              <line x1="0" y1="0" x2="6" y2="6" stroke={COLORS.fast} strokeWidth="1" opacity="0.35"/>
            </pattern>
            <pattern id="p-ckd" width="6" height="6" patternUnits="userSpaceOnUse">
              <rect width="6" height="6" fill="transparent" />
              <rect x="0" y="0" width="6" height="6" fill={COLORS.ckd} opacity="0.12"/>
              <line x1="0" y1="0" x2="6" y2="6" stroke={COLORS.ckd} strokeWidth="1" opacity="0.35"/>
            </pattern>
            <pattern id="p-healthy" width="6" height="6" patternUnits="userSpaceOnUse">
              <rect width="6" height="6" fill="transparent" />
              <rect x="0" y="0" width="6" height="6" fill={COLORS.healthy} opacity="0.12"/>
              <line x1="0" y1="0" x2="6" y2="6" stroke={COLORS.healthy} strokeWidth="1" opacity="0.35"/>
            </pattern>
          </defs>

          {/* 年龄列：先铺分型底色，再画浅灰网格条 */}
          {ages.map((_, i) => {
            const key = ageBgByIndex[i];
            const fill =
              key === "fast" ? "url(#p-fast)" :
              key === "ckd" ? "url(#p-ckd)" :
              key === "healthy" ? "url(#p-healthy)" : "transparent";
            return (
              <g key={`col-${i}`}>
                {/* 分型底色（整列高度） */}
                <rect
                  x={labelW + i * cellW}
                  y={topH}
                  width={cellW}
                  height={concepts.length * cellH}
                  fill={fill}
                />
                {/* 叠一层淡灰条让对比更柔和 */}
                <rect
                  x={labelW + i * cellW}
                  y={topH}
                  width={cellW}
                  height={concepts.length * cellH}
                  fill={i % 2 ? COLORS.gridOdd : COLORS.gridEven}
                  opacity="0.55"
                />
              </g>
            );
          })}

          {/* 左侧指标名 */}
          {concepts.map((c, j) => (
            <text
              key={`c-${j}`}
              x={labelW - 8}
              y={topH + j * cellH + cellH / 2}
              textAnchor="end"
              dominantBaseline="middle"
              fontSize={13}
              fill="#111827"
            >
              {prettyConcept(c)}
            </text>
          ))}

          {/* 单元格：normal/above/under 胶囊 */}
          {cells.map((cell, idx) => {
            const { ai, ci, cls, stat } = cell;
            const fill =
              cls === "normal" ? COLORS.normal :
              cls === "above"  ? COLORS.above  :
              COLORS.under;
            return (
              <g key={`cell-${idx}`}>
                <rect
                  x={labelW + ai * cellW + 3}
                  y={topH + ci * cellH + 6}
                  width={cellW - 6}
                  height={cellH - 12}
                  rx={4}
                  fill={fill}
                  opacity={cls === "normal" ? 0.5 : 0.85}
                />
                <title>
                  {`${prettyConcept(concepts[ci])} @ age ${ages[ai]}\n` +
                    `normal:${stat.normal || 0}, above:${stat.above || 0}, under:${stat.under || 0}`}
                </title>
              </g>
            );
          })}

          {/* 年龄刻度 */}
          {ages.map((age, i) => (
            <text
              key={`age-${i}`}
              x={labelW + i * cellW + cellW / 2}
              y={topH + concepts.length * cellH + 18}
              textAnchor="middle"
              fontSize={12}
              fill="#374151"
            >
              {age}
            </text>
          ))}

          <text
            x={labelW + (ages.length * cellW) / 2}
            y={innerH - 8}
            textAnchor="middle"
            fontWeight={600}
            fill="#6b7280"
          >
            Age
          </text>

          {/* 外框 */}
          <rect
            x={labelW}
            y={topH}
            width={ages.length * cellW}
            height={concepts.length * cellH}
            fill="none"
            stroke="#cbd5e1"
          />
        </svg>
      </div>
    </div>
  );
}

// 简单图例小块
function LegendSwatch({ color, label, box=false }) {
  return (
    <span style={{ display:"inline-flex", alignItems:"center", gap:6 }}>
      <span style={{
        width:14, height:8, borderRadius: box ? 2 : 3,
        background: color, display:"inline-block"
      }}/>
      <span style={{ fontSize:13 }}>{label}</span>
    </span>
  );
}
