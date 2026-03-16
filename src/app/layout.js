import './globals.css';

export const metadata = {
  title: 'Event Planner',
  description: 'Event planning and management application',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
