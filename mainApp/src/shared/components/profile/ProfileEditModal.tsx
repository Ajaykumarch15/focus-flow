import { useState, useEffect } from 'react';
import { Dialog } from '@shared/components/ui/Dialog';
import { Input } from '@shared/components/ui/Input';
import { Textarea } from '@shared/components/ui/Textarea';
import { Field } from '@shared/components/ui/Field';
import { Button } from '@shared/components/ui/Button';
import type { PublicProfile, SocialLinks } from '@shared/types';

interface ProfileEditModalProps {
  open: boolean;
  onClose: () => void;
  profile: PublicProfile;
  onSave: (data: { name: string; bio: string; socialLinks: SocialLinks }) => Promise<void>;
}

export function ProfileEditModal({ open, onClose, profile, onSave }: ProfileEditModalProps) {
  const [name, setName] = useState(profile.name);
  const [bio, setBio] = useState(profile.bio || '');
  const [socialLinks, setSocialLinks] = useState<SocialLinks>(profile.socialLinks || {});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(profile.name);
      setBio(profile.bio || '');
      setSocialLinks(profile.socialLinks || {});
    }
  }, [open, profile]);

  const handleSubmit = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSave({ name: name.trim(), bio: bio.trim(), socialLinks });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Edit Profile"
      description="Update your public profile information"
      size="md"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={handleSubmit} disabled={saving || !name.trim()}>
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Display Name">
          <Input
            className="h-11 rounded-xl"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Your name"
            maxLength={100}
          />
        </Field>

        <Field label="Bio">
          <Textarea
            className="rounded-xl min-h-[80px] resize-none"
            value={bio}
            onChange={e => setBio(e.target.value)}
            placeholder="Tell others about yourself..."
            maxLength={500}
          />
          <p className="text-[11px] text-surface-500 mt-1">{bio.length}/500</p>
        </Field>

        <div className="border-t border-surface-800 pt-4">
          <p className="text-xs font-semibold text-surface-300 uppercase tracking-wider mb-3">Social Links</p>

          <div className="space-y-3">
            <Field label="Website">
              <Input
                className="h-10 rounded-xl text-sm"
                value={socialLinks.website || ''}
                onChange={e => setSocialLinks({ ...socialLinks, website: e.target.value })}
                placeholder="https://yoursite.com"
                maxLength={200}
              />
            </Field>
            <Field label="GitHub">
              <Input
                className="h-10 rounded-xl text-sm"
                value={socialLinks.github || ''}
                onChange={e => setSocialLinks({ ...socialLinks, github: e.target.value })}
                placeholder="https://github.com/username"
                maxLength={200}
              />
            </Field>
            <Field label="Twitter / X">
              <Input
                className="h-10 rounded-xl text-sm"
                value={socialLinks.twitter || ''}
                onChange={e => setSocialLinks({ ...socialLinks, twitter: e.target.value })}
                placeholder="https://x.com/username"
                maxLength={200}
              />
            </Field>
            <Field label="LinkedIn">
              <Input
                className="h-10 rounded-xl text-sm"
                value={socialLinks.linkedin || ''}
                onChange={e => setSocialLinks({ ...socialLinks, linkedin: e.target.value })}
                placeholder="https://linkedin.com/in/username"
                maxLength={200}
              />
            </Field>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
