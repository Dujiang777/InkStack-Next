/**
 * 入参字符串归一（v18.1）
 *
 * 背景：API Route 的 `req.json()` 返回值是 `unknown`，我们把它断言成
 * `{ title?: string }` —— 但**断言不是运行时校验**。客户端完全可以发
 * `{"title":123}` / `{"md":{}}` / `{"email":[1]}`，此时
 * `(body.title ?? "").trim()` 里的 `?? ""` **不会生效**（只有 null/undefined 才走默认值），
 * 于是 `123.trim()` 抛 `TypeError: ….trim is not a function`，
 * 冒到路由最外层成为**未捕获异常 → 500**。
 *
 * 实测（v18.1 修复前）13 个接口可被非字符串字段打成 500，含
 * `/api/auth/login`、`/api/auth/send-code`、`/api/articles`、`/api/links`、
 * `/api/topup/pay`、`/api/me/profile` 等。危害：
 *   1. 未登录即可稳定触发 5xx，污染错误监控、掩盖真实故障；
 *   2. 登录接口的 `password` 走的是 `body.password ?? ""`，非字符串能**绕过长度校验**
 *      （`123.length === undefined`，`undefined < 8` 为 false），最终在 `scryptSync` 抛 500；
 *   3. 与第 5 轮「状态码失真」是同一性质的契约缺陷——4xx 的输入错误被报成 5xx。
 *
 * 约定：只接受真正的字符串，其余（数字 / 布尔 / 数组 / 对象 / null）一律返回 `""`，
 * 即与「该字段没传」同义，交给各路由既有的非空校验返回 400，文案保持不变。
 *
 * ⚠️ 凡是把 `req.json()` 的字段当字符串用的地方都必须过这个函数，
 * 不要写 `(body.x ?? "")`——它挡不住类型混淆。
 */
export function asText(v: unknown): string {
  return typeof v === "string" ? v : "";
}

/**
 * 与 `asText` 同源，但非字符串时回落到 `fallback` 而不是空串。
 * 用于原本写 `x ?? "默认值"` 的位置——`??` 只在 null/undefined 时回落，
 * 非字符串会直接进下游的字符串方法并抛错；
 * 这里改成「只有真正的字符串才用原值」，语义与 `??` 对 string/undefined 的表现一致
 * （注意：传空串仍然得到空串，不会被兜底成 fallback，与 `??` 保持一致）。
 */
export function asTextOr(v: unknown, fallback: string): string {
  return typeof v === "string" ? v : fallback;
}
