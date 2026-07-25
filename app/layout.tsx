import '../styles/globals.css';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head />
      <body>
        <nav className="bg-gray-800 p-4">
          <div className="container mx-auto flex justify-between items-center">
            <h1 className="text-white">TCIMS</h1>
            <ul className="flex space-x-4">
              <li><a href="#" className="text-white hover:text-blue-500">Home</a></li>
              <li><a href="#" className="text-white hover:text-blue-500">Dashboard</a></li>
            </ul>
          </div>
        </nav>
        <main>{children}</main>
      </body>
    </html>
  );
}
