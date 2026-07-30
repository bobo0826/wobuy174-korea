"use client";

import { FormEvent, useState } from "react";

type Mode = "login" | "setup";

const fieldClass = "mt-2 h-11 w-full rounded-xl border border-[#E6E1DB] bg-[#FCFBF9] px-3 text-sm text-[#403C37] outline-none placeholder:text-[#AAA39A] focus:border-[#86A28E]";

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [setupCode, setSetupCode] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setPending(true);
    try {
      const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/bootstrap";
      const body = mode === "login" ? { email, password } : { email, password, displayName, setupCode };
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "無法完成登入。");
      window.location.assign("/");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "無法完成登入。");
    } finally {
      setPending(false);
    }
  };

  return <main className="flex min-h-screen items-center justify-center bg-[#F8F7F4] px-5 py-10 text-[#292824]">
    <section className="w-full max-w-[440px] rounded-3xl border border-[#E8E4DE] bg-white p-6 shadow-[0_18px_55px_rgba(55,49,41,.08)] sm:p-8">
      <p className="text-[11px] font-bold tracking-[.22em] text-[#9C958C]">wobuy174＿</p>
      <h1 className="mt-4 text-3xl font-semibold tracking-[-.055em]">{mode === "login" ? "登入後台" : "設定第一位管理員"}</h1>
      <p className="mt-3 text-sm leading-6 text-[#7B766E]">{mode === "login" ? "請使用系統管理員建立的帳號登入。" : "此步驟只在系統尚未有管理員時使用。"}</p>

      <div className="mt-6 grid grid-cols-2 rounded-xl bg-[#F5F2ED] p-1">
        <button type="button" onClick={() => { setMode("login"); setError(""); }} className={`h-10 rounded-lg text-sm font-semibold transition ${mode === "login" ? "bg-white text-[#38342F] shadow-sm" : "text-[#827B72]"}`}>登入</button>
        <button type="button" onClick={() => { setMode("setup"); setError(""); }} className={`h-10 rounded-lg text-sm font-semibold transition ${mode === "setup" ? "bg-white text-[#38342F] shadow-sm" : "text-[#827B72]"}`}>首次設定</button>
      </div>

      <form onSubmit={submit} className="mt-6 space-y-4">
        {mode === "setup" && <label className="block text-sm font-semibold text-[#58534C]">顯示名稱<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="例如：怡文" className={fieldClass} /></label>}
        <label className="block text-sm font-semibold text-[#58534C]">Email<input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" className={fieldClass} /></label>
        <label className="block text-sm font-semibold text-[#58534C]">密碼<input type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="至少 8 碼" className={fieldClass} /></label>
        {mode === "setup" && <label className="block text-sm font-semibold text-[#58534C]">首次設定碼<input type="password" required value={setupCode} onChange={(event) => setSetupCode(event.target.value)} placeholder="由系統管理員預先設定" className={fieldClass} /></label>}
        {error && <p role="alert" className="rounded-xl border border-[#F1D4C4] bg-[#FFF7F0] px-4 py-3 text-sm text-[#9B562A]">{error}</p>}
        <button disabled={pending} className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-[#292824] px-4 text-sm font-semibold text-white transition hover:bg-[#46423D] disabled:cursor-not-allowed disabled:opacity-50">{pending ? "處理中…" : mode === "login" ? "登入系統" : "建立系統管理員"}</button>
      </form>
      <p className="mt-6 rounded-xl bg-[#F8F6F2] p-4 text-xs leading-5 text-[#7E776E]">帳號由系統管理員於「系統設定」建立與管理。首次設定碼不會顯示或儲存在瀏覽器中。</p>
    </section>
  </main>;
}
