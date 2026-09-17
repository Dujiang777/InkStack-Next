// POST /api/series/[id]/bundle — 打包解锁整个专栏（一口价，按购买时点篇目快照分摊 70/30）
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { bundleUnlock } from "@/lib/data";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "专栏不存在" }, { status: 404 });
  try {
    const r = await bundleUnlock(id, user.id);
    if (!r.ok) {
      const status =
        r.error === "请先登录"
          ? 401
          : r.error === "墨水不足" || (r.error ?? "").startsWith("积分不足")
            ? 402
            : 400;
      return NextResponse.json({ error: r.error }, { status });
    }
    return NextResponse.json({ ...r, ok: true });
  } catch {
    return NextResponse.json({ error: "打包解锁失败，请稍后再试" }, { status: 500 });
  }
}
