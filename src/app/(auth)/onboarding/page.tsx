import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { OnboardingForm } from "./form";

export const metadata = { title: "Set up your household" };

export default async function Onboarding() {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (user.household_id) redirect("/app");
  const last = user.name.trim().split(/\s+/).slice(-1)[0];
  return (
    <div className="card p-7 sm:p-9">
      <p className="eyebrow">Step 1 of 1</p>
      <h1 className="h-display mt-1 text-3xl">Set up your household</h1>
      <p className="mt-1.5 text-ink-2">Hi {user.name.split(" ")[0]} — who are we organising for?</p>
      <div className="mt-7"><OnboardingForm defaultName={`The ${last} home`} /></div>
    </div>
  );
}
