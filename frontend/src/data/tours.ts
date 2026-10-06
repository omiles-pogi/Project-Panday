import type { Ionicons } from "@expo/vector-icons";
import type { Role } from "@/types/auth";

export interface TourStep {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  text: string;
}

// Pandy's walkthrough per role. Keep each step to one or two short sentences.
export const TOURS: Record<Role, TourStep[]> = {
  homeowner: [
    { icon: "hand-left-outline", title: "Hi, I'm Pandy!", text: "I'll show you around so you can plan, build and track your home project with confidence." },
    { icon: "sparkles-outline", title: "AI Plan", text: "Describe your project in your own words. I'll build a full plan: timeline, budget, materials, equipment and a design concept." },
    { icon: "stats-chart-outline", title: "Progress", text: "Once your plan is approved, follow each construction phase here and see what's done." },
    { icon: "pie-chart-outline", title: "Budget", text: "Keep an eye on what you've spent against your estimate so there are no surprises." },
    { icon: "people-outline", title: "Find your team", text: "Under More, browse contractors and skilled workers and add them to your project." },
    { icon: "menu-outline", title: "Side menu", text: "Tap the menu icon at the top left for every tool, including approvals and estimators." },
  ],
  contractor: [
    { icon: "hand-left-outline", title: "Hi, I'm Pandy!", text: "Welcome aboard! Here's a quick look at how to find jobs and keep them on track." },
    { icon: "list-outline", title: "Browse", text: "See open homeowner projects and pick the ones that fit your skills and schedule." },
    { icon: "business-outline", title: "Projects", text: "Your assigned projects live here. Check off work as each phase is completed." },
    { icon: "document-text-outline", title: "Report", text: "Send progress reports so homeowners always know where things stand." },
    { icon: "ellipsis-horizontal", title: "More", text: "Edit your profile, and check capacity, equipment schedules and weekly analytics." },
  ],
  worker: [
    { icon: "hand-left-outline", title: "Hi, I'm Pandy!", text: "Welcome! Let me show you how to manage your jobs and your day." },
    { icon: "briefcase-outline", title: "Tasks", text: "Your assignments appear here, with the project and what needs doing." },
    { icon: "document-text-outline", title: "Daily log", text: "Write down the work you finished each day so everyone stays updated." },
    { icon: "calendar-outline", title: "Attendance", text: "Time in and out so your hours are counted correctly." },
    { icon: "wallet-outline", title: "Earnings & skills", text: "Under More, check your timesheet and earnings, and keep your skills up to date." },
  ],
  supplier: [
    { icon: "hand-left-outline", title: "Hi, I'm Pandy!", text: "Welcome, supplier! Let me show you how to win jobs and keep your stock moving." },
    { icon: "pricetag-outline", title: "Bids", text: "See quote requests from homeowners and contractors, then submit or edit your bid with a delivery date and payment terms." },
    { icon: "cube-outline", title: "Orders", text: "Move each order from processing to delivered and keep an eye on what's been paid." },
    { icon: "cash-outline", title: "Pricing", text: "Update prices and stock, mark items unavailable, or add new products to sell." },
    { icon: "ellipsis-horizontal", title: "More", text: "Replay this tour or sign out from here anytime." },
  ],
};
