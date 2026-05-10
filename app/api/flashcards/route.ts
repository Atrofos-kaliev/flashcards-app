import { supabase } from "@/utils/supabase";

type FlashcardInput = {
  word?: unknown;
  translation?: unknown;
  example?: unknown;
};

function toFlashcardInput(body: FlashcardInput) {
  const word = typeof body.word === "string" ? body.word.trim() : "";
  const translation = typeof body.translation === "string" ? body.translation.trim() : "";
  const example = typeof body.example === "string" ? body.example.trim() : "";

  if (!word || !translation) {
    return null;
  }

  return { word, translation, example };
}

function isAuthorized(request: Request) {
  const password = process.env.ADMIN_PASSWORD;

  return Boolean(password) && request.headers.get("x-admin-password") === password;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const due = searchParams.get("due") === "1";

  let query = supabase.from("flashcards").select("*");

  if (due) {
    query = query.lte("next_review", new Date().toISOString());
  } else {
    query = query.order("created_at", { ascending: false });
  }

  const { data, error } = await query;

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ data: data ?? [] });
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return Response.json({ error: "Неверный пароль." }, { status: 401 });
  }

  const input = toFlashcardInput(await request.json());

  if (!input) {
    return Response.json({ error: "Word and translation are required." }, { status: 400 });
  }

  const { data, error } = await supabase.from("flashcards").insert([input]).select().single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ data }, { status: 201 });
}
