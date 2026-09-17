import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getSeriesDetail } from "@/lib/data";
import { getCurrentUser } from "@/lib/auth";
import BundleUnlockBox from "@/components/BundleUnlockBox";

export const dynamic = "force-dynamic";

// 专栏落地页：卷首语 + 有序篇目（壹贰叁编号）+ 打包解锁盒（一口价鎏金盒），一条完整的阅读动线
const NO = ["壹", "贰", "叁", "肆", "伍", "陆", "柒", "捌", "玖", "拾"];

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const s = await getSeriesDetail(Number(id));
  if (!s) return { title: "专栏不存在 · 墨栈" };
  return {
    title: `《${s.title}》 · 专栏 · 墨栈 InkStack`,
    description: s.description || `${s.author} 的专栏，共 ${s.items.length} 篇。`,
  };
}

export default async function SeriesDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const viewer = await getCurrentUser();
  const s = await getSeriesDetail(id, { id: viewer?.id ?? null });
  if (!s) notFound();
  const isOwn = viewer?.id != null && viewer.id === s.authorId;

  // 打包盒展示条件：开了打包价、浏览者非作者、还没打包买过、确实还有待解锁的付费篇
  const lockedPaid = s.items.filter((x) => x.lockedForViewer);
  const showBundle =
    s.bundlePrice !== null && !isOwn && !s.bundlePurchased && lockedPaid.length > 0 && s.bundlePrice < s.fullPrice;

  return (
    <div className="series-page series-landing">
      <header className="series-hero">
        <p className="series-kicker">
          COLUMN · <Link href={`/author/${s.authorId}`} className="sl-author">{s.author}</Link> 的专栏
        </p>
        <h1 className="series-title">《{s.title}》</h1>
        {s.description && <p className="series-sub">{s.description}</p>}
        <p className="sl-stat">
          共 {s.items.length} 篇{` `}· 累计 {s.items.reduce((n, x) => n + x.readCount, 0).toLocaleString()} 阅读
          {s.soldCount > 0 && <> · <span className="sl-sold">打包 {s.soldCount.toLocaleString()} 篇次</span></>}
          {` `}
          <span className="avatar sl-ava" aria-hidden="true">
            {s.authorAvatar}
          </span>
        </p>
      </header>

      {showBundle && (
        <BundleUnlockBox
          seriesId={s.id}
          price={s.bundlePrice!}
          fullPrice={s.fullPrice}
          paidCount={lockedPaid.length}
          loggedIn={Boolean(viewer)}
          balance={viewer?.points ?? null}
          soldCount={s.soldCount}
        />
      )}
      {s.bundlePurchased && (
        <p className="sl-owned-banner">✦ 本专栏已打包入手，全部篇目任你读</p>
      )}

      {s.items.length === 0 ? (
        isOwn ? (
          <div className="series-empty own">
            <span className="se-seal" aria-hidden="true">
              空柜
            </span>
            <b>这本柜子立好了，还空着</b>
            <ol className="se-steps">
              <li>回书房 · 专栏管理，从你「已发布且过审」的文章里挑篇目订进来；</li>
              <li>篇目建议 4 篇起步，成柜后读者才有「按序读完」的动线；</li>
              <li>想整柜卖就设个打包价（一口价），不打包也只按篇解锁。</li>
            </ol>
            <Link className="series-cta" href="/study">
              去书房布置 →
            </Link>
          </div>
        ) : (
          <div className="series-empty">
            <b>博主正在筹备这一柜</b>
            <p>篇目已在选定中，过审发布后就会出现在这里。可以先去合集架逛逛别的。</p>
            <Link className="series-cta" href="/series">
              回合集架 →
            </Link>
          </div>
        )
      ) : (
        <ol className="sl-list">
          {s.items.map((it, i) => (
            <li key={it.slug} className="sl-row">
              <span className="sl-no">{NO[i] ?? i + 1}</span>
              <div className="sl-main">
                <Link href={`/article/${it.slug}`} className="sl-title">
                  {it.title}
                </Link>
                <span className="sl-meta">
                  {it.publishedAt} · {it.readCount.toLocaleString()} 阅读
                </span>
              </div>
              {it.lockedForViewer ? (
                <span className="sl-lock" title="付费专稿，需解锁">
                  锁 {it.unlockPrice} 点
                </span>
              ) : it.unlockPrice > 0 ? (
                <span className="sl-lock owned">已解锁</span>
              ) : null}
              <span className="sl-idx">{String(i + 1).padStart(2, "0")}</span>
            </li>
          ))}
        </ol>
      )}

      <p className="sl-back">
        <Link href="/series">← 回合集架</Link>
      </p>
    </div>
  );
}
