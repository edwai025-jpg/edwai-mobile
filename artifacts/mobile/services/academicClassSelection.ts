export type AcademicClass = { id: number; name: string };

type ClassSelectionProfile = {
  classId?: number | string | null;
  className?: string | null;
  orgRole?: string | null;
  orgId?: number | string | null;
};

export function isInstituteStudent(profile?: ClassSelectionProfile | null): boolean {
  return Boolean(profile?.orgRole === "student" && profile.orgId);
}

export function academicClassName(item: AcademicClass, profile?: ClassSelectionProfile | null): string {
  return isInstituteStudent(profile) && String(item.id) === String(profile?.classId)
    ? profile?.className || item.name
    : item.name;
}

/** Default only from the server's scoped list; board students have no fallback. */
export function initialAcademicClass(
  classes: readonly AcademicClass[],
  profile?: ClassSelectionProfile | null,
): AcademicClass | null {
  if (!profile || classes.length === 0) return null;
  const assigned = profile.classId == null
    ? undefined
    : classes.find(item => String(item.id) === String(profile.classId));
  const selected = assigned ?? (isInstituteStudent(profile) ? classes[0] : undefined);
  return selected ? { ...selected, name: academicClassName(selected, profile) } : null;
}
