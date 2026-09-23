import "./globals.css";

export const metadata = {
  title: "Friday Night Golf",
  description: "Scores, rivalries and bragging rights.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
