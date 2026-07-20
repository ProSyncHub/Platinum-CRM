export default function Header() {
  return (
    <header className="flex h-16 items-center justify-between border-b bg-white px-6">
      <div>
        <h1 className="text-lg font-semibold">
          Dashboard
        </h1>
      </div>

      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-full bg-slate-200" />
      </div>
    </header>
  );
}