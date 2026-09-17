import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getAuthor, listAuthorArticles, followStats, isFollowing, listSeries, effectiveUnlockPrice } from "@/lib/data";
import FollowButton from "@/components/FollowButton";
import { plainText } from "@/components/plain-text";

// 作者主页 /author/[id]：头卡（资料/统计/关注）+ 专栏架 + 公开文章列表
export default async function AuthorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const authorId = Number(id);
  const author = Number.isInteger(authorId) ? await getAuthor(authorId) : null;
  if (!author) notFound();

  const viewer = await getCurrentUser();
  const isSelf = viewer?.id === author.id;
  const [articles, stats, following, series] = await Promise.all([
    listAuthorArticles(author.id, 50),
    followStats(author.id),
    isSelf ? Promise.resolve(false) : isFollowing(viewer?.id ?? null, author.id),
    listSeries(6, author.id),
  ]);
  const totalRead = author.readTotal;

  return (
    <div className="author-page">
      <section className="author-hero" aria-label="作者资料">
        <span className="avatar avatar-xl" aria-hidden="true">
          {author.avatarText}
        </span>
        <div className="author-hero-main">
          <span className="kicker">CONTRIBUTOR · 驻站作者</span>
          <h1 className="author-name">
            {author.nickname}
            {isSelf && <span className="tag-chip accent">这是我</span>}
          </h1>
          <p className="author-bio">{author.bio || "这位作者还没留下签名。"}</p>
          <p className="author-since">墨栈入驻 · {author.createdAt || "—"}</p>
        </div>
        <div className="author-hero-side">
          <dl className="author-stats">
            <div>
              <b>{author.articles.toLocaleString()}</b>
              <dt>文章</dt>
            </div>
            <div>
              <b>{author.likes.toLocaleString()}</b>
              <dt>获赞</dt>
            </div>
            <div>
              <b>{totalRead.toLocaleString()}</b>
              <dt>阅读</dt>
            </div>
            <div>
              <b>{stats.followers.toLocaleString()}</b>
              <dt>读者</dt>
            </div>
          </dl>
          {isSelf ? (
            <Link className="hero-cta ghost" href="/study">
              管理我的书房 →
            </Link>
          ) : (
            <FollowButton
              authorId={author.id}
              initialFollowing={following}
              initialFollowers={stats.followers}
            />
          )}
        </div>
      </section>

      {series.length > 0 && (
        <>
          <div className="section-head">
            <h2>TA 的专栏</h2>
            <span className="more muted">{series.length} 本</span>
          </div>
          <ol className="series-shelf">
            {series.map((s) => (
              <li key={s.id} className="series-card">
                <div className="sc-main">
                  <Link href={`/series/${s.id}`} className="sc-title">
                    {s.title}
                    <i className="sc-count">{s.articleCount} 篇</i>
                  </Link>
                  {s.description && <p className="sc-desc">{s.description}</p>}
                  <p className="sc-meta">
                    <span>{s.totalReads.toLocaleString()} 阅</span>
                    {s.soldCount > 0 && (
                      <span className="sc-sold" title="打包解锁篇目人次">
                        ▲ 售出 {s.soldCount.toLocaleString()} 篇次
                      </span>
                    )}
                    <span>更新于 {s.updatedAt}</span>
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </>
      )}

      <div className="section-head">
        <h2>TA 的文章</h2>
        <span className="more muted">{articles.length} 篇公开</span>
      </div>

      {articles.length === 0 ? (
        <section className="hero hero-empty">
          <h1 className="hero-title">还没有公开文章</h1>
          <p className="hero-excerpt">也许好墨正在研磨中——关注 TA，第一时间收到新作。</p>
        </section>
      ) : (
        <div className="grid">
          {articles.map((a, i) => (
            <article className="card card-ink" key={a.slug}>
              <span className="idx" aria-hidden="true">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="tag-chip">{a.tags[0] ?? a.coverLabel}</span>
              {(a.unlockPrice ?? 0) > 0 && <span className="tag-chip paid">付费 {effectiveUnlockPrice(a)}墨</span>}
              {(a.tipTotal ?? 0) >= 50 && <span className="tag-chip tip">赏 {(a.tipTotal ?? 0)}</span>}
              <h3>
                <Link href={`/article/${a.slug}`}>{a.title}</Link>
              </h3>
              <p>{plainText(a.summary)}</p>
              <div className="meta">
                <span>{a.publishedAt}</span>
                <span>
                  阅读 <b>{(a.readCount / 1000).toFixed(1)}k</b>
                </span>
                <span>
                  赞 <b>{a.likeCount}</b>
                </span>
                <span>
                  评 <b>{a.commentCount}</b>
                </span>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
