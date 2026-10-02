import { useState } from "react";

interface BriefPromptProps {
  onGenerate: (brief: string) => void;
  loading: boolean;
  error: string | null;
}

export default function BriefPrompt({ onGenerate, loading, error }: BriefPromptProps) {
  const [text, setText] = useState("");

  return (
    <div className="rounded-xl p-6 text-center" style={{ background: "#1a1d27", border: "1px solid #2a2f42" }}>
      <div className="text-3xl mb-2">🤖</div>
      <h2 className="font-700 mb-1" style={{ color: "#f0f2f5" }}>No AI plan yet</h2>
      <p className="text-sm mb-4" style={{ color: "#6b7280" }}>
        Describe your project and the AI will generate real estimates for this page.
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        placeholder="e.g. 3-bedroom house, 120 sqm, Quezon City, ₱2.5M budget, modern design"
        className="w-full rounded-lg p-3 text-sm mb-3 outline-none resize-none"
        style={{ background: "#0f1117", border: "1px solid #2a2f42", color: "#f0f2f5" }}
      />
      {error && <p className="text-xs mb-3" style={{ color: "#ef4444" }}>{error}</p>}
      <button
        disabled={loading || !text.trim()}
        onClick={() => onGenerate(text.trim())}
        className="px-5 py-2.5 rounded-xl font-700 text-sm transition-all"
        style={{ background: "#f59e0b", color: "#0f1117", opacity: loading || !text.trim() ? 0.6 : 1 }}
      >
        {loading ? "Generating…" : "Generate with AI"}
      </button>
    </div>
  );
}
