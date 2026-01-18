export default function EmbeddedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-[#121212]">
        {/* No navbar/footer - clean for WebView */}
        {children}
      </body>
    </html>
  );
}
