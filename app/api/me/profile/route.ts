// PATCH /api/me/profile — 编辑个人资料（昵称/头像字/简介），登录限定
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getPool } from "@/lib/db";

export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    nickname?: string;
    avatarText?: string;
    bio?: string;
  };
  const nickname = (body.nickname ?? "").trim().slice(0, 20);
  const avatarText = (body.avatarText ?? "").trim().slice(0, 2);
  const bio = (body.bio ?? "").trim().slice(0, 120);

  if (!nickname) return NextResponse.json({ error: "昵称不能为空" }, { status: 400 });

  const pool = await getPool();
  if (!pool) return NextResponse.json({ error: "数据库不可用" }, { status: 500 });
  try {
    await pool.query(`UPDATE users SET nickname = ?, avatar_text = ?, bio = ? WHERE id = ?`, [
      nickname,
      avatarText || nickname.slice(0, 1),
      bio || null,
      user.id,
    ]);
    return NextResponse.json({ ok: true, nickname, avatarText: avatarText || nickname.slice(0, 1), bio });
  } catch {
    return NextResponse.json({ error: "保存失败（数据库异常）" }, { status: 500 });
  }
}
