import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../store/authContext";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const ok = await login(username, password);
    setLoading(false);
    if (ok) {
      navigate("/admin/catalogo", { replace: true });
    } else {
      setError("Usuario o contraseña incorrectos");
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm bg-gray-900 rounded-2xl p-8 border border-gray-800"
      >
        <div className="flex justify-center mb-6">
          <div className="w-14 h-14 bg-emerald-600 rounded-xl flex items-center justify-center text-white font-bold text-xl">
            TP
          </div>
        </div>
        <h1 className="text-white text-xl font-bold text-center mb-6">
          Acceso al Backoffice
        </h1>

        {error && (
          <div className="mb-4 text-red-400 text-sm text-center bg-red-900/30 rounded-lg py-2">
            {error}
          </div>
        )}

        <label className="block mb-4">
          <span className="text-gray-400 text-sm">Usuario</span>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="mt-1 w-full bg-gray-800 text-white rounded-lg px-4 py-2.5 border border-gray-700 focus:border-emerald-500 focus:outline-none"
            autoFocus
            required
          />
        </label>

        <label className="block mb-6">
          <span className="text-gray-400 text-sm">Contraseña</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 w-full bg-gray-800 text-white rounded-lg px-4 py-2.5 border border-gray-700 focus:border-emerald-500 focus:outline-none"
            required
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 rounded-lg transition-colors disabled:opacity-50"
        >
          {loading ? "Ingresando..." : "Ingresar"}
        </button>
      </form>
    </div>
  );
}
