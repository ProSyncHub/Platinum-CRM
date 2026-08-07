import Sidebar from "./Sidebar";
import Header from "./Header";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 antialiased">
      <Sidebar />

      <div className="flex flex-1 flex-col overflow-hidden bg-slate-50">
        <Header />

        <main className="flex-1 overflow-auto p-4 sm:p-6 bg-slate-50 text-slate-900">
          {children}
        </main>
      </div>
    </div>
  );
}