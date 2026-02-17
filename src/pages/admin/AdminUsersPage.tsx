export default function AdminUsersPage() {
  return (
    <div className="max-w-6xl">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white mb-2">Usuarios Admin</h2>
        <p className="text-gray-400">Gestiona los usuarios administradores del sistema</p>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-lg p-8 text-center">
        <div className="text-gray-500 mb-4">
          <svg className="w-16 h-16 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
          <p className="text-lg font-medium text-gray-400">Gestión de Usuarios Admin</p>
          <p className="text-sm text-gray-500 mt-2">Esta funcionalidad estará disponible próximamente</p>
        </div>
      </div>
    </div>
  );
}
