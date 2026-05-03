import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Calendar, MapPin } from "lucide-react";
import ProfileForm from "@/components/profile/ProfileForm";
import AvatarUpload from "@/components/profile/AvatarUpload";
import PortfolioGallery from "@/components/profile/PortfolioGallery";
import SocialLinksForm from "@/components/profile/SocialLinksForm";
import CustomerAddressMapPicker from "@/components/address-quotes/CustomerAddressMapPicker";
import { userHasRole } from "@/lib/auth/roles";
import { createAdminClient } from "@/lib/supabase/admin";
import { saveCustomerAddressForRequests } from "@/lib/address-quotes/actions";
import type { PropertyAddress, PropertyAddressClaim } from "@/types/database";

interface CustomerProfilePageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function CustomerProfilePage({
  searchParams,
}: CustomerProfilePageProps) {
  const query = await searchParams;
  const supabase = await createClient();
  const admin = createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  if (!(await userHasRole(user.id, "customer"))) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (!profile) redirect("/login");

  const [{ data: rawPortfolioItems }, { data: claimRows }] = await Promise.all([
    supabase
      .from("portfolio_items")
      .select("*")
      .eq("user_id", user.id)
      .order("display_order", { ascending: true }),
    admin
      .from("property_address_claims")
      .select("*")
      .eq("user_id", user.id)
      .in("status", ["pending", "verified"])
      .order("created_at", { ascending: false }),
  ]);

  const itemIds = (rawPortfolioItems || []).map((i) => i.id);
  const claims = (claimRows || []) as PropertyAddressClaim[];
  const savedClaim = claims[0] || null;
  const [{ data: allMedia }, { data: savedAddressRow }] = await Promise.all([
    itemIds.length > 0
      ? supabase
          .from("portfolio_item_media")
          .select("*")
          .in("portfolio_item_id", itemIds)
          .order("display_order", { ascending: true })
      : Promise.resolve({ data: [] }),
    savedClaim
      ? admin
          .from("property_addresses")
          .select("*")
          .eq("id", savedClaim.property_address_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const portfolioItems = (rawPortfolioItems || []).map((item) => ({
    ...item,
    media: (allMedia || []).filter((m) => m.portfolio_item_id === item.id),
  }));
  const savedAddress = savedAddressRow as PropertyAddress | null;
  const profileCityStateZip = [profile.city, profile.state, profile.zip]
    .filter(Boolean)
    .join(", ");
  const profileDisplayAddress = [profile.address, profileCityStateZip]
    .filter(Boolean)
    .join(", ");
  const pickerDisplayAddress =
    savedAddress?.display_address || profileDisplayAddress;
  const pickerStreet = savedAddress?.street || profile.address || "";
  const pickerCity = savedAddress?.city || profile.city || "";
  const pickerState = savedAddress?.state || profile.state || "";
  const pickerZip = savedAddress?.zip || profile.zip || "";
  const addressFeedback =
    query.address === "saved"
      ? "Exact customer address saved. Contractors will use this pinned location for address requests."
      : query.error === "address"
        ? "We could not save that address. Please review the address text and map pin, then try again."
        : null;

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
        <div className="mt-8 border-t border-border pt-8">
          <div className="mb-4 flex items-start gap-3">
            <div className="rounded-full bg-secondary/10 p-2 text-secondary">
              <MapPin className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-semibold text-text-primary">
                Exact Address Pin
              </h3>
              <p className="mt-1 text-sm leading-6 text-text-secondary">
                Your typed profile address is still useful, but this red pin is
                the source of truth for contractors when you create address
                quote requests.
              </p>
            </div>
          </div>
          {addressFeedback && (
            <p
              className={`mb-4 rounded-lg px-4 py-3 text-sm ${
                query.address === "saved"
                  ? "border border-green-200 bg-green-50 text-green-700"
                  : "border border-red-200 bg-red-50 text-red-700"
              }`}
            >
              {addressFeedback}
            </p>
          )}
          {profile.exact_address_map_image_url && (
            <div className="mb-4 rounded-xl border border-border bg-white p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
                Saved map preview
              </p>
              <img
                src={profile.exact_address_map_image_url}
                alt="Saved exact address map area"
                className="h-48 w-full rounded-lg object-cover sm:h-64"
              />
            </div>
          )}
          <form
            action={saveCustomerAddressForRequests}
            className="rounded-xl border border-border bg-bg-warm p-4"
          >
            <input type="hidden" name="returnPath" value="/customer/profile" />
            <CustomerAddressMapPicker
              initialDisplayAddress={pickerDisplayAddress}
              initialStreet={pickerStreet}
              initialCity={pickerCity}
              initialState={pickerState}
              initialZip={pickerZip}
              initialLatitude={savedAddress?.latitude}
              initialLongitude={savedAddress?.longitude}
              label="Pin your exact customer address"
              helpText="Search the typed address first, then drag the map by clicking the exact home, unit, driveway, or job location. If a red pin is saved, contractors should treat the pin as the real location."
            />
            <button
              type="submit"
              className="mt-4 inline-flex w-full items-center justify-center rounded-lg bg-secondary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-secondary-dark sm:w-auto"
            >
              Save Exact Address Pin
            </button>
          </form>
        </div>
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
