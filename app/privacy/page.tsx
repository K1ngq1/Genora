import Link from "next/link";

// Template content. Replace with reviewed legal text before launch.
export default function PrivacyPage() {
  return (
    <div className="legal-page">
      <div className="legal-page-inner">
        <h1>隐私政策</h1>
        <p className="legal-updated">最近更新：2026 年 7 月 2 日</p>

        <div className="legal-prose">
          <h2>1. 我们收集的信息</h2>
          <ul>
            <li><strong>账号信息</strong>：注册邮箱、昵称。</li>
            <li><strong>使用记录</strong>：你提交的生成任务、提示词、上传的参考素材及生成结果。</li>
            <li><strong>技术信息</strong>：访问时的 IP、浏览器 / 设备类型、访问时间等日志信息。</li>
          </ul>

          <h2>2. 我们如何使用信息</h2>
          <ul>
            <li>提供图像 / 视频生成与账号服务；</li>
            <li>发送必要的通知（如注册验证码、密码重置链接、安全提醒）；</li>
            <li>维护、改善服务性能与稳定性；</li>
            <li>防范滥用、欺诈与其他违规行为。</li>
          </ul>

          <h2>3. Cookie 与会话</h2>
          <p>我们使用 Cookie / 本地存储保持你的登录状态。你可通过浏览器设置管理 Cookie，但部分功能可能因此失效。</p>

          <h2>4. 第三方服务</h2>
          <p>为提供服务，我们会在必要范围内将相关数据交由第三方处理，包括但不限于：</p>
          <ul>
            <li><strong>认证与数据存储</strong>（如 Supabase）；</li>
            <li><strong>邮件发送</strong>（用于发送验证码与重置链接）；</li>
            <li><strong>AI 模型供应商</strong>（用于执行生成任务）。</li>
          </ul>
          <p>这些服务商会按各自隐私政策处理数据。我们仅向其提供完成服务所必需的最少信息。</p>

          <h2>5. 数据安全</h2>
          <p>我们采取合理的技术与管理措施保护你的信息。但互联网传输不存在绝对安全，我们无法保证 100% 不被未授权访问。</p>

          <h2>6. 你的权利</h2>
          <p>在法律允许的范围内，你有权访问、更正、删除你的个人信息，或撤回授权。如需行使上述权利，请联系我们。</p>

          <h2>7. 数据保留</h2>
          <p>我们仅在实现本政策所述目的所必需的期限内保留你的信息，超出该期限或在你注销账号后将予以删除或匿名化。</p>

          <h2>8. 未成年人</h2>
          <p>本服务不面向 16 周岁以下未成年人。如果你是未成年人，请在监护人同意后使用，并避免提供个人信息。</p>

          <h2>9. 政策变更</h2>
          <p>本政策可能更新，更新后我们将在本页面公布。重大变更时会通过显著方式提醒。</p>

          <h2>10. 联系我们</h2>
          <p>如对本政策有任何疑问或请求，请通过本服务公布的官方联系方式联系我们。</p>
        </div>

        <p className="legal-notice">本政策为通用模板，正式上线前请由专业法律人士审核，并按你的实际数据处理方式调整（例如填入真实的服务商、联系方式、数据保留期限等）。</p>
        <Link className="legal-back" href="/login">← 返回</Link>
      </div>
    </div>
  );
}
