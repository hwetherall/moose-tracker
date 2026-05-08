import { NextResponse } from 'next/server';

const PASSWORD = process.env.APP_PASSWORD || '';
const PASSWORD_COOKIE = 'antler-password';

export async function POST(request: Request) {
  const { password } = await request.json();

  if (password !== PASSWORD) {
    return NextResponse.json({ error: 'Incorrect password' }, { status: 401 });
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set(PASSWORD_COOKIE, PASSWORD, {
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
  });

  return response;
}
