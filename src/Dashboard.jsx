// src/Dashboard.jsx
import React, { useEffect, useState } from "react";
import PatientView from "./PatientView";
import ClinicalIndicatorView from "./ClinicalIndicatorView";
import AnalysisView from "./AnalysisView";
import UmapView from "./UmapView";
import { BACKEND_URL } from "./config";

// const BACKEND_URL =
//   "https://hliu-trajvis-backend-77662524617.us-central1.run.app";
// const PATIENT_ID = 42747;

// 与现有 normalize 对齐
const safeParse = (s) => { try { return JSON.parse(s); } catch { return s; } };
const normalize = (field) => {
  if (!field) return [];
  if (Array.isArray(field)) return field.map(x => (typeof x === "string" ? safeParse(x) : x));
  if (typeof field === "string") return normalize(safeParse(field));
  if (typeof field === "object") return [field];
  return [];
};

export default function Dashboard() {
  const [patient, setPatient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState("42747"); 
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`${BACKEND_URL}/api/patient/${selectedId}`);
        const data = await res.json();
        data.demo    = normalize(data.demo);
        data.records = normalize(data.records);
        data.risk    = normalize(data.risk);
        data.labtest = normalize(data.labtest);
        setPatient(data);
      } catch (e) {
        console.error("Dashboard load patient failed:", e);
        setPatient(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [selectedId]);

  return (
    <div className="page">
      {/* ===== 顶部标题栏 ===== */}
      <header className="topbar">
        <div className="topbar__title">Chronic Kidney Disease Patient Trajectory</div>
        <div className="topbar__legend">
          <span className="dot dot--green" /> Healthy
          <span className="dot dot--blue" /> CKD
          <span className="dot dot--orange" /> Fast Progression CKD
          {/* <div className="patientbox">
            <span className="patientbox__label">Select a Patient</span>
            <input className="patientbox__input" value={PATIENT_ID} readOnly />
            <span className="patientbox__hint">(All data are synthetic)</span>
          </div> */}
        </div>
      </header>

      {loading && <p style={{padding:16}}>Loading…</p>}
      {!loading && !patient && <p style={{padding:16}}>Failed to load patient.</p>}

      {!loading && patient && (
        <div className="app-shell">
          {/* ===== 左栏（sticky + 独立滚动） ===== */}
          <aside className="left-pane">
            <section className="card card--section">
              <div className="card__head">
                <h2 className="card__title">Patient View <span className="i i-user" /></h2>
                <div className="section-line" />
              </div>
              {/* 你的 PatientView 内部已做图表/下拉，这里仅复用数据 */}
              <PatientView reusePatient={patient} selectedId={selectedId} setSelectedId={setSelectedId} />
            </section>

            <section className="card card--section">
              <div className="card__head">
                <h2 className="card__title">Trajectory View <span className="i i-umap" /></h2>
                <div className="section-line" />
              </div>
              <div className="umap-wrap">
                <UmapView selectedId={selectedId}/>
              </div>
            </section>
          </aside>

          {/* ===== 右栏 ===== */}
          <main className="right-pane">
            {/* Clinical Indicator —— 完全展开 */}
            <section className="card card--flush card--section">
              <div className="card__head">
                <h2 className="card__title">Clinical Indicator View <span className="i i-chart" /></h2>
                <div className="section-line" />
              </div>
              <div className="ci-wrap">
                {/* 如果你想自定义图例，可在这里放一个 .ci-legend */}
                <div className="ci-body">
                  <ClinicalIndicatorView reusePatient={patient} selectedId={selectedId} />
                </div>
              </div>
            </section>

            {/* Analysis */}
            <section className="card card--section">
              <div className="card__head">
                <h2 className="card__title">Analysis View <span className="i i-analytics" /></h2>
                <div className="section-line" />
              </div>
              <AnalysisView selectedId={selectedId} />
            </section>
          </main>
        </div>
      )}
    </div>
  );
}
