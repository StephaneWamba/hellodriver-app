import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { AppShell } from '@/components/layout/AppShell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { Dialog } from '@/components/ui/Dialog';
import { PageSpinner } from '@/components/ui/Spinner';
import { IconShield } from '@/components/ui/icons';
import { ApiError } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { useAuth } from '@/features/auth/AuthProvider';
import { changePassword } from '@/features/auth/api';
import { createAdminAccount, fetchAdmins, revokeAdmin } from '@/features/admins/api';

export function SettingsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [addAdminOpen, setAddAdminOpen] = useState(false);

  const { data: admins, isLoading: adminsLoading } = useQuery({
    queryKey: ['admins'],
    queryFn: fetchAdmins,
  });

  const revokeMutation = useMutation({
    mutationFn: revokeAdmin,
    onSuccess: () => {
      toast.success('Accès admin révoqué');
      queryClient.invalidateQueries({ queryKey: ['admins'] });
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Échec de la révocation'),
  });

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (next !== confirm) {
      toast.error('Les deux mots de passe ne correspondent pas');
      return;
    }
    setLoading(true);
    try {
      await changePassword(current, next);
      toast.success('Mot de passe mis à jour');
      setCurrent('');
      setNext('');
      setConfirm('');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Échec de la mise à jour');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell title="Paramètres" description="Ton compte administrateur">
      <div className="mx-auto grid max-w-2xl gap-5">
        <Card>
          <CardContent className="flex items-center gap-4">
            <Avatar firstName={user?.name?.split(' ')[0]} lastName={user?.name?.split(' ')[1]} size={56} />
            <div>
              <p className="font-medium text-ink">{user?.name ?? 'Administrateur'}</p>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Changer le mot de passe</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Mot de passe actuel"
                type="password"
                autoComplete="current-password"
                required
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
              />
              <Input
                label="Nouveau mot de passe"
                type="password"
                autoComplete="new-password"
                required
                minLength={10}
                value={next}
                onChange={(e) => setNext(e.target.value)}
              />
              <Input
                label="Confirmer le nouveau mot de passe"
                type="password"
                autoComplete="new-password"
                required
                minLength={10}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
              <Button type="submit" loading={loading}>Mettre à jour</Button>
            </form>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <CardHeader>
            <CardTitle>Équipe admin</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setAddAdminOpen(true)}>
              <IconShield className="h-3.5 w-3.5" /> Inviter un admin
            </Button>
          </CardHeader>
          {adminsLoading ? (
            <PageSpinner />
          ) : (
            <div className="divide-y divide-border">
              {admins?.data.map((a) => (
                <div key={a.id} className="flex items-center justify-between px-5 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar firstName={a.firstName} lastName={a.lastName} size={36} />
                    <div>
                      <p className="text-sm font-medium text-ink">{a.firstName} {a.lastName}</p>
                      <p className="text-xs text-muted-foreground">{a.email} · depuis le {formatDate(a.createdAt)}</p>
                    </div>
                  </div>
                  {a.id !== user?.id && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-danger"
                      loading={revokeMutation.isPending && revokeMutation.variables === a.id}
                      onClick={() => revokeMutation.mutate(a.id)}
                    >
                      Révoquer
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <AddAdminDialog open={addAdminOpen} onOpenChange={setAddAdminOpen} />
    </AppShell>
  );
}

function AddAdminDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const queryClient = useQueryClient();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const mutation = useMutation({
    mutationFn: () => createAdminAccount({ firstName, lastName, email, password }),
    onSuccess: () => {
      toast.success('Nouvel admin créé');
      queryClient.invalidateQueries({ queryKey: ['admins'] });
      onOpenChange(false);
      setFirstName('');
      setLastName('');
      setEmail('');
      setPassword('');
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Échec de la création'),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    mutation.mutate();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Inviter un nouvel admin" description="Il pourra se connecter immédiatement avec ces identifiants.">
      <form onSubmit={handleSubmit} className="space-y-4 p-5">
        <div className="grid grid-cols-2 gap-3">
          <Input label="Prénom" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
          <Input label="Nom" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
        </div>
        <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <Input
          label="Mot de passe"
          type="password"
          minLength={10}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button type="submit" loading={mutation.isPending}>Créer le compte</Button>
        </div>
      </form>
    </Dialog>
  );
}
