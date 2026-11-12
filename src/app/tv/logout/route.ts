import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { NextResponse } from 'next/server';

export async function GET() {
  const cookieStore = await cookies();
  cookieStore.delete('homeflix_session');
  cookieStore.delete('homeflix_profile_id');
  redirect('/tv/login');
}

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.delete('homeflix_session');
  cookieStore.delete('homeflix_profile_id');
  return NextResponse.redirect('/tv/login', { status: 303 });
}
