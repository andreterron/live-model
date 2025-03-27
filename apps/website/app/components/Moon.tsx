const TO_RADIANS = Math.PI / 180;

const BIG_R = 45;
const SMALL_R = 25;
const DISTANCE = BIG_R + 0;
const CENTER_ANGLE = 45 * TO_RADIANS; // where small circle's center is

// Calculate bite angle using law of cosines
const A = BIG_R,
  B = DISTANCE,
  C = SMALL_R;
const sq = (v: number) => v * v;
const BITE_ANGLE = Math.acos((sq(A) + sq(B) - sq(C)) / (2 * A * B));

// Angle in radians, returns [x, y]
const getPoint = (
  centerX: number,
  centerY: number,
  radius: number,
  angle: number
) => [
  Math.round(centerX + radius * Math.cos(angle)),
  Math.round(centerY + radius * Math.sin(angle)),
];

// Calculate points using angles
const [x1, y1] = getPoint(50, 50, BIG_R, CENTER_ANGLE - BITE_ANGLE); // start of arc
const [x2, y2] = getPoint(50, 50, BIG_R, CENTER_ANGLE + BITE_ANGLE); // end of arc

const PATH_D = `M ${x1} ${y1}
            A ${BIG_R} ${BIG_R} 0 1 0 ${x2} ${y2}
            A ${SMALL_R} ${SMALL_R} 0 0 1 ${x1} ${y1}
            Z`;

export function Moon({
  value,
  set,
}: {
  value: boolean;
  set: (v: boolean) => void;
}) {
  return (
    <svg className={`w-8 h-8`} viewBox="0 0 100 100">
      <path
        className={`stroke-current stroke-[8] cursor-pointer ${
          value ? 'fill-black/50 dark:fill-white/50' : 'fill-transparent'
        }`}
        d={PATH_D}
        onClick={() => set(!value)}
      />
    </svg>
  );
}
