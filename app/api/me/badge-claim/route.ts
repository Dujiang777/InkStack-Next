import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getPool } from "@/lib/db";
import { listAchievements, BADGE_REWARD_REASON, BADGE_REWARD_AMOUNT } from "@/lib/data";

// POST /api/me/badge-claim —— 集齐全部成就徽章后一次性领取 100 滴墨水
// v15.0：原子化领取——同事务内 FOR UPDATE 锁用户行（串行化同人并发）+
// 先查流水判重再入账，杜绝并发双领
export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }
  const pool = await getPool();
  if (!pool) {
    return NextResponse.json({ error: "数据库未配置" }, { status: 503 });
  }

  const achievements = await listAchievements(user.id);
  const earned = achievements.filter((a) => a.earned).length;
  if (achievements.length === 0 || earned < achievements.length) {
    return NextResponse.json(
      { error: `还差 ${achievements.length - earned} 枚徽章才能领取奖励` },
      { status: 400 }
    );
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    // 锁用户行：同一用户的并发领取在此串行化
    await conn.query(`SELECT points_balance FROM users WHERE id = ? FOR UPDATE`, [user.id]);
    const [dup] = await conn.query(
      `SELECT id FROM point_ledger WHERE user_id = ? AND reason = ? LIMIT 1`,
      [user.id, BADGE_REWARD_REASON]
    );
    if (Array.isArray(dup) && (dup as unknown[]).length > 0) {
      await conn.rollback();
      return NextResponse.json({ error: "奖励已经领取过啦" }, { status: 409 });
    }
    await conn.query(`UPDATE users SET points_balance = points_balance + ? WHERE id = ?`, [
      BADGE_REWARD_AMOUNT,
      user.id,
    ]);
    await conn.query(`INSERT INTO point_ledger (user_id, delta, reason) VALUES (?, ?, ?)`, [
      user.id,
      BADGE_REWARD_AMOUNT,
      BADGE_REWARD_REASON,
    ]);
    const [after] = await conn.query(`SELECT points_balance FROM users WHERE id = ?`, [user.id]);
    const balance = Number((after as Record<string, unknown>[])[0]?.points_balance ?? 0);
    await conn.commit();
    conn.release();

    // 站内信通知（事务外，失败不阻塞）
    pool
      .query(`INSERT INTO notifications (user_id, type, title, body, link, is_read) VALUES (?, 'system', ?, ?, '/me', 0)`, [
        user.id,
        "成就墙全部点亮！",
        `恭喜集齐 ${achievements.length} 枚徽章，奖励 ${BADGE_REWARD_AMOUNT} 滴墨水已入账。`,
      ])
      .catch(() => {});

    return NextResponse.json({
      ok: true,
      amount: BADGE_REWARD_AMOUNT,
      balance,
      message: `集齐 ${achievements.length} 枚徽章，${BADGE_REWARD_AMOUNT} 滴墨水已入账！`,
    });
  } catch {
    await conn.rollback();
    conn.release();
    return NextResponse.json({ error: "发放失败，请稍后再试" }, { status: 500 });
  }
}
