import Link from "next/link";

export default function BackNav({ title }: { title: string }) {
  return (
    <header className="border-b border-gray-800 bg-gray-950 px-4 sm:px-6 py-4">
      <div className="max-w-7xl mx-auto flex items-center gap-3">
        <Link
          href="/"
          className="text-gray-400 hover:text-white transition-colors flex items-center gap-1.5 text-sm"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Briefing
        </Link>
        <span className="text-gray-700">/</span>
        <h1 className="text-lg font-semibold text-white">{title}</h1>
      </div>
    </header>
  );
}
