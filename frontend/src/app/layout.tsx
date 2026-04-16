import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import { AuthProvider } from "@/lib/auth-context";
import AuthGate from "@/components/AuthGate";
import { ProfileProvider } from "@/lib/profile-context";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "PTS - Personal Ticket System",
  description: "A personal ticket and task management system",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          <AuthGate>
            <ProfileProvider>
              <Navbar />
              <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
            </ProfileProvider>
          </AuthGate>
        </AuthProvider>
      </body>
    </html>
  );
}
