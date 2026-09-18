export const SKILL_PROGRESS_EVENT = "aergyle:skill-progress-changed";

export function dispatchSkillProgressEvent(skillName: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(SKILL_PROGRESS_EVENT, { detail: { skillName } }),
  );
}

export function addSkillProgressEventListener(
  listener: (skillName: string) => void,
) {
  if (typeof window === "undefined") return () => undefined;
  const handler = (event: Event) => {
    const customEvent = event as CustomEvent<{ skillName?: string }>;
    listener(customEvent.detail?.skillName ?? "");
  };
  window.addEventListener(SKILL_PROGRESS_EVENT, handler);
  return () => window.removeEventListener(SKILL_PROGRESS_EVENT, handler);
}
