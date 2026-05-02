import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  NavLink,
} from "react-router-dom";
import LocalControllerDashboard from "./components/LocalControllerDashboard";
import GlobalControllerDashboard from "./components/GlobalControllerDashboard";
import "./App.css";

const App = () => {
  return (
    <Router>
      <nav className="navbar">
        <NavLink
          to="/"
          className={({ isActive }) =>
            isActive ? "nav-link active" : "nav-link"
          }
        >
          Local Controller
        </NavLink>
        <NavLink
          to="/gc"
          className={({ isActive }) =>
            isActive ? "nav-link active" : "nav-link"
          }
        >
          Central Controller
        </NavLink>
      </nav>
      <Routes>
        <Route path="/" element={<LocalControllerDashboard />} />
        <Route path="/gc" element={<GlobalControllerDashboard />} />
      </Routes>
    </Router>
  );
};

export default App;
