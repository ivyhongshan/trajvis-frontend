import Dashboard from "./Dashboard";

function App() {
  return <Dashboard />;
}

export default App;


// import { BrowserRouter, Routes, Route } from "react-router-dom";
// import Navbar from "./components/Navbar";
// import UmapPage from "./pages/UmapPage";
// import PatientsPage from "./pages/PatientsPage";
// import IndicatorsPage from "./pages/IndicatorsPage";
// import AnalysisPage from "./pages/AnalysisPage";

// function App() {
//   return (
//     <BrowserRouter>
//       <Navbar />
//       <Routes>
//         <Route path="/" element={<h2>Welcome to TrajVis Frontend</h2>} />
//         <Route path="/umap" element={<UmapPage />} />
//         <Route path="/patients" element={<PatientsPage />} />
//         <Route path="/indicators" element={<IndicatorsPage />} />
//         <Route path="/analysis/:id" element={<AnalysisPage />} />
//       </Routes>
//     </BrowserRouter>
//   );
// }

// export default App;

// import { useState } from 'react'
// import reactLogo from './assets/react.svg'
// import viteLogo from '/vite.svg'
// import './App.css'

// function App() {
//   const [count, setCount] = useState(0)

//   return (
//     <>
//       <div>
//         <a href="https://vite.dev" target="_blank">
//           <img src={viteLogo} className="logo" alt="Vite logo" />
//         </a>
//         <a href="https://react.dev" target="_blank">
//           <img src={reactLogo} className="logo react" alt="React logo" />
//         </a>
//       </div>
//       <h1>Vite + React</h1>
//       <div className="card">
//         <button onClick={() => setCount((count) => count + 1)}>
//           count is {count}
//         </button>
//         <p>
//           Edit <code>src/App.jsx</code> and save to test HMR
//         </p>
//       </div>
//       <p className="read-the-docs">
//         Click on the Vite and React logos to learn more
//       </p>
//     </>
//   )
// }

// export default App
