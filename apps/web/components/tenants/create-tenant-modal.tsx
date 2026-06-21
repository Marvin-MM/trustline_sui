'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X, Building2, Users } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { tenantsApi } from '@/lib/api/tenants';
import { useAuthStore } from '@/stores/auth.store';
import { nameToSlug, cn } from '@/lib/utils';
import { TenantRole } from '@bondflow/types';
import { ROUTES } from '@/constants/routes';

const TENANT_STORAGE_KEY = 'bondflow:active-tenant';

const step1Schema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  slug: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/, 'Slug must be URL-safe: lowercase letters, numbers, hyphens'),
});

interface CreateTenantModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * CreateTenantModal — 2-step wizard:
 * Step 1: Name + slug (auto-generated, editable, uniqueness checked)
 * Step 2: Invite initial members (optional)
 */
export function CreateTenantModal({ open, onOpenChange }: CreateTenantModalProps) {
  const router = useRouter();
  const { setActiveTenant } = useAuthStore();
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<{ name: string; slug: string }>({
    resolver: zodResolver(step1Schema),
    defaultValues: { name: '', slug: '' },
  });

  const name = watch('name');

  // Auto-generate slug from name
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!slugManuallyEdited) {
      setValue('slug', nameToSlug(e.target.value));
    }
  };

  const onSubmit = async (data: { name: string; slug: string }) => {
    setIsLoading(true);
    try {
      const tenant = await tenantsApi.create({ name: data.name, slug: data.slug });

      localStorage.setItem(TENANT_STORAGE_KEY, tenant.id);
      setActiveTenant({
        tenantId: tenant.id,
        tenantSlug: tenant.slug,
        tenantRole: TenantRole.OWNER,
        tenantName: tenant.name,
      });

      toast.success('Workspace created!');
      onOpenChange(false);
      router.push(ROUTES.tenantDashboard(tenant.slug));
    } catch {
      toast.error('Failed to create workspace. The slug may already be taken.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm" />
        <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-[80] max-h-[min(90vh,640px)] w-[calc(100vw-2rem)] max-w-md overflow-y-auto rounded-xl border border-border bg-card p-5 shadow-2xl [translate:-50%_-50%] outline-none animate-fade-in sm:rounded-2xl sm:p-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10 text-brand">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <DialogPrimitive.Title className="text-base font-semibold text-foreground">
                  Create Workspace
                </DialogPrimitive.Title>
                <DialogPrimitive.Description className="text-xs text-muted-foreground">
                  Step {step} of 2
                </DialogPrimitive.Description>
              </div>
            </div>
            <DialogPrimitive.Close className="rounded-lg p-1 text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </DialogPrimitive.Close>
          </div>

          {/* Step indicators */}
          <div className="flex gap-2 mb-6">
            {[1, 2].map((s) => (
              <div
                key={s}
                className={cn(
                  'h-1.5 flex-1 rounded-full transition-colors',
                  step >= s ? 'bg-brand' : 'bg-muted'
                )}
              />
            ))}
          </div>

          {step === 1 && (
            <form
              onSubmit={handleSubmit(async (data) => {
                const availability = await tenantsApi.checkSlugAvailability(data.slug);
                if (!availability.available) {
                  toast.error('That workspace slug is already taken.');
                  return;
                }
                setStep(2);
              })}
              className="space-y-4"
            >
              <div>
                <label htmlFor="tenant-name" className="block text-sm font-medium text-foreground mb-1.5">
                  Workspace Name
                </label>
                <input
                  id="tenant-name"
                  {...register('name')}
                  onChange={(e) => {
                    register('name').onChange(e);
                    handleNameChange(e);
                  }}
                  placeholder="Acme Corp"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand/50"
                />
                {errors.name && (
                  <p className="mt-1 text-xs text-destructive">{errors.name.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="tenant-slug" className="block text-sm font-medium text-foreground mb-1.5">
                  URL Slug
                </label>
                <div className="flex items-center rounded-lg border border-border bg-background overflow-hidden focus-within:ring-2 focus-within:ring-brand/50">
                  <span className="px-3 py-2.5 text-xs text-muted-foreground border-r border-border bg-muted shrink-0">
                    trustline.io/
                  </span>
                  <input
                    id="tenant-slug"
                    {...register('slug')}
                    onChange={(e) => {
                      register('slug').onChange(e);
                      setSlugManuallyEdited(true);
                    }}
                    className="flex-1 bg-transparent px-3 py-2.5 text-sm text-foreground focus:outline-none font-mono-num"
                  />
                </div>
                {errors.slug && (
                  <p className="mt-1 text-xs text-destructive">{errors.slug.message}</p>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <DialogPrimitive.Close className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted">
                  Cancel
                </DialogPrimitive.Close>
                <button
                  type="submit"
                  className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand/90"
                >
                  Continue
                </button>
              </div>
            </form>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="rounded-lg border border-border bg-muted/30 p-4 flex items-center gap-3">
                <Users className="h-5 w-5 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">Invite team members</p>
                  <p className="text-xs text-muted-foreground">You can invite members after creating the workspace from Settings → Members.</p>
                </div>
              </div>

              <div className="flex justify-between gap-3 pt-2">
                <button
                  onClick={() => setStep(1)}
                  className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
                >
                  Back
                </button>
                <button
                  onClick={handleSubmit(onSubmit)}
                  disabled={isLoading}
                  className="flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand/90 disabled:opacity-50"
                >
                  {isLoading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />}
                  Create Workspace
                </button>
              </div>
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
