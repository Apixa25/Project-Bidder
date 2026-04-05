"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function askProjectQuestion(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" };

  const projectId = formData.get("projectId") as string;
  const question = (formData.get("question") as string)?.trim();

  if (!projectId || !question) {
    return { error: "Question cannot be empty." };
  }

  const { data: project } = await supabase
    .from("projects")
    .select("id, customer_id, title")
    .eq("id", projectId)
    .single();

  if (!project) return { error: "Project not found." };

  if (project.customer_id === user.id) {
    return { error: "You cannot ask questions on your own project." };
  }

  const { error } = await supabase.from("project_questions").insert({
    project_id: projectId,
    asker_id: user.id,
    question,
  });

  if (error) {
    console.error("Ask question error:", error);
    return { error: "Failed to submit question." };
  }

  await supabase.from("notifications").insert({
    user_id: project.customer_id,
    type: "new_question",
    title: "New question on your project",
    message: `A bidder asked a question on "${project.title}".`,
    link: `/customer/projects/${projectId}`,
  });

  revalidatePath(`/customer/projects/${projectId}`);
  revalidatePath(`/bidder/projects/${projectId}`);

  return { success: true };
}

export async function answerProjectQuestion(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" };

  const questionId = formData.get("questionId") as string;
  const projectId = formData.get("projectId") as string;
  const answer = (formData.get("answer") as string)?.trim();

  if (!questionId || !answer) {
    return { error: "Answer cannot be empty." };
  }

  const { data: project } = await supabase
    .from("projects")
    .select("id, customer_id, title")
    .eq("id", projectId)
    .eq("customer_id", user.id)
    .single();

  if (!project) {
    return { error: "You can only answer questions on your own projects." };
  }

  const { error } = await supabase
    .from("project_questions")
    .update({
      answer,
      answered_at: new Date().toISOString(),
    })
    .eq("id", questionId)
    .eq("project_id", projectId);

  if (error) {
    console.error("Answer question error:", error);
    return { error: "Failed to post answer." };
  }

  const { data: question } = await supabase
    .from("project_questions")
    .select("asker_id")
    .eq("id", questionId)
    .single();

  if (question) {
    await supabase.from("notifications").insert({
      user_id: question.asker_id,
      type: "question_answered",
      title: "Your question was answered",
      message: `The customer answered your question on "${project.title}".`,
      link: `/bidder/projects/${projectId}`,
    });
  }

  revalidatePath(`/customer/projects/${projectId}`);
  revalidatePath(`/bidder/projects/${projectId}`);

  return { success: true };
}
