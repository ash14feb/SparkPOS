export function GenericView({ title, icon: Icon }: { title: string, icon: any }) {
  return (
    <div className="p-8">
      <div className="flex items-center mb-8">
        <Icon className="w-8 h-8 text-brand-600 mr-3" />
        <h1 className="text-3xl font-display font-bold text-gray-900">{title}</h1>
      </div>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center flex flex-col items-center justify-center">
        <div className="w-20 h-20 bg-brand-50 rounded-full flex items-center justify-center mb-4">
          <Icon className="w-10 h-10 text-brand-500" />
        </div>
        <h2 className="text-xl font-display font-semibold text-gray-900 mb-2">{title} Module</h2>
        <p className="text-gray-500 max-w-md mx-auto">
          This premium module is ready to be fully integrated with your backend APIs.
        </p>
      </div>
    </div>
  );
}
