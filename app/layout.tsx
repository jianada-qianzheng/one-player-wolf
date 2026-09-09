

export const metadata = {
  title: '单人简易狼人杀',
  description: 'A simple single-player werewolf game built with Next.js',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
