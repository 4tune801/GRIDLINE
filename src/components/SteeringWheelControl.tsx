import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';

interface SteeringWheelControlProps {
  /** Ref updated every animation frame with live steer angle (-1 right .. +1 left) for smooth 60fps wheel rotation */
  visualSteerRef?: RefObject<number>;
  isCssRotated: boolean;
  horizontalFlip: boolean;
  compact?: boolean;
  onSteerChange: (steer: number, active: boolean) => void;
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

export function SteeringWheelControl({
  visualSteerRef,
  isCssRotated,
  horizontalFlip,
  compact = false,
  onSteerChange,
}: SteeringWheelControlProps) {
  const wheelBoxRef = useRef<HTMLDivElement | null>(null);
  const rotorRef = useRef<HTMLDivElement | null>(null);
  const activePointerIdRef = useRef<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Sync 60fps wheel rotation smoothly to live steering (works for touch drag, keyboard A/D, and Tilt Steer)
  useEffect(() => {
    let raf = 0;
    const syncWheel = () => {
      if (rotorRef.current && visualSteerRef) {
        const steer = clamp(visualSteerRef.current ?? 0, -1, 1);
        // Physics convention: +1 = Steer Left (rotate wheel CCW = negative CSS deg), -1 = Steer Right (CW = positive CSS deg)
        const deg = -steer * 88;
        rotorRef.current.style.transform = `rotate(${deg.toFixed(1)}deg)`;
      }
      raf = requestAnimationFrame(syncWheel);
    };
    raf = requestAnimationFrame(syncWheel);
    return () => cancelAnimationFrame(raf);
  }, [visualSteerRef]);

  const computeSteerFromPointer = useCallback(
    (clientX: number, clientY: number): number => {
      const el = wheelBoxRef.current;
      if (!el) return 0;
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width * 0.5;
      const cy = rect.top + rect.height * 0.5;
      const sx = clientX - cx;
      const sy = clientY - cy;

      // Transform screen-space delta back into local HUD coordinates when phone uses CSS horizontal rotation
      let lx = sx;
      let ly = sy;
      if (isCssRotated) {
        if (horizontalFlip) {
          // Container rotated -90deg: screen +x = local +y, screen -y = local +x
          lx = -sy;
          ly = sx;
        } else {
          // Container rotated +90deg: screen +y = local +x, screen -x = local +y
          lx = sy;
          ly = -sx;
        }
      }

      const radius = Math.max(24, Math.min(rect.width, rect.height) * 0.5);
      // Horizontal projection (+1 left when lx < 0, -1 right when lx > 0)
      const horizSteer = clamp(-lx / (radius * 0.72), -1, 1);
      // Upper-arc rotary steering for natural 12-o'clock rim turning
      const dist = Math.hypot(lx, ly);
      if (dist < 6) return 0;

      const arcAngle = Math.atan2(lx, -ly); // -PI..PI; -PI/2 left, 0 top, +PI/2 right
      const arcSteer = clamp(-arcAngle / 1.25, -1, 1);

      // Smoothly blend upper rotary arc with lower horizontal scrub so bottom-half drags never invert
      const upperBlend = clamp((-ly + radius * 0.25) / (radius * 0.5), 0, 1);
      return clamp(horizSteer * (1 - upperBlend) + arcSteer * upperBlend, -1, 1);
    },
    [isCssRotated, horizontalFlip]
  );

  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    activePointerIdRef.current = e.pointerId;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore if pointer capture is unsupported
    }
    setIsDragging(true);
    const steer = computeSteerFromPointer(e.clientX, e.clientY);
    onSteerChange(steer, true);
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (activePointerIdRef.current !== e.pointerId) return;
    e.preventDefault();
    const steer = computeSteerFromPointer(e.clientX, e.clientY);
    onSteerChange(steer, true);
  };

  const handlePointerRelease = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (activePointerIdRef.current !== e.pointerId) return;
    e.preventDefault();
    activePointerIdRef.current = null;
    setIsDragging(false);
    onSteerChange(0, false);
  };

  const sizeClass = compact ? 'w-28 h-28' : 'w-[122px] h-[122px] sm:w-[138px] sm:h-[138px]';

  return (
    <div className="pointer-events-auto flex flex-col items-center select-none touch-none">
      <div
        ref={wheelBoxRef}
        role="slider"
        aria-label="Steering Wheel"
        aria-valuemin={-100}
        aria-valuemax={100}
        aria-valuenow={0}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerRelease}
        onPointerCancel={handlePointerRelease}
        onLostPointerCapture={handlePointerRelease}
        className={`relative ${sizeClass} rounded-full flex items-center justify-center cursor-grab active:cursor-grabbing touch-none`}
      >
        {/* Static Outer Reference Bezel */}
        <div
          className={`absolute inset-0 rounded-full border transition-colors ${
            isDragging
              ? 'bg-[#0B0F14]/92 border-amber-400/70'
              : 'bg-[#0B0F14]/82 border-white/15'
          }`}
        />
        {/* 12 o'clock static center tick */}
        <div className="absolute top-1 left-1/2 -translate-x-1/2 w-1 h-2 rounded-full bg-white/35 pointer-events-none" />

        {/* Rotating Racing Steering Wheel SVG */}
        <div
          ref={rotorRef}
          className="relative w-[86%] h-[86%] flex items-center justify-center pointer-events-none will-change-transform"
        >
          <svg viewBox="0 0 120 120" className="w-full h-full drop-shadow-[0_4px_10px_rgba(0,0,0,0.65)]">
            {/* Outer Grip Ring */}
            <circle
              cx="60"
              cy="60"
              r="48"
              fill="none"
              stroke={isDragging ? '#F59E0B' : '#CBD5E1'}
              strokeWidth="12"
              strokeOpacity="0.18"
            />
            <circle
              cx="60"
              cy="60"
              r="48"
              fill="none"
              stroke="#1E293B"
              strokeWidth="10"
            />
            <circle
              cx="60"
              cy="60"
              r="48"
              fill="none"
              stroke={isDragging ? '#F59E0B' : '#64748B'}
              strokeWidth="2.2"
            />

            {/* Top 12 o'clock Racing Alignment Stripe */}
            <rect x="56.5" y="6.5" width="7" height="11" rx="2" fill="#F59E0B" />

            {/* Left, Right & Bottom Motorsport Spokes */}
            <path
              d="M 14 55 L 43 56 L 43 66 L 14 67 Z"
              fill="#334155"
              stroke="#475569"
              strokeWidth="1.2"
            />
            <path
              d="M 77 56 L 106 55 L 106 67 L 77 66 Z"
              fill="#334155"
              stroke="#475569"
              strokeWidth="1.2"
            />
            <path
              d="M 54 75 L 66 75 L 64 106 L 56 106 Z"
              fill="#334155"
              stroke="#475569"
              strokeWidth="1.2"
            />

            {/* Left/Right Thumb Grip Bolsters */}
            <path
              d="M 16 42 A 48 48 0 0 0 16 78"
              fill="none"
              stroke={isDragging ? '#FBBF24' : '#94A3B8'}
              strokeWidth="5"
              strokeLinecap="round"
            />
            <path
              d="M 104 42 A 48 48 0 0 1 104 78"
              fill="none"
              stroke={isDragging ? '#FBBF24' : '#94A3B8'}
              strokeWidth="5"
              strokeLinecap="round"
            />

            {/* Center Horn Hub */}
            <circle cx="60" cy="60" r="17" fill="#0F172A" stroke={isDragging ? '#F59E0B' : '#475569'} strokeWidth="2.5" />
            <circle cx="60" cy="60" r="7" fill={isDragging ? '#F59E0B' : '#334155'} />
          </svg>
        </div>
      </div>
      <span className="mt-1 text-[10px] font-medium text-slate-400 tracking-wide">STEER</span>
    </div>
  );
}
