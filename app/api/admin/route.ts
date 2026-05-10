function isAuthorized(request: Request) {
  const password = process.env.ADMIN_PASSWORD;

  return Boolean(password) && request.headers.get("x-admin-password") === password;
}

export async function POST(request: Request) {
  if (!process.env.ADMIN_PASSWORD) {
    return Response.json({ error: "ADMIN_PASSWORD не настроен." }, { status: 500 });
  }

  if (!isAuthorized(request)) {
    return Response.json({ error: "Неверный пароль." }, { status: 401 });
  }

  return Response.json({ ok: true });
}
