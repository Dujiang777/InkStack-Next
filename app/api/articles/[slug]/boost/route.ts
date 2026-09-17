// POST /api/articles/[slug]/boost — 作者给自己的文章加热：花 80 墨买 24h 信息流加权（可叠加延长）
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getPool, dbEnabled } from "@/lib/db";
import { spendPoints, creditPoints } from "@/lib/points";

const BOOST_COST = 80;

export async function POST(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "登录后才能加热文章" }, { status: 401 });
  if (!dbEnabled()) return NextResponse.json({ error: "加热需要 MySQL" }, { status: 503 });
  const { slug } = await params;
  const pool = await getPool();
  if (!pool) return NextResponse.json({ error: "数据库暂不可用" }, { status: 503 });

  try {
    const [rows] = await pool.query(
      "SELECT id, author_id FROM articles WHERE slug = ? AND status = 'published' LIMIT 1",
      [slug]
    );
    const art = (rows as { id: number; author_id: number }[])[0];
    if (!art) return NextResponse.json({ error: "文章不存在" }, { status: 404 });
    if (Number(art.author_id) !== user.id) {
      return NextResponse.json({ error: "只能加热自己的文章" }, { status: 403 });
    }

    const spend = await spendPoints(user.id, BOOST_COST, "文章加热·24h");
    if (!spend.ok) {
      return NextResponse.json({ error: spend.error }, { status: 402 });
    }

    // 叠加规则：新截止 = MAX(现在, 现有未过期截止) + 24h
    const [ins] = await pool.query(
      `INSERT INTO article_boosts (article_id, user_id, boost_until)
       VALUES (?, ?, DATE_ADD(GREATEST(NOW(), IFNULL(
                  (SELECT MAX(b.boost_until) FROM article_boosts b
                    WHERE b.article_id = ? AND b.boost_until > NOW()), NOW())), INTERVAL 24 HOUR))`,
      [art.id, user.id, art.id]
    );
    if (Number((ins as { affectedRows?: number }).affectedRows ?? 0) !== 1) {
      // 加热写入失败 → 退墨
      const back = await creditPoints(user.id, BOOST_COST, "文章加热失败退还");
      return NextResponse.json(
        { error: `加热失败，${BOOST_COST} 点墨已退回${back.balance !== undefined ? ` · 余额 ${back.balance}` : ""}` },
        { status: 500 }
      );
    }
    const [until] = await pool.query(
      `SELECT MAX(boost_until) AS until_ FROM article_boosts WHERE article_id = ? AND boost_until > NOW()`,
      [art.id]
    );
    const boostUntil = (until as { until_: Date | string | null }[])[0]?.until_ ?? null;
    return NextResponse.json({
      ok: true,
      cost: BOOST_COST,
      balance: spend.balance,
      boostUntil: boostUntil
        ? boostUntil instanceof Date
          ? boostUntil.toISOString()
          : new Date(String(boostUntil)).toISOString()
        : null,
    });
  } catch {
    return NextResponse.json({ error: "加热失败，请稍后再试" }, { status: 500 });
  }
}
