import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, ArrowRight, QrCode } from "lucide-react";

export default function AudienceHome() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const clean = code.trim().toUpperCase();
    if (!/^[A-Z0-9]{4,6}$/.test(clean)) {
      setError("请输入有效的房间码（4-6位字母数字）");
      return;
    }
    navigate(`/audience/${clean}`);
  }

  return (
    <div className="min-h-screen bg-mesh flex flex-col">
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="text-center mb-10 animate-fade-in">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-primary-600 to-accent-500 flex items-center justify-center shadow-glow">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
            <h1 className="font-display text-4xl text-slate-900 mb-2">
              加入互动演示
            </h1>
            <p className="text-slate-500">
              输入演讲者提供的房间码，或扫描大屏幕二维码
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="card p-7 animate-slide-up space-y-5"
          >
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                房间码
              </label>
              <input
                value={code}
                onChange={(e) => {
                  setCode(e.target.value);
                  if (error) setError("");
                }}
                placeholder="如：AB3X7"
                className="input-field text-center text-2xl font-mono font-bold tracking-[0.4em] py-4 uppercase"
                maxLength={6}
                autoFocus
              />
              {error && (
                <p className="mt-2 text-sm text-red-500 text-center">{error}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={code.trim().length < 4}
              className="btn-primary w-full py-3.5 text-base inline-flex items-center justify-center gap-2 disabled:opacity-50"
            >
              进入互动房间
              <ArrowRight className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 pt-2">
              <div className="flex-1 h-px bg-slate-200" />
              <span className="text-xs text-slate-400 font-medium">或</span>
              <div className="flex-1 h-px bg-slate-200" />
            </div>

            <div className="text-center text-sm text-slate-500 flex items-center justify-center gap-2 py-1">
              <QrCode className="w-4 h-4 text-accent-500" />
              扫描大屏幕上的二维码直接进入
            </div>
          </form>

          <p className="text-center text-xs text-slate-400 mt-6">
            您的互动数据将用于本次演示统计，并在演示结束后匿名保存
          </p>
        </div>
      </div>
    </div>
  );
}
