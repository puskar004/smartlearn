import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import AppShell from "@/components/AppShell";
import { smartLearnAppearance } from "@/lib/clerk-appearance";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "SmartLearn | Learn At Your Own Pace",
    template: "%s | SmartLearn",
  },
  description:
    "Class 10–12 CBSE mastery with NCERT PDFs, PYQs, Gemini tutor, safe YouTube, focus lock, and parent WhatsApp alerts.",
  applicationName: "SmartLearn",
  authors: [{ name: "SmartLearn" }],
  keywords: ["SmartLearn", "NCERT", "CBSE", "Class 10", "Class 12", "study"],
  icons: {
    icon: [{ url: "/smartlearn-logo.svg", type: "image/svg+xml" }],
    apple: [{ url: "/smartlearn-logo.svg" }],
  },
  openGraph: {
    title: "SmartLearn",
    description: "NCERT, PYQs, Gemini AI tutor & focus tools for CBSE students.",
    siteName: "SmartLearn",
    type: "website",
  },
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || "https://smartlearn-xi.vercel.app"
  ),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-slate-50 text-slate-900`}
      >
        <ClerkProvider
          appearance={smartLearnAppearance}
          localization={{
            formButtonPrimary: "Continue with SmartLearn",
            formFieldInputPlaceholder__emailAddress: "you@email.com",
            signIn: {
              start: {
                title: "Sign in to SmartLearn",
                subtitle: "We'll email a SmartLearn OTP to verify it's you",
              },
              emailCode: {
                title: "Check your email",
                subtitle: "Enter the SmartLearn verification code we sent you",
              },
            },
            signUp: {
              start: {
                title: "Join SmartLearn",
                subtitle: "Create your account — OTP comes from SmartLearn",
              },
              emailCode: {
                title: "Verify with SmartLearn OTP",
                subtitle: "Enter the code from your SmartLearn email",
              },
            },
          } as never}
        >
          <AppShell>{children}</AppShell>
        </ClerkProvider>
      </body>
    </html>
  );
}
