'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, User, Mail, Save, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/auth-context';
import { profileSchema, type ProfileInput } from '@/lib/validations';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';

export default function ProfilePage() {
  const { user, profile, updateProfile } = useAuth();

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<ProfileInput>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: profile?.name ?? '',
      avatar_url: profile?.avatar_url ?? '',
    },
    values: { name: profile?.name ?? '', avatar_url: profile?.avatar_url ?? '' },
  });

  const onSubmit = async (data: ProfileInput) => {
    const { error } = await updateProfile({
      name: data.name,
      avatar_url: data.avatar_url || null,
    });
    if (error) toast.error(error);
    else toast.success('Profile updated');
  };

  const initials = (profile?.name || 'User').split(' ').map((s) => s[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage your account information.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Account</CardTitle>
          <CardDescription>Update your display name and avatar.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-6">
            <Avatar className="h-16 w-16 border-2 border-border">
              <AvatarImage src={profile?.avatar_url ?? undefined} alt={profile?.name ?? ''} />
              <AvatarFallback className="bg-primary/15 text-primary text-lg font-semibold">{initials}</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold">{profile?.name || 'User'}</p>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
            </div>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full name</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="name" className="pl-9" {...register('name')} />
              </div>
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="avatar_url">Avatar URL (optional)</Label>
              <Input id="avatar_url" placeholder="https://..." {...register('avatar_url')} />
              {errors.avatar_url && <p className="text-xs text-destructive">{errors.avatar_url.message}</p>}
            </div>

            <div className="space-y-2">
              <Label>Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input value={user?.email ?? ''} disabled className="pl-9 bg-muted/40" />
              </div>
              <p className="text-xs text-muted-foreground">Email cannot be changed here.</p>
            </div>

            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Save className="h-4 w-4 mr-1.5" />}
              Save changes
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Account details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <DetailRow label="User ID" value={user?.id ?? '—'} mono />
          <Separator />
          <DetailRow label="Member since" value={user?.created_at ? format(new Date(user.created_at), 'MMMM d, yyyy') : '—'} icon={Calendar} />
          <Separator />
          <DetailRow label="Last sign in" value={user?.last_sign_in_at ? format(new Date(user.last_sign_in_at), 'MMM d, yyyy h:mm a') : '—'} />
        </CardContent>
      </Card>
    </div>
  );
}

function DetailRow({ label, value, mono, icon: Icon }: {
  label: string; value: string; mono?: boolean; icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-muted-foreground flex items-center gap-2">
        {Icon && <Icon className="h-3.5 w-3.5" />} {label}
      </span>
      <span className={`text-sm font-medium ${mono ? 'font-mono text-xs' : ''} truncate max-w-[60%]`}>{value}</span>
    </div>
  );
}
