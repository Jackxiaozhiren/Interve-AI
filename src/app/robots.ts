// 私域试点（2026-11-15，W1 / ADJ-13）：生产站转为不对外试点，爬取面整体关闭。
//
// 上一版把 `/`、`/landing`、`/login`、`/signup` 明确列为 Allow，理由是「练习版上线
// 面只有营销页与登录页」。当期实测（W35）显示 `/signup` 可匿名访问且 Google/GitHub
// 自助注册可用 —— 这正是「非公开试点」不允许的组合。继续在 robots 里公布注册页，
// 与「不开放注册」是同一类自相矛盾的对外声明；auth-path 测试防的就是这种声明。
//
// 为什么不是只删 Allow 保留 Disallow 列表：Allow 缺省时 `Disallow: /` 已覆盖全站，
// 保留一份「应用区路径」清单会让读者以为注册页仍被允许，且新增路由会悄悄漏掉。
// 一条 `/` 是这套策略唯一不会漂移的写法。
//
// 去索引的边界（重要，别把 robots 当删除键）：`Disallow` 只是阻止抓取，已经进入
// 索引的 URL 可能继续留在索引里。所以 proxy.ts 同时下发 `X-Robots-Tag: noindex,
// nofollow` —— 头负责让既有条目退出，文件负责不让新条目进入。2026-11-15 的
// `site:` 检索对该域无结果（W35），因此今天需要「退出」的条目基本为零。
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", disallow: ["/"] }],
  };
}
