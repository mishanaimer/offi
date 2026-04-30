/**
 * Watermark — полупрозрачный логотип, виден ТОЛЬКО при печати (PDF).
 * Реализован как SVG, повторяемый по странице через background-image (data URI).
 * При обычном просмотре в браузере скрыт через CSS .print-only.
 */
export function LegalWatermark() {
  const svg = `
    <svg xmlns='http://www.w3.org/2000/svg' width='480' height='240' viewBox='0 0 480 240'>
      <g transform='rotate(-22 240 120)' fill='#0259DD' fill-opacity='0.06'>
        <circle cx='160' cy='120' r='44' />
        <text x='220' y='138' font-family='Onest, Arial, sans-serif' font-size='62' font-weight='800' letter-spacing='-2'>
          offi.ai
        </text>
      </g>
    </svg>
  `;
  const dataUri = `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;

  return (
    <div
      aria-hidden
      className="print-only fixed inset-0 pointer-events-none"
      style={{
        backgroundImage: dataUri,
        backgroundRepeat: "repeat",
        backgroundSize: "480px 240px",
        zIndex: 0,
      }}
    />
  );
}
