// src/AnalysisView.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  ComposedChart, Line, Area, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine,
  BarChart, PieChart, Pie, Cell
} from "recharts";

const BACKEND_URL = "https://hliu-trajvis-backend-77662524617.us-central1.run.app";
// const PATIENT_ID  = 42747;

// =================== Color palette (exact same) ===================
const COLOR = {
  fast:   "#F28E2B",   // Fast CKD
  ckd:    "#4E79A7",   // CKD
  healthy:"#59A14F",   // Healthy
  female:"#E7A6C6",    // Female
  male:  "#6AA4FF",    // Male
  black: "#6B6B6B",    // Black
  white: "#CFCFCF",    // White
  hist:  "#8DA0CB",    // histogram bar
};

// =================== utils ===================
const A    = (v) => (Array.isArray(v) ? v : v == null ? [] : [v]);
const num  = (v) => (Number.isFinite(+v) ? +v : null);
const clamp01 = (x) => Math.max(0, Math.min(1, +x || 0));

function xyToRows(xy) {
  return A(xy)
    .map(p => ({ age: num(p?.[0]), val: num(p?.[1]) }))
    .filter(r => r.age != null && r.val != null)
    .sort((a,b)=>a.age-b.age);
}

function makeBandRows(triplets, minAge) {
  const rows = [];
  for (const t of A(triplets)) {
    const x = num(t?.[0]), y1 = num(t?.[1]), y2 = num(t?.[2]);
    if (x == null || y1 == null || y2 == null) continue;
    const upper = Math.max(y1, y2), lower = Math.min(y1, y2);
    rows.push({ age: x, lower, gap: upper - lower });
  }
  if (!rows.length) return rows;
  rows.sort((a,b)=>a.age-b.age);
  if (minAge != null && rows[0].age > minAge) {
    rows.unshift({ age: minAge, lower: rows[0].lower, gap: rows[0].gap });
  }
  const mp = new Map();
  rows.forEach(r => mp.set(r.age, r));
  return Array.from(mp.values()).sort((a,b)=>a.age-b.age);
}

function toStackBars(triple, keys=["F","M"]) {
  const label = { orange: "Fast CKD", blue: "CKD", green: "Health" };
  return A(triple).map(([k, v1, v2]) => ({
    group: label[k] || k,
    [keys[0]]: Math.round(((+v1)||0)*100),
    [keys[1]]: Math.round(((+v2)||0)*100),
  }));
}

function ringsGender(triple) {
  const m = new Map(A(triple).map(([k,f,mv])=>[k,{F:+f||0,M:+mv||0}]));
  return {
    inner:  [{name:"Female", value:m.get("orange")?.F||0},{name:"Male", value:m.get("orange")?.M||0}],
    middle: [{name:"Female", value:m.get("blue")?.F||0},  {name:"Male", value:m.get("blue")?.M||0}],
    outer:  [{name:"Female", value:m.get("green")?.F||0}, {name:"Male", value:m.get("green")?.M||0}],
  };
}
function ringsRace(triple) {
  const m = new Map(A(triple).map(([k,b,w])=>[k,{B:+b||0,W:+w||0}]));
  return {
    inner:  [{name:"Black", value:m.get("orange")?.B||0},{name:"White", value:m.get("orange")?.W||0}],
    middle: [{name:"Black", value:m.get("blue")?.B||0},  {name:"White", value:m.get("blue")?.W||0}],
    outer:  [{name:"Black", value:m.get("green")?.B||0}, {name:"White", value:m.get("green")?.W||0}],
  };
}

// /analysis/dist：兼容 {bins,counts} 或 {x_vals, y_vals}
function parseConceptDist(json) {
  if (!json) return { kind:"none", rows:[] };
  if (Array.isArray(json.bins) && Array.isArray(json.counts)) {
    const rows = json.bins.map((x,i)=>({ x:+x, y:+json.counts[i]||0 }));
    const nonzero = rows.some(r=>r.y>0);
    return { kind:"hist", rows: nonzero ? rows : [] };
  }
  const xs = A(json.x_vals).map(Number);
  const yBlocks = A(json.y_vals).map(row => A(row?.[1]).map(Number));
  if (xs.length && yBlocks.length) {
    const rows = xs.map((x,i) => {
      let s=0; for (const ys of yBlocks) s += (Number.isFinite(ys[i]) ? ys[i] : 0);
      return { x, y: s };
    });
    const nonzero = rows.some(r => r.y !== 0);
    return { kind:"series", rows: nonzero ? rows : [] };
  }
  return { kind:"none", rows:[] };
}

// 直方图 mock（后端无数据或全 0 时使用）
function makeMockHist(which="egfr") {
  const rows = [];
  if (which === "egfr") {
    for (let x=0; x<=150; x++) {
      const main = 5000 * Math.exp(-Math.pow((x-70)/22, 2));
      const left = 1700 * Math.exp(-Math.pow((x-18)/6, 2));
      rows.push({ x, y: Math.max(0, Math.round(main + left + (Math.random()*80-40))) });
    }
  } else {
    for (let x=0; x<=110; x++) {
      const peak = 10000 * Math.exp(-Math.pow((x-62)/14, 2));
      rows.push({ x, y: Math.max(0, Math.round(peak + (Math.random()*120-60))) });
    }
  }
  return { kind:"hist", rows };
}
const isAllZero = (rows) => rows.length>0 && rows.every(r => (r.y ?? 0) === 0);

function padProbsToRange(rows, start=19, end=80) {
  if (!rows.length) return rows;
  const map = new Map(rows.map(r=>[Math.round(r.age), r]));
  const first = rows[0];
  const out = [];
  for (let a=start; a<=end; a++) {
    if (map.has(a)) out.push(map.get(a));
    else out.push({ age:a, FastCKD:first.FastCKD, CKD:first.CKD, Healthy:first.Healthy });
  }
  return out;
}
function normalizeRows(rows) {
  return rows.map(r => {
    let f = clamp01(r.FastCKD), b = clamp01(r.CKD), g = clamp01(r.Healthy);
    const s = f + b + g;
    if (s > 0) { f/=s; b/=s; g/=s; } else { f=b=g=1/3; }
    return { ...r, FastCKD:f, CKD:b, Healthy:g };
  });
}

// =================== 自适应环图 ===================
function AutoFitRings({
  rings,
  height = 300,
  ringPadding = 8,
  colorForSlice,
}) {
  const [box, setBox] = React.useState({w:0,h:0});
  const ref = React.useRef(null);

  React.useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => {
      setBox({ w: Math.floor(e.contentRect.width), h: height });
    });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, [height]);

  const R = Math.max(0, Math.min(box.w, box.h) / 2 - ringPadding);
  const t = R / 3;
  const seg = {
    inner:  [R - 3*t, R - 2*t],
    middle: [R - 2*t + 4, R - 1*t + 4],
    outer:  [R - 1*t + 8, R + 8],
  };
  const bg  = {
    inner:  [seg.inner[0]-4,  seg.inner[1]-4],
    middle: [seg.middle[0]-4, seg.middle[1]-4],
    outer:  [seg.outer[0]-4,  seg.outer[1]-4],
  };

  return (
    <div ref={ref} style={{width:"100%", height}}>
      {box.w > 0 && (
        <ResponsiveContainer width="100%" height="100%">
          <PieChart margin={{top:0,right:0,bottom:0,left:0}}>
            {/* 背景底环（显示组色边沿） */}
            <Pie data={[{v:1}]} dataKey="v" innerRadius={bg.outer[0]}  outerRadius={bg.outer[1]}  fill={COLOR.healthy} isAnimationActive={false}/>
            <Pie data={[{v:1}]} dataKey="v" innerRadius={bg.middle[0]} outerRadius={bg.middle[1]} fill={COLOR.ckd}     isAnimationActive={false}/>
            <Pie data={[{v:1}]} dataKey="v" innerRadius={bg.inner[0]}  outerRadius={bg.inner[1]}  fill={COLOR.fast}    isAnimationActive={false}/>

            {/* 白色分隔线 */}
            <Pie data={[{v:1}]} dataKey="v" innerRadius={seg.outer[1]}  outerRadius={seg.outer[1]+2} fill="#fff" isAnimationActive={false}/>
            <Pie data={[{v:1}]} dataKey="v" innerRadius={seg.middle[1]} outerRadius={seg.middle[1]+2} fill="#fff" isAnimationActive={false}/>
            <Pie data={[{v:1}]} dataKey="v" innerRadius={seg.inner[1]}  outerRadius={seg.inner[1]+2} fill="#fff" isAnimationActive={false}/>

            {/* 三层实际数据 */}
            <Pie data={rings.outer}  dataKey="value" nameKey="name" innerRadius={seg.outer[0]}  outerRadius={seg.outer[1]}>
              {rings.outer.map((e,i)=>(<Cell key={i} fill={colorForSlice(e, COLOR.healthy)} />))}
            </Pie>
            <Pie data={rings.middle} dataKey="value" nameKey="name" innerRadius={seg.middle[0]} outerRadius={seg.middle[1]}>
              {rings.middle.map((e,i)=>(<Cell key={i} fill={colorForSlice(e, COLOR.ckd)} />))}
            </Pie>
            <Pie data={rings.inner}  dataKey="value" nameKey="name" innerRadius={seg.inner[0]}  outerRadius={seg.inner[1]}>
              {rings.inner.map((e,i)=>(<Cell key={i} fill={colorForSlice(e, COLOR.fast)} />))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

// =================== component ===================
export default function AnalysisView({ selectedId }) {
  const [radial, setRadial] = useState(true);

  // top
  const [sexDist, setSexDist]   = useState([]);
  const [raceDist, setRaceDist] = useState([]);
  const [egfrDist, setEgfrDist] = useState({kind:"none", rows:[]});
  const [ageDist,  setAgeDist]  = useState({kind:"none", rows:[]});

  // bottom
  const [trajRows, setTrajRows] = useState([]);
  const [bandBlue, setBandBlue] = useState([]);
  const [bandOrg,  setBandOrg]  = useState([]);
  const [bandGre,  setBandGre]  = useState([]);
  const [probRows, setProbRows] = useState([]);
  const [ageLast,  setAgeLast]  = useState(null);

  // -------- load top --------
  useEffect(() => {
    (async () => {
      if (!selectedId) return;
      try {
        const base = await fetch(`${BACKEND_URL}/api/analysis/${selectedId}`).then(r=>r.json());
        setSexDist(base?.sex_dist || []);
        setRaceDist(base?.race_dist || []);

        const eg = await fetch(`${BACKEND_URL}/api/analysis/dist/EGFR`).then(r=>r.json()).catch(()=>null);
        const ag = await fetch(`${BACKEND_URL}/api/analysis/dist/age`).then(r=>r.json()).catch(()=>null);
        let egParsed = parseConceptDist(eg);
        let agParsed = parseConceptDist(ag);
        if (isAllZero(egParsed.rows) || egParsed.rows.length === 0) egParsed = makeMockHist("egfr");
        if (isAllZero(agParsed.rows) || agParsed.rows.length === 0) agParsed = makeMockHist("age");
        setEgfrDist(egParsed);
        setAgeDist(agParsed);
      } catch (e) {
        setEgfrDist(makeMockHist("egfr"));
        setAgeDist(makeMockHist("age"));
      }
    })();
  }, [selectedId]);

  // -------- load bottom --------
  useEffect(() => {
    (async () => {
      if (!selectedId) return;
      try {
        const j = await fetch(`${BACKEND_URL}/api/analysis/${selectedId}`).then(r=>r.json());

        // 三条主线
        const blue = xyToRows(j?.traj?.blue);
        const org  = xyToRows(j?.traj?.orange);
        const gre  = xyToRows(j?.traj?.green);
        const ages = Array.from(new Set([...blue, ...org, ...gre].map(p=>p.age))).sort((a,b)=>a-b);
        const mB = new Map(blue.map(p=>[p.age, p.val]));
        const mO = new Map(org.map(p=>[p.age, p.val]));
        const mG = new Map(gre.map(p=>[p.age, p.val]));
        setTrajRows(ages.map(a => ({ age:a, CKD:mB.get(a)??null, FastCKD:mO.get(a)??null, Healthy:mG.get(a)??null })));

        const minAge = ages.length ? ages[0] : null;
        setBandBlue(makeBandRows(j?.blue_area,   minAge));
        setBandOrg (makeBandRows(j?.orange_area, minAge));
        setBandGre (makeBandRows(j?.green_area,  minAge));

        // possibility
        const xr = A(j?.x_range).map(Number);
        const gp = A(j?.green_poss);
        const bp = A(j?.blue_poss);
        const op = A(j?.orange_poss);
        const n  = Math.min(xr.length, gp.length, bp.length, op.length);
        const raw = Array.from({length:n}, (_,i)=>({
          age:xr[i], Healthy:+gp[i]||0, CKD:+bp[i]||0, FastCKD:+op[i]||0
        }));
        const padded  = padProbsToRange(raw, 19, 80);
        const normed  = normalizeRows(padded);
        setProbRows(normed);

        setAgeLast(num(j?.age_last));
      } catch (e) {
        setTrajRows([]); setBandBlue([]); setBandOrg([]); setBandGre([]); setProbRows([]); setAgeLast(null);
      }
    })();
  }, [selectedId]);

  const GENDER = useMemo(()=>toStackBars(sexDist, ["F","M"]), [sexDist]);
  const RACE   = useMemo(()=>toStackBars(raceDist, ["B","W"]), [raceDist]);
  const gRings = useMemo(()=>ringsGender(sexDist), [sexDist]);
  const rRings = useMemo(()=>ringsRace(raceDist),  [raceDist]);

  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 14, marginTop: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
        <h2 style={{ margin: 0 }}>Analysis View</h2>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <span>Bar Chart</span>
          <input type="checkbox" checked={radial} onChange={(e)=>setRadial(e.target.checked)} />
          <span>Radial Chart</span>
        </label>
      </div>

      {/* Top 4 */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12 }}>
        {/* Gender */}
        <div className="panel" style={{ border: "1px solid #eee", borderRadius: 10, padding: 10 }}>
          <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 22 }}>Gender Distribution</div>
          {radial ? (
            <AutoFitRings
              rings={gRings}
              height={300}
              colorForSlice={(entry, ringColor) => entry.name === "Female" ? COLOR.female : ringColor}
            />
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={GENDER} margin={{ top:8, right:10, left:8, bottom:18 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="group" tick={{ fontSize: 12 }} />
                <YAxis domain={[0,100]} tickFormatter={(v)=>`${v}%`} tick={{fontSize:12}}
                       label={{ value:"percentage %", angle:-90, position:"insideLeft", style:{fontSize:12} }} />
                <Tooltip formatter={(v,n)=>[`${v}%`, n]} />
                <Legend payload={[
                  { value:"F", type:"square", color:COLOR.female },
                  { value:"M", type:"square", color:"#888" }
                ]} />
                <Bar dataKey="F" stackId="g" barSize={28} fill={COLOR.female} />
                <Bar dataKey="M" stackId="g" barSize={28}>
                  {GENDER.map((row,i)=>{
                    const colorByGroup = row.group==="Health" ? COLOR.healthy
                                        : row.group==="CKD"   ? COLOR.ckd
                                        : COLOR.fast;
                    return <Cell key={i} fill={colorByGroup} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Race */}
        <div className="panel" style={{ border: "1px solid #eee", borderRadius: 10, padding: 10 }}>
          <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 22 }}>Race Distribution</div>
          {radial ? (
            <AutoFitRings
              rings={rRings}
              height={300}
              colorForSlice={(entry, ringColor) => entry.name === "White" ? ringColor : COLOR.black}
            />
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={RACE} margin={{ top:8, right:10, left:8, bottom:18 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="group" tick={{ fontSize: 12 }} />
                <YAxis domain={[0,100]} tickFormatter={(v)=>`${v}%`} tick={{fontSize:12}}
                       label={{ value:"percentage %", angle:-90, position:"insideLeft", style:{fontSize:12} }} />
                <Tooltip formatter={(v,n)=>[`${v}%`, n]} />
                <Legend payload={[
                  { value:"B", type:"square", color:COLOR.black },
                  { value:"W", type:"square", color:"#888" }
                ]} />
                <Bar dataKey="B" stackId="r" barSize={28} fill={COLOR.black} />
                <Bar dataKey="W" stackId="r" barSize={28}>
                  {RACE.map((row,i)=>{
                    const colorByGroup = row.group==="Health" ? COLOR.healthy
                                        : row.group==="CKD"   ? COLOR.ckd
                                        : COLOR.fast;
                    return <Cell key={i} fill={colorByGroup} />;
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* eGFR density */}
        <div className="panel" style={{ border: "1px solid #eee", borderRadius: 10, padding: 10 }}>
          <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 22 }}>Population eGFR Density</div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={egfrDist.rows} margin={{ top: 8, right: 10, left: 8, bottom: 28 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="x"
                domain={[0, 150]}
                type="number"
                tickCount={8}
                tick={{ fontSize: 12 }}
                label={{ value: "eGFR(mg/mL/1.73m^2)", position:"insideBottom", offset:-6, style:{fontSize:12} }}
              />
              <YAxis
                tick={{ fontSize: 12 }}
                tickFormatter={(v)=>v.toLocaleString()}
                label={{ value: "counts", angle:-90, position:"insideLeft", style:{fontSize:12} }}
              />
              <Tooltip labelFormatter={(x)=>`x=${x}`} formatter={(v)=>[v.toLocaleString(),"count"]}/>
              <Bar dataKey="y" barSize={2} fill={COLOR.hist} isAnimationActive={false}/>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Age density */}
        <div className="panel" style={{ border: "1px solid #eee", borderRadius: 10, padding: 10 }}>
          <div style={{ fontWeight: 700, marginBottom: 8, fontSize: 22 }}>Population Age Density</div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={ageDist.rows} margin={{ top: 8, right: 10, left: 8, bottom: 28 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="x"
                domain={[0, 110]}
                type="number"
                tickCount={8}
                tick={{ fontSize: 12 }}
                label={{ value: "age(year)", position:"insideBottom", offset:-6, style:{fontSize:12} }}
              />
              <YAxis
                tick={{ fontSize: 12 }}
                tickFormatter={(v)=>v.toLocaleString()}
                label={{ value: "counts", angle:-90, position:"insideLeft", style:{fontSize:12} }}
              />
              <Tooltip labelFormatter={(x)=>`x=${x}`} formatter={(v)=>[v.toLocaleString(),"count"]}/>
              <Bar dataKey="y" barSize={2} fill={COLOR.hist} isAnimationActive={false}/>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={{ height: 18 }} />
      <div style={{ fontSize: 18, fontWeight: 700, textAlign: "center", marginBottom: 6 }}>
        Trajectory Uncertainty Evolution
      </div>

      {/* 主图：阴影 + 三条线 */}
      <div style={{ width: "100%", height: 420 }}>
        <ResponsiveContainer>
          <ComposedChart margin={{ top: 10, right: 28, left: 12, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="age" type="number"
              domain={['dataMin','dataMax']}
              ticks={trajRows.map(d=>d.age)}
            />
            <YAxis label={{ value: "eGFR (mL/min/1.73m^2)", angle:-90, position:"insideLeft" }} />
            <Tooltip />
            <Legend />

            {/* 阴影：lower 透明 + gap 填充 */}
            <Area dataKey="lower" data={bandOrg}  stackId="FO" stroke="none" fill="transparent" />
            <Area dataKey="gap"   data={bandOrg}  stackId="FO" stroke="none" fill={COLOR.fast}    fillOpacity={0.18} name="FastCKD uncertainty" />
            <Area dataKey="lower" data={bandBlue} stackId="FB" stroke="none" fill="transparent" />
            <Area dataKey="gap"   data={bandBlue} stackId="FB" stroke="none" fill={COLOR.ckd}     fillOpacity={0.18} name="CKD uncertainty" />
            <Area dataKey="lower" data={bandGre}  stackId="FG" stroke="none" fill="transparent" />
            <Area dataKey="gap"   data={bandGre}  stackId="FG" stroke="none" fill={COLOR.healthy} fillOpacity={0.18} name="Healthy uncertainty" />

            {/* 三条线 */}
            <Line dataKey="FastCKD" data={trajRows} type="monotone" stroke={COLOR.fast}   dot={false} strokeWidth={2} connectNulls name="Fast Progression CKD" />
            <Line dataKey="CKD"     data={trajRows} type="monotone" stroke={COLOR.ckd}    dot={false} strokeWidth={2} connectNulls name="CKD" />
            <Line dataKey="Healthy" data={trajRows} type="monotone" stroke={COLOR.healthy}dot={false} strokeWidth={2} connectNulls name="Healthy" />

            {ageLast != null && <ReferenceLine x={ageLast} stroke="#ef4444" strokeDasharray="4 4" />}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* 底部：possibility */}
      <div style={{ width: "100%", height: 160, marginTop: 6 }}>
        <ResponsiveContainer>
          <ComposedChart data={probRows} barCategoryGap="10%" barGap={0}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="age" />
            <YAxis domain={[0,1]} tickFormatter={(v)=>`${Math.round(v*100)}%`} />
            <Tooltip formatter={(v,n)=>[`${Math.round((+v||0)*100)}%`, n]} />
            <Bar dataKey="FastCKD" stackId="P" fill={COLOR.fast}    barSize={6} />
            <Bar dataKey="CKD"     stackId="P" fill={COLOR.ckd}     barSize={6} />
            <Bar dataKey="Healthy" stackId="P" fill={COLOR.healthy} barSize={6} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
