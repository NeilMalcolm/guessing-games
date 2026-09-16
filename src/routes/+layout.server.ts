import type { LayoutServerLoad } from './$types'

export const load: LayoutServerLoad = async ({ locals, cookies }) => {
  let { session, user } = await locals.safeGetSession();

  if (!session)
  {
    let result = await locals.supabase.auth.signInAnonymously();

    if (!result.error)
    {
      session = result.data.session;
      user = result.data.user;
    }
  }

  console.log(session);
  console.log(user);

  return {
    session,
    user,
    cookies: cookies.getAll(),
  }
}
