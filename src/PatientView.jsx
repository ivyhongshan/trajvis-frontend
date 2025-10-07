import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import React, { useEffect, useMemo, useRef, useState } from "react";

const BACKEND_URL =
  "https://hliu-trajvis-backend-77662524617.us-central1.run.app";
// const PATIENT_ID = 42747;


// 友好名称（你可以按需补充/调整）
const NAME_MAP = {
  EGFR: "eGFR",
  BP_SYSTOLIC: "BP Systolic",
  BP_DIASTOLIC: "BP Diastolic",
  HBA1C: "Hemoglobin A1C",
  HEMOGLOBIN: "Hemoglobin",
  ALKALINE_PHOSPHATASE: "Alkaline Phosphatase",
  ALT_SGPT: "ALT SGPT",
  AST_SGOT: "AST SGOT",
  CHOLESTEROL: "Cholesterol",
  LDL: "Low-Density Lipoprotein",
  HDL: "High-Density Lipoprotein",
  TRIGLYCERIDES: "Triglycerides",
  INR: "INR",
  TBIL: "Total Bilirubin",
  WT: "Weight",
  CREATINE_KINASE: "Creatine Kinase",
  TROPONIN: "Troponin",
};

// 单位（按后端/图谱调整）
const UNIT_MAP = {
  EGFR: "mL/min/1.73m²",
  BP_SYSTOLIC: "mmHg",
  BP_DIASTOLIC: "mmHg",
  HBA1C: "%",
  HEMOGLOBIN: "g/dL",
  ALKALINE_PHOSPHATASE: "U/L",
  ALT_SGPT: "U/L",
  AST_SGOT: "U/L",
  CHOLESTEROL: "mg/dL",
  LDL: "mg/dL",
  HDL: "mg/dL",
  TRIGLYCERIDES: "mg/dL",
  INR: "",
  TBIL: "mg/dL",
  WT: "kg",
  CREATINE_KINASE: "U/L",
  TROPONIN: "ng/L",
};
const LEFT_COLOR = "#d14a61";   
const RIGHT_COLOR = "#6a5acd"; 

const getName = (code) => NAME_MAP[code] || code;
const getUnit = (code) => UNIT_MAP[code] || "";
const withUnit = (code) => {
  const u = getUnit(code);
  return u ? `${getName(code)} (${u})` : getName(code);
};

function seriesForConcept(labJson, conceptName) {
  if (!labJson || !Array.isArray(labJson.data) || !Array.isArray(labJson.ages)) return [];
  const ages = labJson.ages;           // e.g. [51,52,...]
  const rows = labJson.data;           // e.g. [ageIdx, ..., value, ..., "EGFR"]

  const pts = [];
  for (const r of rows) {
    const name = r[r.length - 1];
    if (name !== conceptName) continue;

    // age
    const ageIdx = Number(r[0]);
    const age = Number.isInteger(ageIdx) && ages[ageIdx] != null ? Number(ages[ageIdx]) : null;

    // value（通常在 r[2]，并且可能有 ±9999 代表缺失；加个回退）
    let value = Number(r[2]);
    if (!Number.isFinite(value) || Math.abs(value) === 9999) {
      const candidates = r.slice(0, r.length - 1)
        .map(Number)
        .filter((x) => Number.isFinite(x) && Math.abs(x) !== 9999);
      candidates.sort((a, b) => a - b);
      value = candidates.length ? candidates[Math.floor(candidates.length / 2)] : null;
    }

    if (age != null && Number.isFinite(value)) pts.push({ age, value });
  }
  pts.sort((a, b) => a.age - b.age);
  return pts;
}

// ====== 合并两条指标曲线为 Recharts 需要的数组 ======
function combineTwoSeries(leftPts, rightPts, leftKey, rightKey) {
  const ageSet = new Set([...leftPts.map(p => p.age), ...rightPts.map(p => p.age)]);
  const agesAll = Array.from(ageSet).sort((a, b) => a - b);
  const leftMap  = new Map(leftPts.map(p => [p.age, p.value]));
  const rightMap = new Map(rightPts.map(p => [p.age, p.value]));
  return agesAll.map(age => ({
    age,
    [leftKey]: leftMap.get(age) ?? null,
    [rightKey]: rightMap.get(age) ?? null,
  }));
}

// ====== 可搜索下拉组件（轻量实现） ======
function SearchableSelect({ options, value, onChange, placeholder = "Select...", width = 220 }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef(null);

  useEffect(() => {
    const onDocClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  const selectedLabel = useMemo(() => {
    const hit = options.find(o => o.value === value);
    return hit ? hit.label : "";
  }, [options, value]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return options;
    return options.filter(o => o.label.toLowerCase().includes(s));
  }, [q, options]);

  return (
    <div ref={ref} style={{ position: "relative", width }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          border: "1px solid #d0d7de",
          borderRadius: 8,
          padding: "8px 12px",
          cursor: "pointer",
          background: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between"
        }}
      >
        <span style={{ color: selectedLabel ? "#111" : "#6b7280" }}>
          {selectedLabel || placeholder}
        </span>
        <span style={{ opacity: 0.6 }}>▾</span>
      </div>

      {open && (
        <div
          style={{
            position: "absolute", top: "100%", left: 0, right: 0, zIndex: 50,
            background: "#fff", border: "1px solid #d0d7de", borderRadius: 8, marginTop: 6,
            maxHeight: 260, overflow: "auto", boxShadow: "0 8px 24px rgba(140,149,159,0.2)"
          }}
        >
          <div style={{ padding: 8, borderBottom: "1px solid #eee" }}>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search…"
              style={{
                width: "100%", padding: "6px 8px", borderRadius: 6,
                border: "1px solid #e5e7eb", outline: "none"
              }}
            />
          </div>
          {filtered.map(opt => (
            <div
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false); setQ(""); }}
              style={{ padding: "8px 12px", cursor: "pointer", whiteSpace: "nowrap" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#f6f8fa")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              title={opt.label}
            >
              {opt.label}
            </div>
          ))}
          {filtered.length === 0 && <div style={{ padding: 12, color: "#6b7280" }}>No results</div>}
        </div>
      )}
    </div>
  );
}


// ---- utilities ----
function safeParse(s) {
  try { return JSON.parse(s); } catch { return s; }
}
function normalize(field) {
  if (field == null) return [];
  if (Array.isArray(field)) return field.map(x => (typeof x === "string" ? safeParse(x) : x));
  if (typeof field === "string") {
    const parsed = safeParse(field);
    if (Array.isArray(parsed)) return parsed.map(x => (typeof x === "string" ? safeParse(x) : x));
    if (parsed && typeof parsed === "object") return [parsed];
    return [];
  }
  if (typeof field === "object") return [field];
  return [];
}
const pick = (obj, keys) => keys.find(k => obj?.[k] != null);

// ---- build chart data from /api/labtest/:id ----
function makeSeriesFromLabtest(labJson) {
  if (!labJson || !Array.isArray(labJson.data) || !Array.isArray(labJson.ages)) {
    return [];
  }
  const ages = labJson.ages;         // e.g. [51, 52, ...]
  const rows = labJson.data;         // rows like [ageIdx, ..., value, ..., "EGFR"]

  // 抽取单一指标的 (age, value) 列表；默认取 row[2] 为数值，age = ages[row[0]]
  const pickSeries = (conceptName) => {
    const pts = [];
    for (const r of rows) {
      const concept = r[r.length - 1];
      if (concept !== conceptName) continue;

      const ageIdx = Number(r[0]);
      const age = Number.isInteger(ageIdx) && ages[ageIdx] != null ? Number(ages[ageIdx]) : null;

      // 尝试在这一行中找到“最像数值”的位置：
      // 通常 value 在 r[2]；如果 r[2] 不像（NaN/±9999），就回退到该行里最合理的一个数。
      const candidates = r.slice(0, r.length - 1)
        .map(Number)
        .filter((x) => Number.isFinite(x) && Math.abs(x) !== 9999);

      let value = Number(r[2]);
      if (!Number.isFinite(value) || Math.abs(value) === 9999) {
        // 回退策略：取 candidates 中位数，避免上下限（有些行里包含上下限）
        candidates.sort((a, b) => a - b);
        const mid = candidates.length ? candidates[Math.floor(candidates.length / 2)] : null;
        value = mid;
      }

      if (age != null && Number.isFinite(value)) {
        pts.push({ age, value });
      }
    }
    // 按 age 排序
    pts.sort((a, b) => a.age - b.age);
    return pts;
  };

  const egfrPts = pickSeries("EGFR");
  const sbpPts  = pickSeries("BP_SYSTOLIC");

  // 合并两条曲线到同一数组：以出现过的所有 age 做并集
  const ageSet = new Set([...egfrPts.map(p => p.age), ...sbpPts.map(p => p.age)]);
  const agesAll = Array.from(ageSet).sort((a, b) => a - b);

  const egfrMap = new Map(egfrPts.map(p => [p.age, p.value]));
  const sbpMap  = new Map(sbpPts.map(p => [p.age, p.value]));

  return agesAll.map(age => ({
    age,
    eGFR: egfrMap.get(age) ?? null,
    BP_Systolic: sbpMap.get(age) ?? null,
  }));
}

// ---- component ----
export default function PatientView({ reusePatient, selectedId, setSelectedId }) {
  const [patient, setPatient] = useState(null);
  const [labRaw, setLabRaw] = useState(null);   // 原始 labtest JSON
  const [loading, setLoading] = useState(true);
  const [labLoading, setLabLoading] = useState(true);

  const [leftMetric, setLeftMetric] = useState("EGFR");
  const [rightMetric, setRightMetric] = useState("BP_SYSTOLIC");
  const [patientList, setPatientList] = useState([]);

  useEffect(() => {
    // 异步加载病人 ID
    const fetchPatients = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/patients`);
        const json = await res.json();
        if (json?.data) {
          setPatientList(json.data);
        }
      } catch (err) {
        console.error("Error fetching patients:", err);
      }
    };
    fetchPatients();
  }, []);

  // 1) 所有 hooks 都放在顶层 —— 不要放在 return 之后
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`${BACKEND_URL}/api/patient/${selectedId}`);
        let data = await res.json();
        data.demo    = normalize(data.demo);
        data.records = normalize(data.records);
        data.risk    = normalize(data.risk);
        data.labtest = normalize(data.labtest);
        setPatient(data);
      } catch (e) {
        console.error("Error loading patient:", e);
        setPatient(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [selectedId]); 

  useEffect(() => {
    (async () => {
      setLabLoading(true);
      try {
        const r = await fetch(`${BACKEND_URL}/api/labtest/${selectedId}`);
        const json = await r.json();
        setLabRaw(json);
        if (Array.isArray(json.concepts) && json.concepts.length) {
          if (!json.concepts.includes(leftMetric))  setLeftMetric(json.concepts[0]);
          if (!json.concepts.includes(rightMetric)) setRightMetric(json.concepts[Math.min(1, json.concepts.length - 1)]);
        }
      } catch (e) {
        console.error("load labtest failed", e);
        setLabRaw(null);
      } finally {
        setLabLoading(false);
      }
    })();
  }, [selectedId]); 

  // 2) 这些也是 hooks（useMemo）—— 也要放在 return 之前且无条件执行
  const conceptOptions = useMemo(() => {
    const codes = Array.isArray(labRaw?.concepts) ? labRaw.concepts : [];
    return codes.map(code => ({ value: code, label: withUnit(code) }));
  }, [labRaw]);

  const chartData = useMemo(() => {
    if (!labRaw) return [];
    const leftPts  = seriesForConcept(labRaw, leftMetric);
    const rightPts = seriesForConcept(labRaw, rightMetric);
    return combineTwoSeries(leftPts, rightPts, "left", "right");
  }, [labRaw, leftMetric, rightMetric]);

  const hasSeries = chartData.some(d => d.left != null || d.right != null);

  // 3) 非 hooks 的普通派生值可以放在任何位置
  const demo   = patient?.demo?.[0]    || {};
  const record = patient?.records?.[0] || {};
  const risk   = patient?.risk?.[0]    || {};

  const gender   = demo.sex_cd ?? demo.sex ?? "N/A";
  const race     = demo.race_cd ?? demo.race ?? "N/A";
  const ageNow   = record.age != null ? Number(record.age).toFixed(1) : "N/A";
  const gfr      = risk.eGFR ?? risk.egfr ?? "N/A";
  const acr      = risk.ACR ?? risk.acr ?? "N/A";
  const fiveYear = risk.fiveyear ?? risk.fiveryear ?? risk["5year"] ?? "N/A";
  const twoYear  = risk.twoyear ?? risk.two_year ?? risk["2year"] ?? "N/A";

  // 友好显示
  const genderLabel =
    String(gender).toUpperCase() === "M" ? "Male" :
    String(gender).toUpperCase() === "F" ? "Female" : gender;

  const raceLabel =
    race === "W" ? "White" :
    race === "B" ? "Black" : (race ?? "N/A");

  // 可能后端没有，做兜底
  const dob       = demo.dob ?? demo.DoB ?? "—";
  const lastVisit = record.last_visit ?? record.lastVisit ?? "—";

  // 4) 再做条件渲染
  if (loading) return <p>Loading patient {selectedId}…</p>;
  if (!patient) return <p>Error loading patient {selectedId}.</p>;

  return (
    <div className="pv-card">
      <h2 className="card__title" style={{marginBottom:6}}>Patient View</h2>
      {/* ===== Patient Selector ===== */}
      <div style={{ margin: "8px 0 16px 0" }}>
        <label htmlFor="patientSelect" style={{ fontWeight: 600, marginRight: 8 }}>
          Select a Patient:
        </label>

        <select
          id="patientSelect"
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          style={{
            padding: "6px 10px",
            borderRadius: 6,
            border: "1px solid #ccc",
            fontSize: 14,
            minWidth: 140,
          }}
        >
          <option value="" disabled>
            {patientList.length === 0 ? "Loading..." : "Select"}
          </option>
          {patientList.map((pid) => (
            <option key={pid} value={pid}>
              {pid}
            </option>
          ))}
        </select>

        <span style={{ fontSize: 12, marginLeft: 8, color: "#666" }}>
          (All data are synthetic)
        </span>
      </div>

      {/* ===== Demographic ===== */}
      <div className="pv-section-title">Demographic</div>
      <div className="pv-grid">
        {/* 头行 */}
        <div className="row">
          <div className="cell head">MRN</div>
          <div className="cell head">Gender</div>
          <div className="cell head">Race</div>
          <div className="cell head">Last Visit Date</div>
        </div>
        {/* 值行 */}
        <div className="row">
          <div className="cell">{selectedId}</div>
          <div className="cell"><span className="badge">{gender === "M" ? "Male" : gender === "F" ? "Female" : String(gender)}</span></div>
          <div className="cell">{race || "—"}</div>
          <div className="cell">—</div>
        </div>
      </div>

      {/* ===== Kidney Failure Risk ===== */}
      <div className="pv-section-title" style={{marginTop:12}}>Kidney Failure Risk</div>
      <div className="pv-grid">
        <div className="row">
          <div className="cell head">Age</div>
          <div className="cell head">GFR</div>
          <div className="cell head">ACR (mg/g Cr)</div>
          <div className="cell head">—</div>
        </div>
        <div className="row">
          <div className="cell">{ageNow}</div>
          <div className="cell">{gfr}</div>
          <div className="cell">{acr}</div>
          <div className="cell">—</div>
        </div>
        <div className="row">
          <div className="cell head">2 Year Risk</div>
          <div className="cell head">5 Year Risk</div>
          <div className="cell head">—</div>
          <div className="cell head">—</div>
        </div>
        <div className="row">
          <div className="cell">{twoYear}</div>
          <div className="cell">{fiveYear}</div>
          <div className="cell">—</div>
          <div className="cell">—</div>
        </div>
      </div>

      {/* ===== 两个可搜索下拉 ===== */}
      <div style={{ display:"flex", gap:12, alignItems:"center", marginTop:12 }}>
        <div>
          <div style={{ fontSize:12, color:"#6b7280", marginBottom:4 }}>Clinical Feature (Left Y)</div>
          <SearchableSelect
            options={conceptOptions}
            value={leftMetric}
            onChange={setLeftMetric}
            placeholder="Choose metric"
            width={240}
          />
        </div>
        <div>
          <div style={{ fontSize:12, color:"#6b7280", marginBottom:4 }}>Clinical Feature (Right Y)</div>
          <SearchableSelect
            options={conceptOptions}
            value={rightMetric}
            onChange={setRightMetric}
            placeholder="Choose metric"
            width={240}
          />
        </div>
      </div>

      {/* ===== 小标题 + 折线图 ===== */}
      <div className="pv-subtitle">Patient Visit Record</div>
      <div style={{ marginTop:4 }}>
        {labLoading ? (
          <p className="muted">Loading labtest for chart…</p>
        ) : hasSeries ? (
          <div style={{ width:"100%", height:340, borderRadius:10, padding:"6px 6px 0" }}>
            <ResponsiveContainer>
              <LineChart data={chartData} margin={{ top: 4, right: 48, left: 48, bottom: 24 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="age"
                  tickMargin={6}
                  axisLine={{ stroke:"#cbd5e1" }}
                  tickLine={{ stroke:"#cbd5e1" }}
                  label={{ value:"Age", position:"insideBottom", offset:-10, style:{ fontWeight:600, fill:"#6b7280" } }}
                />
                <YAxis
                  yAxisId="left"
                  domain={["auto","auto"]}
                  tick={{ fill: LEFT_COLOR }}
                  stroke={LEFT_COLOR}
                  axisLine={{ stroke: LEFT_COLOR }}
                  tickLine={{ stroke: LEFT_COLOR }}
                  label={{ value: withUnit(leftMetric), angle:-90, position:"insideLeft", offset:10,
                    style:{ fill:LEFT_COLOR, fontWeight:700, textAnchor:"middle", dominantBaseline:"central" } }}
                />
                <YAxis
                  yAxisId="right" orientation="right" domain={["auto","auto"]}
                  tick={{ fill: RIGHT_COLOR }} stroke={RIGHT_COLOR}
                  axisLine={{ stroke: RIGHT_COLOR }} tickLine={{ stroke: RIGHT_COLOR }}
                  label={{ value: withUnit(rightMetric), angle:-90, position:"insideRight", offset:10,
                    style:{ fill:RIGHT_COLOR, fontWeight:700, textAnchor:"middle", dominantBaseline:"central" } }}
                />
                <Tooltip
                  formatter={(val, name) => {
                    if (name === "left")  return [`${val}`, getName(leftMetric)];
                    if (name === "right") return [`${val}`, getName(rightMetric)];
                    return [val, name];
                  }}
                  labelFormatter={(age) => `Age: ${age}`}
                />
                <Line yAxisId="left"  type="monotone" dataKey="left"  stroke={LEFT_COLOR}  dot={false} strokeWidth={2} connectNulls />
                <Line yAxisId="right" type="monotone" dataKey="right" stroke={RIGHT_COLOR} dot={false} strokeWidth={2} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="muted">(No time-series for the selected metrics)</p>
        )}
      </div>
    </div>
  );
}
