// src/components/DashboardLayout.jsx
import React, { useState } from "react";


import "./Layout.css";
import ComercialDashboard from "../Comercial/ComercialDashboard";


export default function DashboardLayout() {
  const [selectedMenu, setSelectedMenu] = useState("obras");

  const renderContent = () => {
    switch (selectedMenu) {
    
      case "comercial":
       return <ComercialDashboard/>
        

        

      default:
        return <ComercialDashboard/>
    }
  };

  return (
    <div className="dashboard-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <h2>SP Alumínio</h2>
          <h3 className="blue">By Consulting Blue</h3>
        </div>

        <nav>
          <ul>
            {/* Seção Financeiro */}
            <li className="submenu-title"> Comercial</li>
            <li
              className={selectedMenu === "comercial" ? "active" : ""}
              onClick={() => setSelectedMenu("comercial")}
            >
              • Comercial
            </li>
          
          </ul>
        </nav>
      </aside>

      {/* Conteúdo principal */}
      <main className="dashboard-content">{renderContent()}</main>
    </div>
  );
}