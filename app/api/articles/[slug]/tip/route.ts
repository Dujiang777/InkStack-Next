// POST /api/articles/[slug]/tip — 墨水打赏：读者花点墨打赏作者，作者得 90%（平台抽成 10%）
// 档位：10 / 50 点墨。禁止给自己的文章打赏。
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getPool, dbEnabled } from "@/lib/db";
import { spendPoints, creditPoints } from "@/lib/points";
import { notify } from "@/lib/notify";

const TIP_AMOUNTS = [10, 50];
const AUTHOR_SHARE = 0.9;

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "登录后才能打赏" }, { status: 401 });
  if (!dbEnabled()) return NextResponse.json({ error: "打赏需要 MySQL" }, { status: 503 });
  const { slug } = await params;
  const pool = await getPool();
  if (!pool) return NextResponse.json({ error: "数据库暂不可用" }, { status: 503 });

  const body = (await req.json().catch(() => ({}))) as { amount?: number };
  const amount = Number(body.amount);
  if (!TIP_AMOUNTS.includes(amount)) {
    return NextResponse.json({ error: `打赏档位须为 ${TIP_AMOUNTS.join(" 或 ")} 点墨` }, { status: 400 });
  }

  try {
    const [rows] = await pool.query(
      "SELECT id, author_id FROM articles WHERE slug = ? AND status = 'published' LIMIT 1",
      [slug]
    );
    const art = (rows as { id: number; author_id: number }[])[0];
    if (!art) return NextResponse.json({ error: "文章不存在" }, { status: 404 });
    if (Number(art.author_id) === user.id) {
      return NextResponse.json({ error: "不能给自己的文章打赏" }, { status: 400 });
    }

    const spend = await spendPoints(user.id, amount, "墨水打赏");
    if (!spend.ok) {
      return NextResponse.json({ error: spend.error }, { status: 402 });
    }

    const authorGot = Math.floor(amount * AUTHOR_SHARE);
    const back = await creditPoints(Number(art.author_id), authorGot, "收到打赏");
    if (!back.ok) {
      // 作者到账失败 → 退回打赏者
      const refund = await creditPoints(user.id, amount, "打赏失败退还");
      return NextResponse.json(
        { error: `打赏失败，${amount} 点墨已退回${refund.balance !== undefined ? ` · 余额 ${refund.balance}` : ""}` },
        { status: 500 }
      );
    }

    await pool
      .query(
        "INSERT INTO article_tips (article_id, from_user, to_user, amount) VALUES (?, ?, ?, ?)",
        [art.id, user.id, Number(art.author_id), amount]
      )
      .catch(() => {});

    // 站内通知作者（失败静默）
    notify(Number(art.author_id), "tip", "收到墨水打赏", `${user.nickname} 打赏了 ${amount} 点墨，你收到 ${authorGot} 点`, `/article/${slug}`);

    return NextResponse.json({
      ok: true,
      tipped: amount,
      authorGot,
      balance: spend.balance,
    });
  } catch {
    return NextResponse.json({ error: "打赏失败，请稍后再试" }, { status: 500 });
  }
}
