import { Link } from "react-router-dom";

export default function Navbar() {
  return (
    <nav style={{ padding: "10px", background: "#f5f5f5" }}>
      <Link to="/" style={{ margin: "0 10px" }}>Home</Link>
      <Link to="/umap" style={{ margin: "0 10px" }}>UMAP</Link>
      <Link to="/patients" style={{ margin: "0 10px" }}>Patients</Link>
      <Link to="/indicators" style={{ margin: "0 10px" }}>Indicators</Link>
      <Link to="/analysis" style={{ margin: "0 10px" }}>Analysis</Link>
    </nav>
  );
}
