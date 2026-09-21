import AppSidebar from "./AppSidebar";

interface PageLayoutProps {
  children: React.ReactNode;
}

export default function PageLayout({ children }: PageLayoutProps) {
  return (
    <div className="flex min-h-screen w-full overflow-x-hidden">
      <AppSidebar />
      <main className="flex-1 min-w-0 overflow-x-hidden">
        <div className="page-enter max-w-6xl mx-auto px-4 sm:px-6 py-8 pt-16 lg:pt-8">
          {children}
        </div>
      </main>
    </div>
  );
}
