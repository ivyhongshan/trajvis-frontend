import { useEffect, useState } from "react";
import Plot from "react-plotly.js";

export default function UmapPage() {
  const [umapData, setUmapData] = useState(null);

  useEffect(() => {
    fetch(`${import.meta.env.VITE_BACKEND_URL}/api/umap`)
      .then((res) => res.json())
      .then((data) => setUmapData(data))
      .catch((err) => console.error(err));
  }, []);

  return (
    <div style={{ padding: "20px" }}>
      <h2>UMAP Embedding</h2>
      {umapData ? (
        <Plot
          data={[
            {
              x: umapData.embed.map((d) => d[0]),
              y: umapData.embed.map((d) => d[1]),
              mode: "markers",
              type: "scatter",
              marker: { size: 6, color: "blue" },
            },
          ]}
          layout={{ title: "UMAP Embedding", width: 700, height: 500 }}
        />
      ) : (
        <p>Loading UMAP data...</p>
      )}
    </div>
  );
}
