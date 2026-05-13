import { NavLink, Outlet } from "react-router-dom";
import { MegaFodyProvider } from "./megafodyStore";

const subnav = [
  { to: "/admin/megafody", label: "Inicio", end: true },
  { to: "/admin/megafody/delivery", label: "Delivery / Mostrador" },
  { to: "/admin/megafody/kds", label: "Cocina (KDS)" },
];

export default function MegaFodyLayout() {
  return (
    <MegaFodyProvider>
      <div className="-m-4 sm:-m-6 min-h-[calc(100vh-4rem)] bg-gray-950">
        {/* MegaFody header */}
        <header className="bg-gradient-to-r from-rose-600 to-rose-700 px-6 py-4 border-b border-rose-800/50">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/15 rounded-lg flex items-center justify-center text-white">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold text-white tracking-tight">MegaFody</h1>
                <p className="text-xs text-rose-100/80">Sistema de gestión gastronómica · demo navegable</p>
              </div>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider bg-white/15 text-white px-2 py-1 rounded">
              Beta · datos de prueba
            </span>
          </div>

          {/* Subnav */}
          <nav className="flex gap-1 mt-4 -mb-1">
            {subnav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `px-4 py-2 rounded-t-lg text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-gray-950 text-white"
                      : "bg-white/10 text-rose-50 hover:bg-white/20"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </header>

        <div className="p-6">
          <Outlet />
        </div>
      </div>
    </MegaFodyProvider>
  );
}
