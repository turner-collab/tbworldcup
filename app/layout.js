export const metadata = {
  title: "Jingo",
  description: "Rabid support for every nation.",
  openGraph: {
    title: "Jingo",
    description: "Rabid support for every nation.",
    images: ["/jingo-logo.png"],
  },
  twitter: {
    card: "summary",
    title: "Jingo",
    images: ["/jingo-logo.png"],
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      </head>
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
