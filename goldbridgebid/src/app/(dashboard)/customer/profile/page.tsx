import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Calendar } from "lucide-react";
import ProfileForm from "@/components/profile/ProfileForm";
import AvatarUpload from "@/components/profile/AvatarUpload";
import PortfolioGallery from "@/components/profile/PortfolioGallery";
import SocialLinksForm from "@/components/profile/SocialLinksForm";

export default async function CustomerProfilePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (!profile) redirect("/login");

  const { data: rawPortfolioItems } = await supabase
    .from("portfolio_items")
    .select("*")
    .eq("user_id", user.id)
    .order("display_order", { ascending: true });

  const itemIds = (rawPortfolioItems || []).map((i) => i.id);
  const { data: allMedia } = itemIds.length > 0
    ? await supabase
        .from("portfolio_item_media")
        .select("*")
        .in("portfolio_item_id", itemIds)
        .order("display_order", { ascending: true })
    : { data: [] };

  const portfolioItems = (rawPortfolioItems || []).map((item) => ({
    ...item,
    media: (allMedia || []).filter((m) => m.portfolio_item_id === item.id),
  }));

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text-primary">My Profile 👤</h1>
        <p className="mt-1 text-text-secondary">
          Manage your account information. Bidders can see your profile when you
          post projects.
        </p>
      </div>

      {/* Avatar + Account Info */}
      <div className="mb-8 rounded-xl border border-border bg-surface p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <AvatarUpload
            currentUrl={profile.avatar_url}
            userName={profile.full_name}
          />
          <div className="text-right">
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary capitalize">
              customer mode
            </span>
            <p className="mt-1 flex items-center gap-1 text-xs text-text-muted justify-end">
              <Calendar className="h-3 w-3" />
              Member since {new Date(profile.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>

      {/* Profile Form */}
      <div className="mb-8 rounded-xl border border-border bg-surface p-6 shadow-sm">
        <h2 className="mb-6 text-lg font-semibold text-text-primary">
          Edit Profile
        </h2>
        <ProfileForm profile={profile} editorRole="customer" />
      </div>

      {/* Social Links */}
      <div className="mb-8 rounded-xl border border-border bg-surface p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-text-primary">
          🔗 Links & Social Media
        </h2>
        <p className="mb-4 text-sm text-text-muted">
          Share your website and social profiles so bidders can learn more about
          you.
        </p>
        <SocialLinksForm links={profile} />
      </div>

      {/* Portfolio */}
      <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
        <PortfolioGallery
          items={portfolioItems || []}
          isOwner={true}
          ownerRole="customer"
        />
      </div>
    </div>
  );
}
