import { useCallback, useRef, useState } from "react";
import { router } from "expo-router";
import { usePlan } from "@/context/PlanContext";
import { createDraftProject } from "@/services/api/projects";
import type { ProjectStatus, ProjectSummary } from "@/types/project";

interface Options {
  onCreated?: (draft: ProjectSummary & { created: boolean }) => void;
  onOpen?: (projectId: number) => void;
}

/** The existing New Project flow, shared by Home's banner/empty state and Project Overview. */
export function useNewProjectFlow(projects: { id: number; status: ProjectStatus; title?: string }[], { onCreated, onOpen }: Options = {}) {
  const { ready, selectProject, startFresh } = usePlan();
  const [confirmNewProject, setConfirmNewProject] = useState(false);
  const [creatingProject, setCreatingProject] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const openPlanner = useCallback((projectId: number, fresh = false, title?: string) => {
    if (fresh) startFresh(projectId, title);
    else selectProject(projectId, undefined, title);
    onOpen?.(projectId);
    router.push("/homeowner/project-chat" as never);
  }, [selectProject, startFresh, onOpen]);

  const createNewProject = useCallback(async () => {
    if (!ready || inFlight.current) return;
    inFlight.current = true;
    setCreatingProject(true);
    setCreateError(null);
    try {
      const draft = await createDraftProject();
      onCreated?.(draft);
      setConfirmNewProject(false);
      // A resumed placeholder retains its conversation; only an actually new draft starts fresh.
      openPlanner(draft.id, draft.created, draft.title);
    } catch {
      setConfirmNewProject(false);
      setCreateError("Couldn't create the project. Check your connection and try again.");
    } finally {
      inFlight.current = false;
      setCreatingProject(false);
    }
  }, [ready, onCreated, openPlanner]);

  const requestNewProject = useCallback(() => {
    if (!ready || inFlight.current) return;
    const waiting = projects.find((project) => project.status === "not_started");
    if (waiting) openPlanner(waiting.id, false, waiting.title);
    else if (projects.length > 0) setConfirmNewProject(true);
    else void createNewProject();
  }, [ready, projects, openPlanner, createNewProject]);

  return { ready, openPlanner, requestNewProject, createNewProject, confirmNewProject, setConfirmNewProject, creatingProject, createError };
}
