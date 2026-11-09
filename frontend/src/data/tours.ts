import type { Ionicons } from "@expo/vector-icons";
import type { Role } from "@/types/auth";

export interface TourStep {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  text: string;
}

// PandAi's walkthrough per role. Keep each step to one or two short sentences.
export const TOURS: Record<Role, TourStep[]> = {
  homeowner: [
    { icon: "hand-left-outline", title: "Hi, I'm PandAi!", text: "I'll show you around so you can plan, build and track your home project with confidence." },
    { icon: "sparkles-outline", title: "AI Plan", text: "Describe your project in your own words. I'll build a full plan: timeline, budget and materials, and you can pick your suppliers." },
    { icon: "stats-chart-outline", title: "Progress", text: "Once your plan is approved, follow each construction phase here and see what's done." },
    { icon: "pie-chart-outline", title: "Budget", text: "Keep an eye on what you've spent against your estimate so there are no surprises." },
    { icon: "people-outline", title: "Find your team", text: "Under More, browse contractors and skilled workers and add them to your project." },
    { icon: "menu-outline", title: "Side menu", text: "Tap the menu icon at the top left for every tool, including material approvals and the supplier catalog. Your project calendar is on the Home screen." },
  ],
  contractor: [
    { icon: "hand-left-outline", title: "Hi, I'm PandAi!", text: "Welcome aboard! Here's a quick look at how to find jobs and keep them on track." },
    { icon: "list-outline", title: "Browse", text: "See open homeowner projects and pick the ones that fit your skills and schedule." },
    { icon: "business-outline", title: "Projects", text: "Your assigned projects live here. Check off work as each phase is completed." },
    { icon: "calendar-outline", title: "Calendar", text: "On your Home screen, see the AI-proposed schedule for each project and how your real progress compares." },
    { icon: "ellipsis-horizontal", title: "More", text: "Edit your profile and browse supplier materials." },
  ],
  worker: [
    { icon: "hand-left-outline", title: "Hi, I'm PandAi!", text: "Welcome! Let me show you how to manage your jobs and your day." },
    { icon: "briefcase-outline", title: "Tasks", text: "Your assignments appear here, with the project and what needs doing." },
    { icon: "list-outline", title: "Browse", text: "Find open projects and apply to the ones that fit your trade." },
    { icon: "build-outline", title: "Skills", text: "Under More, keep your trade and skills up to date so homeowners and contractors can find you." },
  ],
  supplier: [
    { icon: "hand-left-outline", title: "Hi, I'm PandAi!", text: "Welcome, supplier! Let me show you how to win jobs and keep your stock moving." },
    { icon: "cube-outline", title: "Fulfillment", text: "Confirm or decline material requests — the contractor confirms receipt once the materials arrive." },
    { icon: "cash-outline", title: "Inventory", text: "Update prices and stock, hide items, or add new products. Homeowners price their plans from your listings." },
    { icon: "ellipsis-horizontal", title: "More", text: "Replay this tour or sign out from here anytime." },
  ],
};
