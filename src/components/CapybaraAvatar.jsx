const VARIANT_BY_NAME = { 王姐: 0, 陈总: 1, 小陈: 2, 老李: 3, 小赵: 4, 阿May: 5 };

export function capybaraVariant(name) {
  return VARIANT_BY_NAME[name] ?? 0;
}

/**
 * 卡皮巴拉（水豚）头像。全部用 CSS 画，6 个变体对应 6 个成员。
 * 基座 64×64，按 size 等比缩放。
 */
export default function CapybaraAvatar({ name, size = 48 }) {
  const variant = capybaraVariant(name);
  const scale = size / 64;

  return (
    <span
      className="capybara-avatar"
      style={{ width: `${size}px`, height: `${size}px` }}
      aria-hidden="true"
    >
      <span
        className={`capybara-mascot capybara-variant-${variant}`}
        style={{ transform: `scale(${scale})`, transformOrigin: '0 0' }}
      >
        <span className="capybara-flower">✿</span>
        <span className="capybara-ear capybara-ear-left" />
        <span className="capybara-ear capybara-ear-right" />
        <span className="capybara-body" />
        <span className="capybara-glasses"><i /><i /></span>
        <span className="capybara-ring" />
      </span>
    </span>
  );
}
