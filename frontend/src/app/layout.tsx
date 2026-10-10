import type { Metadata, Viewport } from "next";
import { Inter, Source_Code_Pro } from "next/font/google";
import "./globals.css";
import { Avisos } from "./avisos";

// Inter: la letra del modo claro «Brex» (variable: un solo archivo para todos los pesos).
const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
// Source Code Pro: la letra del modo oscuro «neón». Sin precarga: solo la descarga quien usa ese modo.
const sourceCodePro = Source_Code_Pro({ variable: "--font-source-code-pro", subsets: ["latin"], preload: false });

export const metadata: Metadata = {
  title: "CORE Presupuestos",
  description: "Captura, presupuesta, envía y haz seguimiento.",
  robots: { index: false, follow: false },
};

// Sin userScalable ni maximumScale: desactivar el zoom es un fallo de accesibilidad.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3f3f7" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${inter.variable} ${sourceCodePro.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        {/* Aplica el tema guardado antes de pintar, para evitar el parpadeo. */}
        <script dangerouslySetInnerHTML={{ __html: `try{var t=localStorage.getItem("tema");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}` }} />
      </head>
      <body className="min-h-dvh pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
        {children}
        <Avisos />
      </body>
    </html>
  );
}
