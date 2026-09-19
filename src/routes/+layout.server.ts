import type { LayoutServerLoad } from './$types'

export const load: LayoutServerLoad = async ({ locals, cookies }) => {
  let { session, user } = await locals.safeGetSession();

  if (session) { 
    return {
      session,
      user,
      cookies: cookies.getAll(),
    }
  }

  return { };
}
