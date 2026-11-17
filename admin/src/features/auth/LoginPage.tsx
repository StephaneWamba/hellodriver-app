import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Logo } from '@/components/ui/Logo';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { ApiError } from '@/lib/api';
import { useAuth } from './AuthProvider';

export function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email.trim(), password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Connexion impossible. Réessayez.');
      toast.error('Échec de la connexion');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-ink-deep px-4">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 -top-32 h-[28rem] w-[28rem] rounded-full bg-primary opacity-[0.16] blur-[110px]" />
        <div className="absolute -bottom-32 -right-24 h-[26rem] w-[26rem] rounded-full bg-driver opacity-[0.18] blur-[110px]" />
      </div>

      <div className="relative w-full max-w-[380px] animate-slide-up">
        <div className="mb-8 flex flex-col items-center gap-4 text-center">
          <Logo size={56} />
          <div>
            <h1 className="font-display text-2xl font-semibold text-white">HelloDriver Admin</h1>
            <p className="mt-1 text-sm text-white/50">Console d'administration</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="rounded-2xl bg-white p-6 shadow-popover space-y-4">
          <Input
            label="Email"
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@hellodriver.ga"
          />
          <Input
            label="Mot de passe"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••••"
          />
          {error && (
            <p className="rounded-lg bg-danger-light px-3 py-2 text-sm text-danger">{error}</p>
          )}
          <Button type="submit" className="w-full" size="lg" loading={loading}>
            Se connecter
          </Button>
        </form>

        <p className="mt-6 text-center text-xs text-white/35">
          Accès réservé à l'équipe HelloDriver
        </p>
      </div>
    </div>
  );
}
