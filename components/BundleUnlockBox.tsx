"use client";

// 专栏打包解锁盒：鎏金一口价，划线对比单买合计；按购买时点篇目快照解锁
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Props = {
  seriesId: number;
  price: number;
  /** 未解锁篇目单买合计（划线对比） */
  fullPrice: number;
  /** 待解锁付费篇目数 */
  paidCount: number;
  loggedIn: boolean;
  balance: number | null;
  /** 已经打包购买过（服务端判定后不再渲染本组件） */
  /** 打包累计解锁篇目人次（>0 时显示热度条） */
  soldCount?: number;
};

export default function BundleUnlockBox({
  seriesId,
  price,
  fullPrice,
  paidCount,
  loggedIn,
  balance,
  soldCount = 0,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);

  const short = balance !== null && balance < price;
  const save = fullPrice > price ? fullPrice - price : 0;

  async function buy() {
    if (busy || done) return;
    setBusy(true);
    setErr("");
    try {
      const r = await fetch(`/api/series/${seriesId}/bundle`, { method: "POST" });
      const d = (await r.json()) as { ok?: boolean; error?: string };
      if (!r.ok || !d.ok) {
        setErr(d.error ?? "打包解锁失败，请稍后再试");
        return;
      }
      setDone(true);
      router.refresh(); // 服务端重查解锁态，逐篇揭示
    } catch {
      setErr("网络异常，请稍后再试");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bundle-box">
      <p className="bb-kicker">BUNDLE · 全栏一口价</p>
      <b className="bb-title">整栏打包 · 一次带走</b>
      {soldCount > 0 && (
        <p className="bb-heat">
          <i className="pw-flame" aria-hidden="true">▲</i>
          已有 {soldCount.toLocaleString()} 篇次经打包解锁 · 同频读者都在收
        </p>
      )}
      <p className="bb-desc">
        一口价解锁本栏全部 {paidCount} 篇付费专稿（按购买时点计）；已单买的篇目自动折抵，不重复收费。
      </p>
      <div className="bb-row">
        <span className="bb-price">
          {fullPrice > price && <s className="bb-orig">单买 {fullPrice}</s>}
          {price} <i>点墨</i>
        </span>
        {save > 0 && <span className="bb-save">立省 {save} 点</span>}
        {loggedIn ? (
          <button className="bb-btn" onClick={buy} disabled={busy || done}>
            {done ? "已打包 · 揭示全栏…" : busy ? "解锁中…" : short ? "墨水不足 · 去补货" : "打包解锁全栏"}
          </button>
        ) : (
          <Link className="bb-btn" href="/login">
            登录后打包解锁
          </Link>
        )}
      </div>
      {loggedIn && balance !== null && (
        <p className="bb-balance">
          当前余额 {balance.toLocaleString()} 点墨
          {short && (
            <>
              {" · "}
              <Link href="/points" className="bb-topup">
                去墨仓补货 →
              </Link>
            </>
          )}
          {!short && <span className="bb-share"> · 作者得 {Math.floor(price * 0.7)} 点</span>}
        </p>
      )}
      {err && <p className="pw-err">✕ {err}</p>}
    </div>
  );
}
