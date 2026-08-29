import { useNavigate } from 'react-router-dom';

import lampSpiritVideo from '../../video/生成灯笼小精灵视频.mp4';

export default function DeskPet() {
  const navigate = useNavigate();

  return (
    <button
      type="button"
      aria-label="打开戳戳协作网络"
      className="fixed right-6 bottom-6 h-24 w-24 cursor-pointer overflow-hidden rounded-full border border-amber-200/60 bg-amber-300 shadow-[0_0_24px_rgba(251,191,36,0.55)] transition-transform duration-200 hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-300"
      onClick={() => navigate('/network')}
    >
      <video
        className="h-full w-full object-cover"
        src={lampSpiritVideo}
        autoPlay
        loop
        muted
        playsInline
        preload="metadata"
        aria-hidden="true"
      />
    </button>
  );
}
