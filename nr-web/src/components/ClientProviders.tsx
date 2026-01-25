"use client";

import { WelcomeModal } from "./WelcomeModal";

export function ClientProviders({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <WelcomeModal />
    </>
  );
}
