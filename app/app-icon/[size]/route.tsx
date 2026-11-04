import { ImageResponse } from "next/og";

export function generateStaticParams() {
  return [{ size: "180" }, { size: "192" }, { size: "512" }];
}

export async function GET(_request: Request, { params }: { params: Promise<{ size: string }> }) {
  const size = Number((await params).size);
  if (![180, 192, 512].includes(size)) return new Response(null, { status: 404 });

  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#102a43" }}>
      <svg width={size * .61} height={size * .61} viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="12" fill="#e51b23" />
        <path d="M6 11 12 6l6 5v6.5a.5.5 0 0 1-.5.5H14v-4h-4v4H6.5a.5.5 0 0 1-.5-.5Z" fill="#fff" />
      </svg>
    </div>,
    { width: size, height: size }
  );
}
