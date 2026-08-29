import { useEffect, useState } from 'react';
import { useRef } from 'react';
import { getTrackedFlightPosition } from './pokeModel.js';

export default function FlyingLamp({ from, to, duration = 1500, onArrive }) {
  const [position, setPosition] = useState(from);
  const targetRef = useRef(to);
  useEffect(() => { targetRef.current = to; }, [to]);
  useEffect(() => {
    const startedAt = performance.now();
    let frame;
    function animate(now) {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - ((1 - progress) ** 3);
      setPosition(getTrackedFlightPosition(from, targetRef.current, eased));
      if (progress < 1) frame = requestAnimationFrame(animate);
      else onArrive?.();
    }
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [duration, from, onArrive]);
  return <div aria-hidden="true" className="pointer-events-none fixed z-50 grid h-10 w-10 place-items-center rounded-full bg-amber-300 text-xl shadow-[0_0_26px_rgba(251,191,36,.9)]" style={{ left: position.x, top: position.y, transform: 'translate(-50%, -50%) rotate(16deg)' }}>💡</div>;
}
