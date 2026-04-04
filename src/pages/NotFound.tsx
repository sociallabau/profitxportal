import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center px-4">
      <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
        <span className="text-3xl">🔮</span>
      </div>
      <h1 className="text-3xl font-bold text-foreground mb-2">Page not found</h1>
      <p className="text-muted-foreground mb-8 max-w-sm">
        That page doesn't exist. Let's get you back to the portal.
      </p>
      <Link
        to="/dashboard"
        className="px-6 py-2.5 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90 transition-colors"
      >
        Back to Dashboard →
      </Link>
    </div>
  );
}
