"use client";

// 个人中心客户端：资料编辑模态 + 改密卡 + 关注/点赞/评论足迹 tab
import { useState } from "react";
import { useRouter } from "next/navigation";

type Me = {
  id: number;
  nickname: string;
  email: string;
  avatarText: string;
  role: string;
  points: number;
};
type Following = { id: number; nickname: string; avatarText: string; bio: string; articles: number };
type LikeItem = { slug: string; title: string; author: string; readCount: number };
type CommentItem = { id: number; content: string; createdAt: string; articleSlug: string; articleTitle: string };
type BookmarkItem = { slug: string; title: string; author: string; readCount: number; savedAt: string };
type HistoryItem = { slug: string; title: string; author: string; readCount: number; readAt: string; times: number };
type Achievement = { key: string; name: string; desc: string; icon: string; earned: boolean; progress: number; progressText: string };

const REWARD_AMOUNT = 100;

const ROLE_LABEL: Record<string, string> = { admin: "站长", author: "作者", reader: "读者" };

/** 快捷入口：个人中心的高频动作一跳直达 */
const QUICK_LINKS: { href: string; title: string; desc: string; no: string }[] = [
  { href: "/studio", title: "AI 创作台", desc: "让分身陪你写下一篇", no: "写" },
  { href: "/study", title: "我的书房", desc: "草稿 / 已发布 / 数据", no: "房" },
  { href: "/points", title: "墨仓", desc: "余额 · 流水 · 充值", no: "墨" },
  { href: "/notifications", title: "通知中心", desc: "评论 · 打赏 · 审核", no: "信" },
];

export default function MeClient({
  me,
  bio,
  createdAt,
  stats,
  following,
  followers,
  likes,
  comments,
  bookmarks,
  history,
  achievements,
  rewardClaimed,
}: {
  me: Me;
  bio: string;
  createdAt: string;
  stats: { followers: number; following: number };
  following: Following[];
  followers: Following[];
  likes: LikeItem[];
  comments: CommentItem[];
  bookmarks: BookmarkItem[];
  history: HistoryItem[];
  achievements: Achievement[];
  rewardClaimed: boolean;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"following" | "followers" | "likes" | "comments" | "bookmarks" | "history">("following");
  const [claimState, setClaimState] = useState<"idle" | "busy" | "done" | "error">(rewardClaimed ? "done" : "idle");
  const [claimMsg, setClaimMsg] = useState("");

  const earnedCount = achievements.filter((a) => a.earned).length;
  const allEarned = achievements.length > 0 && earnedCount === achievements.length;

  async function claimReward() {
    if (claimState === "busy" || claimState === "done") return;
    setClaimState("busy");
    setClaimMsg("");
    try {
      const res = await fetch("/api/me/badge-claim", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.ok) {
        setClaimState("done");
        setClaimMsg(data.message || `奖励 ${REWARD_AMOUNT} 滴墨水已入账`);
        router.refresh();
      } else {
        setClaimState("error");
        setClaimMsg(data.error || "领取失败，请稍后再试");
      }
    } catch {
      setClaimState("error");
      setClaimMsg("网络异常，请稍后再试");
    }
  }
  const [unfollowed, setUnfollowed] = useState<number[]>([]);

  /* ---------- 资料编辑 ---------- */
  const [editOpen, setEditOpen] = useState(false);
  const [nick, setNick] = useState(me.nickname);
  const [avatarText, setAvatarText] = useState(me.avatarText);
  const [bioText, setBioText] = useState(bio);
  const [profileMsg, setProfileMsg] = useState("");
  const [profileErr, setProfileErr] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  async function saveProfile() {
    if (savingProfile) return;
    setSavingProfile(true);
    setProfileMsg("");
    setProfileErr("");
    try {
      const r = await fetch("/api/me/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: nick, avatarText, bio: bioText }),
      });
      const d = (await r.json()) as { ok?: boolean; error?: string };
      if (r.ok && d.ok) {
        setProfileMsg("资料已更新");
        setTimeout(() => {
          setEditOpen(false);
          router.refresh();
        }, 700);
      } else {
        setProfileErr(d.error ?? "保存失败");
      }
    } catch {
      setProfileErr("网络异常，请稍后再试");
    } finally {
      setSavingProfile(false);
    }
  }

  /* ---------- 改密 ---------- */
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [pwMsg, setPwMsg] = useState("");
  const [pwErr, setPwErr] = useState("");
  const [savingPw, setSavingPw] = useState(false);

  async function savePassword() {
    if (savingPw) return;
    setPwMsg("");
    setPwErr("");
    if (newPw !== pw2) {
      setPwErr("两次输入的新密码不一致");
      return;
    }
    setSavingPw(true);
    try {
      const r = await fetch("/api/me/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oldPassword: oldPw, newPassword: newPw }),
      });
      const d = (await r.json()) as { ok?: boolean; error?: string };
      if (r.ok && d.ok) {
        setPwMsg("密码已更新，下次登录请使用新密码");
        setOldPw("");
        setNewPw("");
        setPw2("");
      } else {
        setPwErr(d.error ?? "修改失败");
      }
    } catch {
      setPwErr("网络异常，请稍后再试");
    } finally {
      setSavingPw(false);
    }
  }

  /* ---------- 取关 ---------- */
  async function unfollow(id: number) {
    try {
      const r = await fetch(`/api/users/${id}/follow`, { method: "POST" });
      const d = (await r.json()) as { ok?: boolean; following?: boolean };
      if (r.ok && d.ok && d.following === false) {
        setUnfollowed((u) => [...u, id]);
      }
    } catch {
      /* 静默 */
    }
  }

  const shownFollowing = following.filter((f) => !unfollowed.includes(f.id));

  return (
    <div className="me-page">
      {/* ---------- 资料头卡 ---------- */}
      <section className="me-head">
        <span className="avatar me-avatar" aria-hidden="true">
          {me.avatarText}
        </span>
        <div className="me-id">
          <h1>
            {me.nickname}
            <span className={"role-chip rc-" + me.role}>{ROLE_LABEL[me.role] ?? me.role}</span>
          </h1>
          <p className="me-email">{me.email}</p>
          {bioText && <p className="me-bio">{bioText}</p>}
          <p className="me-since">驻站于 {createdAt}</p>
        </div>
        <div className="me-actions">
          <button className="btn main" onClick={() => setEditOpen(true)}>
            编辑资料
          </button>
          <a className="btn ghost" href="/study">
            我的书房 →
          </a>
        </div>
      </section>

      {/* ---------- 数据带 ---------- */}
      <section className="me-strip">
        <a className="me-cell" href="/points">
          <b>{me.points.toLocaleString()}</b>
          <span>墨水余额</span>
        </a>
        <div className="me-cell">
          <b>{stats.followers.toLocaleString()}</b>
          <span>读者关注了我</span>
        </div>
        <div className="me-cell">
          <b>{stats.following.toLocaleString()}</b>
          <span>我关注的作者</span>
        </div>
        <div className="me-cell">
          <b>{likes.length.toLocaleString()}</b>
          <span>点赞过的文章</span>
        </div>
        <div className="me-cell">
          <b>{comments.length.toLocaleString()}</b>
          <span>发表的评论</span>
        </div>
      </section>

      {/* ---------- 快捷操作 ---------- */}
      <section className="me-quick" aria-label="快捷入口">
        {QUICK_LINKS.map((q) => (
          <a key={q.href} className="quick-card" href={q.href}>
            <span className="quick-no" aria-hidden="true">
              {q.no}
            </span>
            <b>{q.title}</b>
            <small>{q.desc}</small>
          </a>
        ))}
      </section>

      {/* ---------- 成就徽章墙 ---------- */}
      <section className="me-badges" aria-label="成就徽章">
        <div className="section-head">
          <h2>成就墙</h2>
          <span className="badge-reward-zone">
            <span className="more muted">
              已点亮 {earnedCount} / {achievements.length}
            </span>
            {allEarned && claimState !== "done" && (
              <button className="badge-claim" onClick={claimReward} disabled={claimState === "busy"}>
                {claimState === "busy" ? "发放中…" : `集齐 ${achievements.length} 枚 · 领 ${REWARD_AMOUNT} 滴墨水`}
              </button>
            )}
            {claimState === "done" && <span className="badge-claimed">✓ 奖励已领取</span>}
          </span>
        </div>
        {claimMsg && claimState === "error" && <p className="claim-error">{claimMsg}</p>}
        <ul className="badge-wall">
          {achievements.map((a) => (
            <li key={a.key} className={"badge" + (a.earned ? " on" : "")} title={a.desc}>
              <span className="badge-seal" aria-hidden="true">
                {a.icon}
              </span>
              <b>{a.earned ? a.name : "？"}</b>
              <small>{a.earned ? a.desc : a.desc}</small>
              {a.earned ? (
                <i className="badge-progress done">已点亮</i>
              ) : (
                <i className="badge-progress">
                  <span className="bp-bar" aria-hidden="true">
                    <span style={{ width: Math.round(a.progress * 100) + "%" }} />
                  </span>
                  {a.progressText}
                </i>
              )}
            </li>
          ))}
        </ul>
      </section>

      {/* ---------- 足迹 ---------- */}
      <section className="me-footprint">
        <div className="me-tabs" role="tablist">
          {(
            [
              ["following", `我的关注 · ${shownFollowing.length}`],
              ["followers", `我的粉丝 · ${followers.length}`],
              ["likes", `我的点赞 · ${likes.length}`],
              ["comments", `我的评论 · ${comments.length}`],
              ["bookmarks", `书签 · ${bookmarks.length}`],
              ["history", `最近读过 · ${history.length}`],
            ] as const
          ).map(([k, label]) => (
            <button key={k} className={"me-tab" + (tab === k ? " on" : "")} onClick={() => setTab(k)} role="tab">
              {label}
            </button>
          ))}
        </div>

        {tab === "followers" && (
          <ul className="me-list">
            {followers.length === 0 && (
              <li className="me-empty">还没有粉丝。多发好文、参与评论互动，读者自然会找到你。</li>
            )}
            {followers.map((f) => (
              <li key={f.id} className="me-row">
                <a className="avatar" href={`/author/${f.id}`} aria-hidden="true" tabIndex={-1}>
                  {f.avatarText}
                </a>
                <div className="mr-main">
                  <a href={`/author/${f.id}`}>
                    <b>{f.nickname}</b>
                  </a>
                  <small>{f.bio || "这位读者很神秘，还没有留下简介"}</small>
                </div>
                <span className="mr-meta">{f.articles} 篇在版</span>
              </li>
            ))}
          </ul>
        )}

        {tab === "following" && (
          <ul className="me-list">
            {shownFollowing.length === 0 && (
              <li className="me-empty">还没有关注任何作者。读文章时点「+ 关注」，TA 的新动态就会出现在这里。</li>
            )}
            {shownFollowing.map((f) => (
              <li key={f.id} className="me-row">
                <a className="avatar" href={`/author/${f.id}`} aria-hidden="true" tabIndex={-1}>
                  {f.avatarText}
                </a>
                <div className="mr-main">
                  <a href={`/author/${f.id}`}>
                    <b>{f.nickname}</b>
                  </a>
                  <small>{f.bio || "这位作者很神秘，还没有留下简介"}</small>
                </div>
                <span className="mr-meta">{f.articles} 篇在版</span>
                <button className="btn ghost sm" onClick={() => unfollow(f.id)}>
                  取关
                </button>
              </li>
            ))}
          </ul>
        )}

        {tab === "likes" && (
          <ul className="me-list">
            {likes.length === 0 && <li className="me-empty">还没有点赞记录。看到好文点个 ♥，作者会收到通知。</li>}
            {likes.map((l) => (
              <li key={l.slug} className="me-row">
                <div className="mr-main">
                  <a href={`/article/${l.slug}`}>
                    <b>{l.title}</b>
                  </a>
                  <small>
                    {l.author} · {l.readCount.toLocaleString()} 阅读
                  </small>
                </div>
                <span className="mr-meta liked">♥</span>
              </li>
            ))}
          </ul>
        )}

        {tab === "comments" && (
          <ul className="me-list">
            {comments.length === 0 && <li className="me-empty">还没有发过评论。参与讨论每天可得墨水奖励。</li>}
            {comments.map((c) => (
              <li key={c.id} className="me-row">
                <div className="mr-main">
                  <a href={`/article/${c.articleSlug}`}>
                    <b className="mc-title">{c.articleTitle}</b>
                  </a>
                  <p className="mc-content">{c.content}</p>
                  <small>{c.createdAt}</small>
                </div>
              </li>
            ))}
          </ul>
        )}

        {tab === "bookmarks" && (
          <ul className="me-list">
            {bookmarks.length === 0 && (
              <li className="me-empty">书签架还空着。读文章时点「☆ 收藏」，好文随时回来续读。</li>
            )}
            {bookmarks.map((b) => (
              <li key={b.slug} className="me-row">
                <div className="mr-main">
                  <a href={`/article/${b.slug}`}>
                    <b>{b.title}</b>
                  </a>
                  <small>
                    {b.author} · {b.readCount.toLocaleString()} 阅读
                  </small>
                </div>
                <span className="mr-meta saved">★ {b.savedAt}</span>
              </li>
            ))}
          </ul>
        )}
        {tab === "history" && (
          <ul className="me-list">
            {history.length === 0 && (
              <li className="me-empty">还没有阅读足迹。随便漫游一篇，这里会记下你读过的文章。</li>
            )}
            {history.map((h) => (
              <li key={h.slug} className="me-row">
                <div className="mr-main">
                  <a href={`/article/${h.slug}`}>
                    <b>{h.title}</b>
                  </a>
                  <small>
                    {h.author} · {h.readCount.toLocaleString()} 阅读{h.times > 1 ? ` · 你已读 ${h.times} 遍` : ""}
                  </small>
                </div>
                <span className="mr-meta">{h.readAt}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ---------- 安全 ---------- */}
      <section className="me-security">
        <h3 className="section-title">账号安全</h3>
        <div className="pw-form">
          <input
            type="password"
            value={oldPw}
            onChange={(e) => setOldPw(e.target.value)}
            placeholder="当前密码"
            autoComplete="current-password"
          />
          <input
            type="password"
            value={newPw}
            onChange={(e) => setNewPw(e.target.value)}
            placeholder="新密码（至少 8 位）"
            autoComplete="new-password"
          />
          <input
            type="password"
            value={pw2}
            onChange={(e) => setPw2(e.target.value)}
            placeholder="再输一遍新密码"
            autoComplete="new-password"
          />
          <button className="btn main" onClick={savePassword} disabled={savingPw || !oldPw || !newPw}>
            {savingPw ? "提交中…" : "修改密码"}
          </button>
          {pwMsg && <p className="pw-ok">{pwMsg}</p>}
          {pwErr && <p className="pw-err">{pwErr}</p>}
        </div>
      </section>

      {/* ---------- 资料编辑模态 ---------- */}
      {editOpen && (
        <div className="cashier-mask" onClick={() => setEditOpen(false)} role="presentation">
          <div className="cashier me-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="编辑资料">
            <span className="kicker">PROFILE · 编辑资料</span>
            <div className="me-form">
              <label>
                昵称
                <input value={nick} onChange={(e) => setNick(e.target.value)} maxLength={20} />
              </label>
              <label>
                头像字（1-2 个字）
                <input value={avatarText} onChange={(e) => setAvatarText(e.target.value)} maxLength={2} />
              </label>
              <label>
                一句话简介
                <textarea
                  value={bioText}
                  onChange={(e) => setBioText(e.target.value)}
                  maxLength={120}
                  rows={3}
                  placeholder="告诉读者你是谁、在写什么…"
                />
              </label>
            </div>
            {profileMsg && <p className="pw-ok">{profileMsg}</p>}
            {profileErr && <p className="pw-err">{profileErr}</p>}
            <div className="cashier-btns">
              <button className="cashier-close" onClick={() => setEditOpen(false)}>
                取消
              </button>
              <button className="btn main" onClick={saveProfile} disabled={savingProfile || !nick.trim()}>
                {savingProfile ? "保存中…" : "保存"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
