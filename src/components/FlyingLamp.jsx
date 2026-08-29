import { useEffect, useState } from 'react';

export default function FlyingLamp({ from, to, duration = 1500, onArrive }) {
  const [started, setStarted] = useState(false);
  useEffect(() => { const frame = requestAnimationFrame(() => setStarted(true)); const timer = setTimeout(() => onArrive?.(), duration); return () => { cancelAnimationFrame(frame); clearTimeout(timer); }; }, [duration, onArrive]);
  return <div aria-hidden="true" className="pointer-events-none fixed z-50 grid h-10 w-10 place-items-center rounded-full bg-amber-300 text-xl shadow-[0_0_26px_rgba(251,191,36,.9)]" style={{ left: from.x, top: from.y, transform: started ? `translate(${to.x - from.x}px, ${to.y - from.y}px) rotate(16deg)` : 'translate(0,0)', transition: `transform ${duration}ms cubic-bezier(.22,.8,.2,1)` }}>💡</div>;
}
