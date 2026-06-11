export const metadata = {
  title: "World Cup Draft Room",
  description: "Draft national teams, track matchups, win the bracket.",
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
