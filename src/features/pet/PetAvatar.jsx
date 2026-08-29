import { derivePetBadges } from '../../components/petModel.js';

export default function PetAvatar({ mood, progress, unread, paused, onClick, onMouseEnter, onMouseLeave }) {
  const badges = derivePetBadges({ progress, unread });
  return (
    <button
      type="button"
      className={`pet-core pet-${mood} ${paused ? 'pet-paused' : ''}`}
      aria-label="打开协作网络"
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <img className="pet-reference-capybara" src="/assets/pet/capybara-idle.png" alt="" draggable="false" />
      {badges.blocked && <span className="pet-bang" aria-label="存在瓶颈">!</span>}
      {badges.unreadCount > 0 && <span className="pet-unread-dot" aria-label={`${badges.unreadCount} 条未读`}>{badges.unreadCount}</span>}
    </button>
  );
}
