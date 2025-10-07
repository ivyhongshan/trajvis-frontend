import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

export default function AnalysisPage() {
  const { id } = useParams(); // 从 URL 里取病人 ID
  const [analysis, setAnalysis] = useState(null);

  useEffect(() => {
    fetch(`${import.meta.env.VITE_BACKEND_URL}/api/analysis/${id}`)
      .then((res) => res.json())
      .then((data) => setAnalysis(data))
      .catch((err) => console.error(err));
  }, [id]);

  return (
    <div style={{ padding: "20px" }}>
      <h2>Analysis Result (Patient ID: {id})</h2>
      {analysis ? (
        <pre>{JSON.stringify(analysis, null, 2)}</pre>
      ) : (
        <p>Loading analysis...</p>
      )}
    </div>
  );
}
