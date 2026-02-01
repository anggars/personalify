import React, { Suspense } from "react";
import { Metadata } from "next";
import TermsClient from "./terms-client";

export const metadata: Metadata = {
  title: "Terms of Service - Personalify",
  description: "Terms of Service for Personalify. Learn about the rules and guidelines for using our Spotify analytics platform.",
};

export default function TermsPage() {
  return <TermsClient />;
}
