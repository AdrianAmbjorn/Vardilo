import Link from "next/link";

export default function HomeMark() {
  return (
    <Link
      href="/"
      aria-label="Till Hem"
      title="Hem"
      style={{
        width: 42,
        height: 42,
        borderRadius: "50%",
        background: "#c62828",
        display: "inline-grid",
        placeItems: "center",
        textDecoration: "none",
        flex: "0 0 auto",
      }}
    >
      <svg width="21" height="21" viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4.5v-5.5h-5V21H5a1 1 0 0 1-1-1z"
          fill="#fff"
        />
      </svg>
    </Link>
  );
}
