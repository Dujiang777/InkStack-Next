"use client";

// 付费墙解锁卡：试读结束处展示定价与解锁按钮；解锁成功刷新页面揭示全文
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Props = {
  slug: string;
  price: number;
  /** 早鸟原价（有折扣时用于划线展示） */
  originalPrice?: number;
  /** 早鸟截止时间（ISO）；到点后由服务端计价自动回落原价 */
  discountUntil?: string | null;
  loggedIn: boolean;
  balance: number | null;
  /** 累计解锁人次（>0 时显示热度条） */
  unlockCount?: number;
};

/** 早鸟倒计时：按截止时间显示「还剩 X 天 / X 小时」，每分钟自刷新 */
function useCountdown(until?: string | null): string | null {
  const [, tick] = useState(0);
  useEffect(() => {
    if (!until) return;
    const t = setInterval(() => tick((n) => n + 1), 60_000);
    return () => clearInterval(t);
  }, [until]);
  if (!until) return null;
  const ms = new Date(until).getTime() - Date.now();
  if (ms <= 0) return null;
  const h = Math.floor(ms / 3.6e6);
  if (h >= 48) return `${Math.floor(h / 24)} 天 ${h % 24} 小时`;
  if (h >= 1) return `${h} 小时 ${Math.floor((ms % 3.6e6) / 6e4)} 分`;
  return `${Math.max(1, Math.floor(ms / 6e4))} 分钟`;
}

export default function PaywallCard({ slug, price, originalPrice, discountUntil, unlockCount = 0, loggedIn, balance }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);

  // 付费墙到达埋点：每个浏览器会话对同一篇只记一次，失败静默
  useEffect(() => {
    const key = `pwv:${slug}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      /* 隐私模式等场景忽略 */
    }
    fetch(`/api/articles/${slug}/paywall-view`, { method: "POST" }).catch(() => {});
  }, [slug]);

  const short = balance !== null && balance < price;
  const hasDiscount = Boolean(originalPrice && originalPrice > price);
  const countdown = useCountdown(hasDiscount ? discountUntil : null);

  async function unlock() {
    if (busy || done) return;
    setBusy(true);
    setErr("");
    try {
      const r = await fetch(`/api/articles/${slug}/unlock`, { method: "POST" });
      const d = (await r.json()) as { ok?: boolean; error?: string; already?: boolean };
      if (!r.ok || !d.ok) {
        setErr(d.error ?? "解锁失败，请稍后再试");
        return;
      }
      setDone(true);
      router.refresh(); // 服务端重查 viewerUnlocked，揭示全文
    } catch {
      setErr("网络异常，请稍后再试");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="paywall-card">
      {hasDiscount && countdown && (
        <div className="pw-banner" role="status">
          <span className="pw-banner-flame" aria-hidden="true">
            🔥
          </span>
          <div className="pw-banner-main">
            <b className="pw-banner-title">限时早鸟 · 立省 {originalPrice! - price} 点墨</b>
            <span className="pw-banner-sub">
              距恢复原价 <i className="pw-banner-timer">{countdown}</i>
              {unlockCount > 0 && (
                <>
                  {" · 已售 "}
                  <i className="pw-banner-timer">{unlockCount.toLocaleString()}</i> 份
                </>
              )}
            </span>
          </div>
          <s className="pw-banner-orig">{originalPrice}</s>
        </div>
      )}
      <p className="pw-kicker">PAYWALL · 付费专稿</p>
      <b className="pw-title">试读到此为止</b>
      {unlockCount > 0 && (
        <p className="pw-heat">
          <i className="pw-flame" aria-hidden="true">▲</i>
          已有 {unlockCount.toLocaleString()} 人解锁 · 跟上同频读者
        </p>
      )}
      <p className="pw-desc">
        本文为作者付费专栏稿，解锁后可读全文；作者获得解费用的七成。支持作者持续写作。
      </p>
      {countdown && <span className="pw-earlybird">早鸟倒计时 {countdown}</span>}
      <div className="pw-row">
        <span className="pw-price">
          {hasDiscount && <s className="pw-orig">{originalPrice}</s>}
          {price} <i>点墨</i>
        </span>
        {loggedIn ? (
          <button className="pw-btn" onClick={unlock} disabled={busy || done}>
            {done ? "已解锁 · 揭示全文…" : busy ? "解锁中…" : short ? "墨水不足 · 去补货" : "解锁阅读全文"}
          </button>
        ) : (
          <Link className="pw-btn" href="/login">
            登录后解锁
          </Link>
        )}
      </div>
      {loggedIn && balance !== null && (
        <p className="pw-balance">
          当前余额 {balance.toLocaleString()} 点墨
          {short && (
            <>
              {" · "}
              <Link href="/points" className="pw-topup">
                去墨仓补货 →
              </Link>
            </>
          )}
          {!short && <span className="pw-share"> · 作者得 {Math.floor(price * 0.7)} 点</span>}
        </p>
      )}
      {err && <p className="pw-err">✕ {err}</p>}
    </div>
  );
}
