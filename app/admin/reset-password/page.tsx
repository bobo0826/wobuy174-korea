"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { getSupabaseClient, isSupabaseConfigured } from "../../lib/supabase";

const inputClass =
  "mt-2 w-full rounded-[4px] border border-[#D9D6D0] bg-[#F5F5F5] px-3 py-2.5 text-sm outline-none transition focus:border-[#605B51]";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [hasRecoverySession, setHasRecoverySession] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) return;

    void supabase.auth.getSession().then(({ data }) => {
      setHasRecoverySession(Boolean(data.session));
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" && session) setHasRecoverySession(true);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const requestReset = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const supabase = getSupabaseClient();
    if (!supabase) return;

    setIsBusy(true);
    setMessage("");
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/admin/reset-password`,
    });
    setIsBusy(false);
    setMessage(
      error
        ? error.message
        : "若此 Email 為後台帳號，重設連結已寄出。請查看收件匣與垃圾郵件。",
    );
  };

  const updatePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (newPassword.length < 8) {
      setMessage("新密碼至少需 8 個字元。");
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage("兩次輸入的新密碼不一致。");
      return;
    }

    const supabase = getSupabaseClient();
    if (!supabase) return;

    setIsBusy(true);
    setMessage("");
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setIsBusy(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    await supabase.auth.signOut();
    setHasRecoverySession(false);
    setNewPassword("");
    setConfirmPassword("");
    setMessage("密碼已更新，請使用新密碼登入後台。");
  };

  if (!isSupabaseConfigured) {
    return (
      <main className="min-h-screen bg-[#F5F5F5] px-5 py-12 text-[#605B51] sm:px-8 lg:px-12">
        <div className="mx-auto max-w-md rounded-[6px] border border-[#D9D6D0] bg-[#EAE8E4] p-7 sm:p-10">
          <h1 className="text-2xl font-semibold">尚未連接商品資料庫</h1>
          <Link className="mt-6 inline-block text-sm font-medium underline underline-offset-4" href="/admin">回到後台登入</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F5F5F5] px-5 py-12 text-[#605B51] sm:px-8 lg:px-12">
      <div className="mx-auto max-w-md rounded-[6px] border border-[#D9D6D0] bg-[#EAE8E4] p-7 sm:p-10">
        <p className="text-[10px] font-semibold tracking-[0.22em] text-[#605B51]/65">WOBUY174_ ADMIN</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em]">{hasRecoverySession ? "設定新密碼" : "忘記密碼"}</h1>
        {hasRecoverySession ? (
          <form className="mt-7 space-y-4" onSubmit={updatePassword}>
            <label className="block text-sm font-medium">新密碼<input className={inputClass} type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} autoComplete="new-password" required /></label>
            <label className="block text-sm font-medium">再次輸入新密碼<input className={inputClass} type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" required /></label>
            <button className="w-full rounded-full bg-[#605B51] px-5 py-3 text-sm font-medium text-[#F5F5F5] disabled:opacity-50" disabled={isBusy} type="submit">{isBusy ? "儲存中…" : "儲存新密碼"}</button>
          </form>
        ) : (
          <form className="mt-7 space-y-4" onSubmit={requestReset}>
            <p className="text-sm leading-6 text-[#605B51]/75">輸入你的後台登入 Email，我們會寄送重設密碼連結。</p>
            <label className="block text-sm font-medium">Email<input className={inputClass} type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></label>
            <button className="w-full rounded-full bg-[#605B51] px-5 py-3 text-sm font-medium text-[#F5F5F5] disabled:opacity-50" disabled={isBusy} type="submit">{isBusy ? "寄送中…" : "寄送重設連結"}</button>
          </form>
        )}
        {message && <p className="mt-4 text-sm leading-6 text-[#605B51]/75">{message}</p>}
        <Link className="mt-6 inline-block text-sm font-medium underline underline-offset-4 transition-opacity hover:opacity-65" href="/admin">回到後台登入</Link>
      </div>
    </main>
  );
}
