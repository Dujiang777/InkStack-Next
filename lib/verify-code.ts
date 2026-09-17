// 注册邮箱验证码：存取 + 校验（sha256 落库，10 分钟有效，5 次尝试上限，
// 签发冷却 60s / 10 分钟窗口最多 5 次）。表懒建，globalThis 防热重载重复建。
import { createHash, randomInt } from "node:crypto";
import type { Pool } from "mysql2/promise";

const CODE_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 60 * 1000;
const WINDOW_LIMIT_MS = 10 * 60 * 1000;
const WINDOW_MAX = 5;

const g = globalThis as typeof globalThis & { __inkCodeReady?: boolean };

function codeHash(email: string, code: string): string {
  return createHash("sha256").update(`${email.toLowerCase()}::${code}`).digest("hex");
}

async function ensureTable(pool: Pool): Promise<void> {
  if (g.__inkCodeReady) return;
  await pool.query(`CREATE TABLE IF NOT EXISTS email_codes (
    id         BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    email      VARCHAR(190) NOT NULL,
    code_hash  CHAR(64) NOT NULL,
    purpose    VARCHAR(20) NOT NULL DEFAULT 'register',
    attempts   INT UNSIGNED NOT NULL DEFAULT 0,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    expires_at DATETIME(3) NOT NULL,
    INDEX idx_ec_email (email, created_at DESC)
  ) ENGINE=InnoDB`);
  g.__inkCodeReady = true;
}

export type IssueResult =
  | { ok: true; code: string }
  | { ok: false; error: string };

/** 签发验证码（冷却与频控通过则返回明文 code 交给 mailer） */
export async function issueCode(pool: Pool, email: string, purpose = "register"): Promise<IssueResult> {
  await ensureTable(pool);
  const mail = email.toLowerCase();
  try {
    const [recent] = await pool.query(
      `SELECT created_at FROM email_codes WHERE email = ? AND purpose = ? ORDER BY id DESC LIMIT ${WINDOW_MAX}`,
      [mail, purpose]
    );
    const rows = recent as { created_at: Date }[];
    if (rows.length > 0) {
      const last = new Date(rows[0].created_at).getTime();
      if (Date.now() - last < RESEND_COOLDOWN_MS) {
        const wait = Math.ceil((RESEND_COOLDOWN_MS - (Date.now() - last)) / 1000);
        return { ok: false, error: `发送太频繁，请 ${wait} 秒后再试` };
      }
      if (rows.length >= WINDOW_MAX && Date.now() - new Date(rows[WINDOW_MAX - 1].created_at).getTime() < WINDOW_LIMIT_MS) {
        return { ok: false, error: "验证码请求过多，请 10 分钟后再试" };
      }
    }
    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    await pool.query(
      `INSERT INTO email_codes (email, code_hash, purpose, expires_at) VALUES (?, ?, ?, DATE_ADD(NOW(3), INTERVAL ? MICROSECOND))`,
      [mail, codeHash(mail, code), purpose, CODE_TTL_MS * 1000]
    );
    return { ok: true, code };
  } catch {
    return { ok: false, error: "验证码签发失败，请稍后再试" };
  }
}

export type CheckResult = { ok: true } | { ok: false; error: string };

/** 校验并消费验证码（成功后即删；错误累计 5 次作废） */
export async function checkCode(pool: Pool, email: string, code: string, purpose = "register"): Promise<CheckResult> {
  await ensureTable(pool);
  const mail = email.toLowerCase();
  try {
    const [rows0] = await pool.query(
      `SELECT id, attempts, expires_at FROM email_codes
        WHERE email = ? AND purpose = ? ORDER BY id DESC LIMIT 1`,
      [mail, purpose]
    );
    const row = (rows0 as { id: number; attempts: number; expires_at: Date | string }[])[0];
    if (!row) return { ok: false, error: "请先获取邮箱验证码" };
    if (new Date(row.expires_at).getTime() < Date.now()) {
      await pool.query(`DELETE FROM email_codes WHERE id = ?`, [row.id]);
      return { ok: false, error: "验证码已过期，请重新获取" };
    }
    const [hashRows] = await pool.query(`SELECT code_hash FROM email_codes WHERE id = ?`, [row.id]);
    const storedHash = String((hashRows as { code_hash: string }[])[0]?.code_hash ?? "");
    if (codeHash(mail, code.trim()) !== storedHash) {
      // 不相等：计一次错误
      const attempts = Number(row.attempts) + 1;
      if (attempts >= MAX_ATTEMPTS) {
        await pool.query(`DELETE FROM email_codes WHERE id = ?`, [row.id]);
        return { ok: false, error: "错误次数过多，验证码已作废，请重新获取" };
      }
      await pool.query(`UPDATE email_codes SET attempts = ? WHERE id = ?`, [attempts, row.id]);
      return { ok: false, error: `验证码不正确（还可尝试 ${MAX_ATTEMPTS - attempts} 次）` };
    }
    await pool.query(`DELETE FROM email_codes WHERE id = ?`, [row.id]);
    return { ok: true };
  } catch {
    return { ok: false, error: "验证码校验失败，请稍后再试" };
  }
}
