"use client";

// 墨水补给站：套餐选择 → 创建订单 → 收银台（演示通道）→ 到账
import { useState } from "react";
import { useRouter } from "next/navigation";

type Pack = {
  key: string;
  name: string;
  cents: number;
  points: number;
  tag: string;
  note: string;
};

const PACKS: Pack[] = [
  { key: "starter", name: "尝鲜包", cents: 600, points: 600, tag: "", note: "约 60 次分身问答" },
  { key: "standard", name: "标准包", cents: 1800, points: 2200, tag: "惠", note: "多送 200 滴 · 约 7 篇 AI 长文" },
  { key: "pro", name: "创作者包", cents: 5000, points: 6500, tag: "推荐", note: "多送 500 滴 · 日更作者首选" },
  { key: "studio", name: "工作室包", cents: 12800, points: 17800, tag: "", note: "多送 1000 滴 · 团队/高频使用" },
];

const yuan = (cents: number) => `¥${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;

/* ---------- 用户充值协议（合规 P1：虚拟商品/退款/未成年人） ---------- */
const AGREEMENT_SECTIONS: { t: string; b: string }[] = [
  {
    t: "一、充值性质",
    b: "「墨水」是墨栈平台内用于购买虚拟服务（AI 写作、分身问答、文章加热、墨水打赏等）的虚拟凭证，仅限本平台内使用，不可提现、不可转让、不可兑换法定货币。充值套餐为墨水与赠送额度的组合，价格以订单页展示为准。",
  },
  {
    t: "二、退款规则",
    b: "墨水属即时到账的虚拟商品，一经充值成功即完成交付，原则上不支持无理由退款。若因系统故障造成重复扣费、未到账或多扣墨水，可联系平台客服核实，确认后将在 7 个工作日内原路退回或补足墨水。已消耗的虚拟服务不支持部分退款。",
  },
  {
    t: "三、未成年人保护",
    b: "本平台不建议未满 18 周岁的未成年人使用充值服务。未成年人在监护人不知情的情况下进行的充值，监护人可依据《民法典》相关规定提供证明材料申请退款，平台将依规核实处理。请监护人妥善保管支付账户与设备，并通过平台「未成年人模式」管理消费额度。",
  },
  {
    t: "四、消费安全",
    b: "平台对单账户设有墨水获取与消费的合理上限以防刷防套利；参与打赏、加热等互动请理性消费。若发现账户被盗用产生异常消费，请立即冻结账户并联系客服，平台将协助核查。",
  },
];

export default function TopUpClient() {
  const router = useRouter();
  const [selected, setSelected] = useState<string>("pro");
  const [agreed, setAgreed] = useState(false);
  const [showAgreement, setShowAgreement] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [cashier, setCashier] = useState<{ orderNo: string; pack: Pack } | null>(null);
  const [channel, setChannel] = useState<string | null>(null); // 选中的支付渠道 → 出模拟码
  const [paying, setPaying] = useState(false);
  const [done, setDone] = useState<{ points: number; balance: number } | null>(null);

  async function buy() {
    if (!agreed) {
      setError("请先阅读并同意《用户充值协议》");
      return;
    }
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/topup/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packKey: selected }),
      });
      const d = await r.json();
      if (r.ok && d.ok) {
        setDone(null);
        setCashier({ orderNo: d.orderNo, pack: d.pack });
      } else {
        setError(d.error ?? "下单失败，请稍后再试");
      }
    } catch {
      setError("网络异常，请稍后再试");
    } finally {
      setBusy(false);
    }
  }

  async function pay(channel: string) {
    if (!cashier || paying) return;
    setPaying(true);
    setError("");
    try {
      const r = await fetch("/api/topup/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderNo: cashier.orderNo, channel }),
      });
      const d = await r.json();
      if (r.ok && d.ok) {
        setDone({ points: d.points, balance: d.balance });
        router.refresh(); // 同步页头余额与流水
      } else {
        setError(d.error ?? "支付失败，请稍后再试");
      }
    } catch {
      setError("网络异常，请稍后再试");
    } finally {
      setPaying(false);
    }
  }

  function closeCashier() {
    setCashier(null);
    setChannel(null);
    setDone(null);
    setError("");
  }

  // 模拟二维码：由订单号生成的确定性伪随机格子，仅供沙箱演示
  function fakeQr(orderNo: string, size = 21): boolean[][] {
    let seed = 0;
    for (const c of orderNo) seed = (seed * 31 + c.charCodeAt(0)) >>> 0;
    const rnd = () => {
      seed = (seed * 1103515245 + 12345) >>> 0;
      return ((seed >>> 8) & 1) === 1;
    };
    const g: boolean[][] = [];
    for (let y = 0; y < size; y++) {
      const row: boolean[] = [];
      for (let x = 0; x < size; x++) {
        const finder =
          (x < 7 && y < 7) || (x >= size - 7 && y < 7) || (x < 7 && y >= size - 7);
        row.push(finder ? (x % 6 === 0 || y % 6 === 0 || (x > 1 && x < 5 && y > 1 && y < 5)) : rnd());
      }
      g.push(row);
    }
    return g;
  }

  return (
    <div className="topup">
      <div className="topup-grid">
        {PACKS.map((p) => {
          const sel = selected === p.key;
          const unit = (p.cents / p.points) * 100;
          return (
            <button
              key={p.key}
              className={`pack-card${sel ? " sel" : ""}`}
              onClick={() => setSelected(p.key)}
              type="button"
            >
              {p.tag && <span className="pack-tag">{p.tag}</span>}
              <span className="pack-name">{p.name}</span>
              <b className="pack-points">{p.points.toLocaleString()}</b>
              <span className="pack-unit">墨水 · 合 {unit.toFixed(0)} 滴/元</span>
              <span className="pack-price">{yuan(p.cents)}</span>
              <span className="pack-note">{p.note}</span>
            </button>
          );
        })}
      </div>
      <div className="topup-bar">
        <span className="topup-notice">
          演示支付通道 · 不产生真实扣费。P1 接入微信支付后自动切换，套餐与到账逻辑不变。
        </span>
        <button className="topup-cta" onClick={buy} disabled={busy}>
          {busy ? "下单中…" : `充值 ${PACKS.find((p) => p.key === selected)?.name ?? ""}`}
        </button>
      </div>
      <label className="agree-row">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          aria-label="同意用户充值协议"
        />
        <span>
          我已阅读并同意
          <button className="agree-link" onClick={() => setShowAgreement(true)} type="button">
            《用户充值协议》
          </button>
          （含退款规则与未成年人保护条款）
        </span>
      </label>
      {error && !cashier && <p className="topup-error">{error}</p>}

      {showAgreement && (
        <div className="cashier-mask" onClick={() => setShowAgreement(false)} role="presentation">
          <div className="cashier agreement" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="用户充值协议">
            <span className="kicker">AGREEMENT · 用户充值协议</span>
            <div className="agreement-body">
              {AGREEMENT_SECTIONS.map((s) => (
                <section key={s.t}>
                  <b>{s.t}</b>
                  <p>{s.b}</p>
                </section>
              ))}
            </div>
            <div className="agreement-acts">
              <button
                onClick={() => {
                  setAgreed(true);
                  setShowAgreement(false);
                }}
              >
                同意并继续
              </button>
              <button className="ghost" onClick={() => setShowAgreement(false)}>
                暂不同意
              </button>
            </div>
          </div>
        </div>
      )}

      {cashier && (
        <div className="cashier-mask" onClick={closeCashier} role="presentation">
          <div className="cashier" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="收银台">
            <span className="cashier-no">订单号 {cashier.orderNo}</span>
            {done ? (
              <div className="cashier-done">
                <span className="ink-seal">墨</span>
                <b>+{done.points.toLocaleString()} 滴墨水已入仓</b>
                <p>当前余额 {done.balance.toLocaleString()} 滴</p>
                <button onClick={closeCashier}>好的</button>
              </div>
            ) : channel ? (
              <>
                <div className="cashier-head">
                  <span className="kicker">
                    {channel === "wechat" ? "WECHAT PAY · 微信支付" : "ALIPAY · 支付宝"}
                  </span>
                  <b className="cashier-title">{cashier.pack.name} · {cashier.pack.points.toLocaleString()} 滴墨水</b>
                  <b className="cashier-amount">{yuan(cashier.pack.cents)}</b>
                </div>
                <div className="qr-box" aria-label="模拟支付二维码">
                  <svg viewBox="0 0 21 21" width="168" height="168" role="img">
                    {fakeQr(cashier.orderNo + channel).map((row, y) =>
                      row.map((on, x) =>
                        on ? <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" fill="#1c1a17" /> : null
                      )
                    )}
                  </svg>
                  <span className="qr-tag">沙箱演示码 · 非真实收款</span>
                </div>
                <p className="cashier-note warn">
                  {channel === "wechat"
                    ? "微信支付商户凭证未配置（需 mchid / APIv3 密钥），当前为模拟通道，不会产生真实扣费。"
                    : "支付宝网关凭证未配置，当前为模拟通道，不会产生真实扣费。"}
                </p>
                <button className="pay-channel single" onClick={() => pay(channel)} disabled={paying}>
                  <span className={`ch-ico ${channel === "wechat" ? "ch-wx" : "ch-ali"}`}>✓</span>
                  <span>
                    <b>{paying ? "确认入账中…" : "模拟支付成功"}</b>
                    <i>沙箱自闭环 · 立即到账</i>
                  </span>
                </button>
                <button
                  className="cashier-close"
                  onClick={() => setChannel(null)}
                  disabled={paying}
                >
                  ← 换个支付方式
                </button>
              </>
            ) : (
              <>
                <div className="cashier-head">
                  <span className="kicker">CASHIER · 收银台</span>
                  <b className="cashier-title">{cashier.pack.name} · {cashier.pack.points.toLocaleString()} 滴墨水</b>
                  <b className="cashier-amount">{yuan(cashier.pack.cents)}</b>
                </div>
                <div className="pay-channels">
                  <button className="pay-channel" onClick={() => setChannel("wechat")} type="button">
                    <span className="ch-ico ch-wx">微</span>
                    <span>
                      <b>微信支付</b>
                      <i>凭证未配置 · 模拟通道</i>
                    </span>
                  </button>
                  <button className="pay-channel" onClick={() => setChannel("alipay")} type="button">
                    <span className="ch-ico ch-ali">支</span>
                    <span>
                      <b>支付宝</b>
                      <i>凭证未配置 · 模拟通道</i>
                    </span>
                  </button>
                </div>
                {error && <p className="topup-error">{error}</p>}
                <button className="cashier-close" onClick={closeCashier}>
                  取消支付
                </button>
                <p className="cashier-note">
                  演示环境：选择渠道出模拟码 → 确认后沙箱到账。接入微信支付/支付宝真实凭证后，此处自动拉起正式收银台，套餐与到账逻辑不变。
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
