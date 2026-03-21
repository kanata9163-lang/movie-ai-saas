import { redirect } from "next/navigation";
import { cookies } from "next/headers";

export default function Home() {
  const cookieStore = cookies();
  const userId = cookieStore.get("sb-user-id")?.value;

  if (userId) {
    // Logged in - go to demo workspace (will be updated after workspace lookup)
    redirect("/w/demo");
  }

  redirect("/login");
}
