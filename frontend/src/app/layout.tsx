import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HVAC Digital Twin System - PINN & Deep-RL Control",
  description: "Physics-Informed Neural Network Digital Twin with Deep Q-Network Autonomous HVAC Control",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased selection:bg-sky-200 selection:text-sky-900">
        {children}
      </body>
    </html>
  );
}
