import { NextResponse } from 'next/server';

const PASSWORD_COOKIE = 'antler-password';

export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.delete(PASSWORD_COOKIE);
  return response;
}
