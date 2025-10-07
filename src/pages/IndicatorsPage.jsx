import { useEffect, useState } from "react";

export default function IndicatorsPage() {
  const [indicators, setIndicators] = useState([]);

  useEffect(() => {
    fetch(`${import.meta.env.VITE_BACKEND_URL}/api/indicators`)
      .then((res) => res.json())
      .then((data) => setIndicators(data))
      .catch((err) => console.error(err));
  }, []);

  return (
    <div style={{ padding: "20px" }}>
      <h2>Indicators</h2>
      {indicators.length > 0 ? (
        <table border="1" cellPadding="5">
          <thead>
            <tr>
              {Object.keys(indicators[0]).map((key) => (
                <th key={key}>{key}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {indicators.map((ind, idx) => (
              <tr key={idx}>
                {Object.values(ind).map((val, i) => (
                  <td key={i}>{String(val)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p>Loading indicators...</p>
      )}
    </div>
  );
}
