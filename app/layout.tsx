import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PLATFORM_NAME, PLATFORM_DESCRIPTOR } from "./brand";

export const metadata: Metadata = {
  title: PLATFORM_NAME,
  description: `${PLATFORM_DESCRIPTOR}: ventas, marketing, inventarios, industria y geointeligencia.`,
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body>{children}</body></html>;
}
