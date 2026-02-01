import React from "react";
import { Metadata } from "next";
import PrivacyClient from "./privacy-client";

export const metadata: Metadata = {
  title: "Privacy Policy - Personalify",
  description: "Privacy Policy for Personalify. Learn how we protect and handle your Spotify data with full transparency.",
};

export default function PrivacyPage() {
  return <PrivacyClient />;
}
