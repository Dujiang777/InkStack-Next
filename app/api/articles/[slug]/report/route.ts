// POST /api/articles/[slug]/report — 登录读者举报文章（进入运营台处理队列）
// 防重：同一用户对同一目标的未处理举报只保留一条
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getPool } from "@/lib/db";

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "登录后才能举报" }, { status: 401 });
  const { slug } = await params;
  const pool = await getPool();
  if (!pool) return NextResponse.json({ error: "数据库暂不可用" }, { status: 503 });

  const body = (await req.json().catch(() => ({}))) as { reason?: string };
  const reason = (body.reason ?? "").trim().slice(0, 255);
  if (reason.length < 2) return NextResponse.json({ error: "请填写举报原因（至少 2 字）" }, { status: 400 });

  try {
    const [rows] = await pool.query(
      `SELECT id FROM articles WHERE slug = ? AND status = 'published' LIMIT 1`,
      [slug]
    );
    const art = (rows as { id: number }[])[0];
    if (!art) return NextResponse.json({ error: "文章不存在" }, { status: 404 });

    const [dup] = await pool.query(
      `SELECT 1 FROM reports WHERE reporter_id = ? AND target_type = 'article' AND target_id = ? AND status = 'open' LIMIT 1`,
      [user.id, art.id]
    );
    if ((dup as Record<string, unknown>[]).length > 0) {
      return NextResponse.json({ error: "该文章已有你提交的举报待处理，请耐心等待" }, { status: 409 });
    }

    await pool.query(
      `INSERT INTO reports (reporter_id, target_type, target_id, reason) VALUES (?, 'article', ?, ?)`,
      [user.id, art.id, reason]
    );
    return NextResponse.json({ ok: true, message: "举报已提交，运营会尽快核查" });
  } catch {
    return NextResponse.json({ error: "举报失败，请稍后再试" }, { status: 500 });
  }
}
