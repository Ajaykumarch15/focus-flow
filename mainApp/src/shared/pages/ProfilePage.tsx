import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { api } from '@shared/utils/api';
import { useAuthStore } from '@shared/services/useAuthStore';
import { toast } from '@shared/services/useToastStore';
import { Skeleton } from '@shared/components/ui/Skeleton';
import { EmptyState } from '@shared/components/ui/EmptyState';
import { UserX } from 'lucide-react';
import {
  ProfileHeader,
  ProfileStatsGrid,
  ProfileHeatmap,
  ProfileActivityFeed,
  ProfileAchievements,
  ProfileSidebar,
  ProfileEditModal,
} from '@shared/components/profile';
import type { PublicProfile, ProfileStats, SocialLinks } from '@shared/types';

const EMPTY_STATS: ProfileStats = {
  totalFocusMs: 0,
  tasksCompleted: 0,
  sessionsCount: 0,
  dailyHours: {},
  recentActivity: [],
  rank: null,
};

export function ProfilePage() {
  const { userId: paramUserId } = useParams<{ userId?: string }>();
  const { user: currentUser } = useAuthStore();

  const isSelf = !paramUserId || paramUserId === currentUser?._id;
  const targetUserId = isSelf ? currentUser?._id : paramUserId;

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const fetchProfile = useCallback(async () => {
    if (!targetUserId) return;
    setLoading(true);
    setError(false);
    try {
      const profileData = isSelf
        ? await api.profile.get()
        : await api.profile.getPublic(targetUserId);

      if (isSelf) {
        setProfile({
          _id: profileData._id,
          name: profileData.name,
          avatar: profileData.avatar,
          bio: profileData.bio,
          socialLinks: profileData.socialLinks,
          joinedAt: profileData.createdAt,
          streak: profileData.streak,
          totalPoints: profileData.totalPoints,
          leaderboardOptIn: profileData.leaderboardOptIn,
        });
      } else {
        setProfile(profileData);
      }
    } catch (err: any) {
      console.error('[ProfilePage] Failed to load profile:', err);
      setError(true);
    } finally {
      setLoading(false);
    }

    // Stats are fetched independently — a stats failure shouldn't block the profile
    if (targetUserId) {
      try {
        const statsData = await api.profile.getStats(targetUserId);
        setStats(statsData);
      } catch (err: any) {
        console.error('[ProfilePage] Failed to load stats:', err);
        setStats(EMPTY_STATS);
      }
    }
  }, [targetUserId, isSelf]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleSave = async (data: { name: string; bio: string; socialLinks: SocialLinks }) => {
    try {
      await api.profile.update(data);
      await fetchProfile();
      toast.success('Profile updated');
    } catch (err: any) {
      toast.error('Failed to update profile', err.message);
      throw err;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-950 p-6 lg:p-10">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header skeleton */}
          <div className="rounded-2xl border border-surface-800/80 bg-surface-900/70 p-6">
            <div className="flex items-start gap-5">
              <Skeleton className="h-24 w-24 rounded-full" />
              <div className="flex-1 space-y-3">
                <Skeleton className="h-6 w-48 rounded" />
                <Skeleton className="h-4 w-32 rounded" />
                <Skeleton className="h-4 w-64 rounded" />
              </div>
            </div>
          </div>
          {/* Stats skeleton */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-surface-800/80 bg-surface-900/70 p-4">
                <Skeleton className="h-8 w-8 rounded-xl mb-3" />
                <Skeleton className="h-6 w-16 rounded mb-1" />
                <Skeleton className="h-3 w-20 rounded" />
              </div>
            ))}
          </div>
          {/* Content skeleton */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Skeleton className="h-40 rounded-2xl" />
              <Skeleton className="h-60 rounded-2xl" />
            </div>
            <Skeleton className="h-64 rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-surface-950 p-6 lg:p-10">
        <div className="max-w-4xl mx-auto">
          <EmptyState
            className="rounded-2xl border border-surface-800 bg-surface-900/70 !py-16"
            icon={<UserX size={28} />}
            title="Profile not found"
            description="This profile doesn't exist or isn't publicly visible."
          />
        </div>
      </div>
    );
  }

  const effectiveStats = stats ?? EMPTY_STATS;

  return (
    <div className="min-h-screen bg-surface-950 p-6 lg:p-10">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="max-w-4xl mx-auto space-y-6"
      >
        <ProfileHeader profile={profile} isSelf={isSelf} onEdit={() => setEditOpen(true)} />

        <ProfileStatsGrid stats={effectiveStats} profile={profile} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <ProfileHeatmap dailyHours={effectiveStats.dailyHours} />
            <ProfileAchievements profile={profile} stats={effectiveStats} />
          </div>
          <div className="space-y-6">
            <ProfileSidebar profile={profile} stats={effectiveStats} />
            <ProfileActivityFeed activities={effectiveStats.recentActivity} />
          </div>
        </div>
      </motion.div>

      {isSelf && (
        <ProfileEditModal
          open={editOpen}
          onClose={() => setEditOpen(false)}
          profile={profile}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
