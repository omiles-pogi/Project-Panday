import { InfoBox } from "@/components/ui";
import type { DashboardProject } from "@/types/project";
import { formatDateTime } from "@/utils/projectStatus";

/**
 * Where the project stands in the finish-and-confirm handshake, for the contractor: submitted and
 * waiting, completed, or sent back with corrections. Nothing for an ordinary ongoing project.
 */
export default function ProjectStatusBanner({ project }: { project: DashboardProject }) {
  const completion = project.completion;
  if (!completion) return null;

  if (project.status === "pending_confirmation") {
    return (
      <InfoBox color="#8b5cf6" title="Project Status: Pending Homeowner Confirmation">
        {`${completion.submittedAt ? `Submitted ${formatDateTime(completion.submittedAt)}. ` : ""}The checklist is locked until the homeowner confirms completion or asks for corrections.`}
      </InfoBox>
    );
  }

  if (project.status === "completed") {
    return (
      <InfoBox color="#10b981" title="Project Completed">
        {[
          completion.confirmedAt ? `Confirmed by the homeowner on ${formatDateTime(completion.confirmedAt)}.` : null,
          completion.submittedAt ? `Finished ${formatDateTime(completion.submittedAt)}.` : null,
          "The checklist can no longer be changed.",
        ]
          .filter(Boolean)
          .join(" ")}
      </InfoBox>
    );
  }

  if (project.status === "active" && completion.correctionsNote) {
    return (
      <InfoBox color="#ef4444" title="The homeowner requested corrections">
        {`${completion.correctionsNote}${completion.correctionsRequestedAt ? `\n${formatDateTime(completion.correctionsRequestedAt)}` : ""}\nFix the items, then mark the project as finished again.`}
      </InfoBox>
    );
  }

  return null;
}
