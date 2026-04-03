import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Video } from "lucide-react";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Supabase auth
    navigate("/dashboard");
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-fade-in">
        <div className="bg-card border border-border rounded-2xl p-8">
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center mb-4">
              <Video className="h-6 w-6 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Sign in to VideoOS</h1>
            <p className="text-sm text-muted-foreground mt-1.5">
              Welcome back. Let's grow your video business.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full h-11 px-4 rounded-lg bg-secondary border border-border text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full h-11 px-4 rounded-lg bg-secondary border border-border text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
              />
            </div>
            <button
              type="submit"
              className="w-full h-11 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90 transition-colors text-sm"
            >
              Continue →
            </button>
          </form>

          <div className="mt-4 text-center">
            <button className="text-xs text-muted-foreground hover:text-primary transition-colors">
              Forgot password?
            </button>
          </div>
        </div>

        <div className="flex items-center justify-center gap-4 mt-6">
          <button className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            Privacy Policy
          </button>
          <span className="text-xs text-muted-foreground">|</span>
          <button className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            Terms of Service
          </button>
        </div>
      </div>
    </div>
  );
}
