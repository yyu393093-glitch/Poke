import { useEffect, useRef, useState } from 'react';

const ICONS = {
  blocked: '🏝️',
  upstream_done: '🔔',
  poke: '👆',
  offline: '🌙',
};

/**
 * 岛屿通知弹窗（玻璃浮标条）：一条可点击跳转、可关闭、自动淡出的顶部通知。
 * 类型只换图标与强调色，玻璃胶囊外壳 + 底部波浪下划线保持不变。
 */
export default function IslandNotification({
  type,
  message,
  nodeId,
  duration = 6000,
  onJump,
  onClose,
}) {
  const [leaving, setLeaving] = useState(false);
  const dismissedRef = useRef(false);
  const leaveTimer = useRef(0);

  useEffect(() => {
    const timer = window.setTimeout(dismiss, duration);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duration]);

  useEffect(() => () => window.clearTimeout(leaveTimer.current), []);

  function dismiss() {
    if (dismissedRef.current) return;
    dismissedRef.current = true;
    setLeaving(true);
    leaveTimer.current = window.setTimeout(onClose, 220);
  }

  function handleJump() {
    if (!nodeId) return;
    onJump?.();
    dismiss();
  }

  const body = nodeId ? (
    <button
      type="button"
      className="pk-island-notice__body"
      onClick={handleJump}
      aria-label={`查看：${message}`}
    >
      <span className="pk-island-notice__icon" aria-hidden="true">
        {ICONS[type] ?? '🔔'}
      </span>
      <span className="pk-island-notice__text">{message}</span>
    </button>
  ) : (
    <span className="pk-island-notice__body">
      <span className="pk-island-notice__icon" aria-hidden="true">
        {ICONS[type] ?? '🔔'}
      </span>
      <span className="pk-island-notice__text">{message}</span>
    </span>
  );

  return (
    <div
      className={`pk-island-notice pk-island-notice--${type}${leaving ? ' is-leaving' : ''}`}
      role="status"
    >
      {body}
      <button
        type="button"
        className="pk-island-notice__close"
        aria-label="关闭通知"
        onClick={dismiss}
      >
        ×
      </button>
      <svg
        className="pk-island-notice__wave"
        viewBox="0 0 200 10"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          d="M0 5 C 20 0, 40 0, 60 5 S 100 10, 120 5 S 160 0, 200 5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray="14 10"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}
