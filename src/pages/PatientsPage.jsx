import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

export default function PatientsPage() {
  const [patients, setPatients] = useState([]);

  useEffect(() => {
    fetch(`${import.meta.env.VITE_BACKEND_URL}/api/patients`)
      .then((res) => res.json())
      .then((data) => setPatients(data))
      .catch((err) => console.error(err));
  }, []);

  return (
    <div style={{ padding: "20px" }}>
      <h2>Patients</h2>
      <ul>
        {patients.map((p) => (
          <li key={p.id}>
            <Link to={`/analysis/${p.id}`}>
              {p.name} (ID: {p.id})
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
