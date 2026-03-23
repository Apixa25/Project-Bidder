import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import AdminSearchBar from "@/components/admin/AdminSearchBar";
import AdminPagination from "@/components/admin/AdminPagination";
import MessageConversations from "./MessageConversations";

const PAGE_SIZE = 25;

interface Props {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}

export default async function AdminMessagesPage({ searchParams }: Props) {
  const params = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", user.id)
    .single();
  if (profile?.role !== "admin") redirect("/login");

  const { data: allMessages } = await supabase
    .from("messages")
    .select("*")
    .order("created_at", { ascending: false });

  // Group messages by project + conversation pair
  const conversations = new Map<
    string,
    {
      projectId: string;
      participants: Set<string>;
      messages: typeof allMessages;
      lastMessage: string;
      lastDate: string;
      count: number;
    }
  >();

  for (const msg of allMessages || []) {
    const pair = [msg.sender_id, msg.receiver_id].sort().join("-");
    const key = `${msg.project_id}::${pair}`;

    if (!conversations.has(key)) {
      conversations.set(key, {
        projectId: msg.project_id,
        participants: new Set([msg.sender_id, msg.receiver_id]),
        messages: [],
        lastMessage: msg.content,
        lastDate: msg.created_at,
        count: 0,
      });
    }
    const conv = conversations.get(key)!;
    conv.messages!.push(msg);
    conv.count++;
    if (msg.created_at > conv.lastDate) {
      conv.lastDate = msg.created_at;
      conv.lastMessage = msg.content;
    }
  }

  // Fetch project and user names
  const projectIds = [
    ...new Set([...conversations.values()].map((c) => c.projectId)),
  ];
  const userIds = [
    ...new Set(
      [...conversations.values()].flatMap((c) => [...c.participants])
    ),
  ];

  const { data: projectData } =
    projectIds.length > 0
      ? await supabase
          .from("projects")
          .select("id, title")
          .in("id", projectIds)
      : { data: [] };
  const projectMap = new Map(
    (projectData || []).map((p) => [p.id, p.title])
  );

  const { data: userData } =
    userIds.length > 0
      ? await supabase
          .from("profiles")
          .select("user_id, full_name, role")
          .in("user_id", userIds)
      : { data: [] };
  const userMap = new Map(
    (userData || []).map((u) => [u.user_id, u])
  );

  // Build serializable conversation list
  let convList = [...conversations.entries()]
    .map(([key, conv]) => {
      const participantList = [...conv.participants].map((uid) => ({
        id: uid,
        name: userMap.get(uid)?.full_name || "Unknown",
        role: userMap.get(uid)?.role || "unknown",
      }));

      return {
        key,
        projectId: conv.projectId,
        projectTitle: projectMap.get(conv.projectId) || "Deleted Project",
        participants: participantList,
        lastMessage:
          conv.lastMessage.length > 80
            ? conv.lastMessage.slice(0, 80) + "..."
            : conv.lastMessage,
        lastDate: conv.lastDate,
        count: conv.count,
        messages: (conv.messages || []).map((m) => ({
          id: m.id,
          content: m.content,
          sender_id: m.sender_id,
          senderName: userMap.get(m.sender_id)?.full_name || "Unknown",
          senderRole: userMap.get(m.sender_id)?.role || "unknown",
          created_at: m.created_at,
        })),
      };
    })
    .sort(
      (a, b) =>
        new Date(b.lastDate).getTime() - new Date(a.lastDate).getTime()
    );

  // Search filter
  const searchTerm = (params.q || "").toLowerCase();
  if (searchTerm) {
    convList = convList.filter((c) => {
      const searchable = [
        c.projectTitle,
        ...c.participants.map((p) => p.name),
        ...c.messages.map((m) => m.content),
      ]
        .join(" ")
        .toLowerCase();
      return searchable.includes(searchTerm);
    });
  }

  const totalItems = convList.length;
  const page = Math.max(1, Number(params.page || "1"));
  const paginated = convList.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE
  );

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text-primary">
          Message Monitor 💬
        </h1>
        <p className="mt-1 text-text-secondary">
          {totalItems} conversation{totalItems !== 1 ? "s" : ""} across the
          platform. {allMessages?.length || 0} total messages.
        </p>
      </div>

      <div className="mb-6 max-w-md">
        <AdminSearchBar placeholder="Search conversations, participants, content..." />
      </div>

      <MessageConversations conversations={paginated} />

      <AdminPagination totalItems={totalItems} pageSize={PAGE_SIZE} />
    </div>
  );
}
