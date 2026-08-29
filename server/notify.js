// 飞书自定义机器人 webhook 发送器（msg_type: post 富文本）
export async function sendFeishuPost({ title, lines }) {
  const url = process.env.FEISHU_WEBHOOK_URL;
  if (!url) {
    console.warn('[feishu] FEISHU_WEBHOOK_URL 未配置，跳过飞书通知');
    return { sent: false, reason: 'no-url' };
  }
  const payload = {
    msg_type: 'post',
    content: {
      post: {
        zh_cn: {
          title,
          content: lines.map((line) => [{ tag: 'text', text: line }]),
        },
      },
    },
  };
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => ({}));
    if (res.ok && body.code === 0) {
      console.log('[feishu] 已发送群通知');
      return { sent: true };
    }
    console.error('[feishu] 发送失败', res.status, body);
    return { sent: false, error: body };
  } catch (err) {
    console.error('[feishu] 发送异常', err);
    return { sent: false, error: err };
  }
}
