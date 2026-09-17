// POST /api/comments/[id]/report — 登录读者举报评论（进入运营台处理队列）
// 防重：同一用户对同一评论的未处理举报只保留一条
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getPool } from "@/lib/db";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "登录后才能举报" }, { status: 401 });
  const { id } = await params;
  const commentId = Number(id);
  if (!Number.isInteger(commentId) || commentId <= 0) {
    return NextResponse.json({ error: "评论不存在" }, { status: 400 });
  }
  const pool = await getPool();
  if (!pool) return NextResponse.json({ error: "数据库暂不可用" }, { status: 503 });

  const body = (await req.json().catch(() => ({}))) as { reason?: string };
  const reason = (body.reason ?? "").trim().slice(0, 255);
  if (reason.length < 2) return NextResponse.json({ error: "请填写举报原因（至少 2 字）" }, { status: 400 });

  try {
    const [rows] = await pool.query(`SELECT id FROM comments WHERE id = ? LIMIT 1`, [commentId]);
    const c = (rows as { id: number }[])[0];
    if (!c) return NextResponse.json({ error: "评论不存在或已被删除" }, { status: 404 });

    const [dup] = await pool.query(
      `SELECT 1 FROM reports WHERE reporter_id = ? AND target_type = 'comment' AND target_id = ? AND status = 'open' LIMIT 1`,
      [user.id, commentId]
    );
    if ((dup as Record<string, unknown>[]).length > 0) {
      return NextResponse.json({ error: "该评论已有你提交的举报待处理，请耐心等待" }, { status: 409 });
    }

    await pool.query(
      `INSERT INTO reports (reporter_id, target_type, target_id, reason) VALUES (?, 'comment', ?, ?)`,
      [user.id, commentId, reason]
    );
    return NextResponse.json({ ok: true, message: "举报已提交，运营会尽快核查" });
  } catch {
    return NextResponse.json({ error: "举报失败，请稍后再试" }, { status: 500 });
  }
}
