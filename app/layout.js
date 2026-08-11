import "./globals.css";

export const metadata = {
  title: "VAAS Closer Bot",
  description: "Panel privado del bot de cierre de VAAS",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
