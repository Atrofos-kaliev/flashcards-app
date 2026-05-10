import { supabase } from "@/utils/supabase";

type ReviewInput = {
  box?: unknown;
  box_1_streak?: unknown;
  next_review?: unknown;
};

type FlashcardInput = {
  word?: unknown;
  translation?: unknown;
  example?: unknown;
};

type PatchInput = ReviewInput & FlashcardInput;

function isAuthorized(request: Request) {
  const password = process.env.ADMIN_PASSWORD;

  return Boolean(password) && request.headers.get("x-admin-password") === password;
}

function isValidReviewInput(body: ReviewInput) {
  return (
    Number.isInteger(body.box) &&
    Number(body.box) >= 1 &&
    Number(body.box) <= 5 &&
    Number.isInteger(body.box_1_streak) &&
    Number(body.box_1_streak) >= 0 &&
    typeof body.next_review === "string" &&
    !Number.isNaN(Date.parse(body.next_review))
  );
}

function toFlashcardInput(body: FlashcardInput) {
  const word = typeof body.word === "string" ? body.word.trim() : "";
  const translation = typeof body.translation === "string" ? body.translation.trim() : "";
  const example = typeof body.example === "string" ? body.example.trim() : "";

  if (!word || !translation) {
    return null;
  }

  return { word, translation, example };
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body: PatchInput = await request.json();

  if (!id) {
    return Response.json({ error: "Missing id." }, { status: 400 });
  }

  const flashcardInput = toFlashcardInput(body);

  if (flashcardInput) {
    if (!isAuthorized(request)) {
      return Response.json({ error: "Неверный пароль." }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("flashcards")
      .update(flashcardInput)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ data });
  }

  if (!isValidReviewInput(body)) {
    return Response.json({ error: "Invalid payload." }, { status: 400 });
  }

  const { error } = await supabase
    .from("flashcards")
    .update({
      box: body.box,
      box_1_streak: body.box_1_streak,
      next_review: body.next_review,
    })
    .eq("id", id);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (!id) {
    return Response.json({ error: "Missing id." }, { status: 400 });
  }

  if (!isAuthorized(_request)) {
    return Response.json({ error: "Неверный пароль." }, { status: 401 });
  }

  const { error } = await supabase.from("flashcards").delete().eq("id", id);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true });
}
