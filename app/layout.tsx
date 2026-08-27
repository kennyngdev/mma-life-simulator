import type { Metadata } from 'next';
import './globals.css';

const siteUrl = 'https://wuxia-life-sim.me-e75a.chatgpt.site';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: '大俠模擬器｜你未必成名，但一定有事',
  description: '一個輕鬆、帶點現代吐槽的晚明武俠人生模擬器。抽一條命、選一個門派，活完十六回合的江湖。',
  openGraph: {
    title: '大俠模擬器',
    description: '你未必成名，但一定有事。抽一條命，活完十六回合的江湖。',
    url: siteUrl,
    siteName: '大俠模擬器',
    locale: 'zh_TW',
    type: 'website',
    images: [{ url: `${siteUrl}/og.png`, width: 1732, height: 908, alt: '大俠模擬器｜你未必成名，但一定有事' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '大俠模擬器',
    description: '你未必成名，但一定有事。',
    images: [`${siteUrl}/og.png`],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}
