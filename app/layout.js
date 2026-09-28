import "./globals.css";

export const metadata = {
  title: "临床研发情报工作台",
  description: "BD & Clinical R&D Intelligence"
};

export default function RootLayout({ children }) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}