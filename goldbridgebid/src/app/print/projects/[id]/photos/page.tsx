import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import { userHasRole } from "@/lib/auth/roles";
import AutoPrintTrigger from "../../../AutoPrintTrigger";

/**
 * Print-friendly photo contact-sheet for a project.
 *
 * Lays out every uploaded image (annotated version preferred) two-per-row so
 * bidders can take the visual context with them in the truck.
 */
export default async function PrintProjectPhotosPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ originals?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const showOriginals = query.originals === "1";

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: project } = await supabase
    .from("projects")
    .select("id, customer_id, status, title")
    .eq("id", id)
    .single();
  if (!project) notFound();

  const isOwner = project.customer_id === user.id;
  const isAdmin = await userHasRole(user.id, "admin");
  const isBidder = await userHasRole(user.id, "bidder");

  const canView =
    isOwner || isAdmin || (isBidder && project.status === "open");
  if (!canView) notFound();

  const { data: projectFiles } = await supabase
    .from("project_files")
    .select("*")
    .eq("project_id", id)
    .order("display_order", { ascending: true })
    .order("uploaded_at", { ascending: false });

  const imageFiles = (projectFiles || []).filter((f) =>
    f.file_type?.startsWith("image/")
  );

  return (
    <>
      <AutoPrintTrigger />

      <main className="print-sheet mx-auto max-w-4xl px-8 py-6 text-black">
        <header className="mb-4 border-b-2 border-slate-800 pb-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            ProjectXBidX — Project Photos
          </p>
          <h1 className="mt-1 text-xl font-bold text-slate-900">
            {project.title}
          </h1>
          <p className="mt-1 text-xs text-slate-600">
            {imageFiles.length} photo(s) •{" "}
            {showOriginals
              ? "Original photos shown"
              : "Annotated versions shown when available"}
            {" • "}
            Printed: {new Date().toLocaleString()}
          </p>
        </header>

        {imageFiles.length === 0 ? (
          <p className="text-sm italic text-slate-500">
            No photos have been uploaded for this project.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {imageFiles.map((file) => {
              const useAnnotated = !showOriginals && file.annotated_url;
              const displayUrl = useAnnotated
                ? file.annotated_url!
                : file.file_url;

              return (
                <figure
                  key={file.id}
                  className="page-break-avoid border border-slate-300 p-2"
                >
                  <img
                    src={displayUrl}
                    alt={file.file_name}
                    className="h-auto max-h-[3.5in] w-full object-contain"
                  />
                  <figcaption className="mt-1 flex items-center justify-between gap-2 text-[10pt] text-slate-700">
                    <span className="truncate font-medium">
                      {file.file_name}
                    </span>
                    {useAnnotated && (
                      <span className="rounded bg-amber-200 px-1.5 py-0.5 text-[9pt] font-bold text-amber-900">
                        ANNOTATED
                      </span>
                    )}
                  </figcaption>
                </figure>
              );
            })}
          </div>
        )}

        <footer className="mt-6 border-t border-slate-300 pt-3 text-center text-[10pt] text-slate-500">
          ProjectXBidX.com
        </footer>
      </main>
    </>
  );
}
