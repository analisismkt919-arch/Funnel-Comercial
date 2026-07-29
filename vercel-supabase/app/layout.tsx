import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Funnel KPI | Inteligencia comercial CR3",
  description: "Captura, seguimiento y análisis ejecutivo del funnel comercial por sucursal, gerente y asesor.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body>{children}</body></html>;
}
