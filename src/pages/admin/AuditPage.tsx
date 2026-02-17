export default function AuditPage() {
  return (
    <div className="max-w-6xl">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white mb-2">Auditoría</h2>
        <p className="text-gray-400">Registro de auditoría de todas las acciones del sistema</p>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-lg p-8 text-center">
        <div className="text-gray-500 mb-4">
          <svg className="w-16 h-16 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-lg font-medium text-gray-400">Log de Auditoría</p>
          <p className="text-sm text-gray-500 mt-2">Esta funcionalidad estará disponible próximamente</p>
        </div>
      </div>
    </div>
  );
}
