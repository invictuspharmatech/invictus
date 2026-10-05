import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Peptide Calculator",
  description: "Figure out your syringe pull from vial size, bacteriostatic water, and dose.",
};

export default function PeptideCalculatorLayout({ children }: { children: React.ReactNode }) {
  return children;
}
