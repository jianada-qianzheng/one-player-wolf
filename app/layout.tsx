import './globals.css'; // 如果你用了 Tailwind 或全局样式，保留这行

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
