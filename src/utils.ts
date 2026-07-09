export const formatGrade = (rawValue: string | undefined | null): string => {
  if (!rawValue) return "Grade 10"; // Default
  const matchNumbers = rawValue.match(/\d+/);
  const pureGradeNumber = matchNumbers ? matchNumbers[0] : "10";
  return `Grade ${pureGradeNumber}`;
};

export function getInstallmentDueDates(admissionDateStr: string, feesPlan: "quarterly" | "half-yearly"): string[] {
  const parts = (admissionDateStr || new Date().toISOString().split("T")[0]).split("-");
  const admYear = parseInt(parts[0], 10) || new Date().getFullYear();
  const admMonth = parseInt(parts[1], 10) || (new Date().getMonth() + 1);
  const admDay = parseInt(parts[2], 10) || new Date().getDate();

  // Academic year start year: ends in April of next year, so April (4) to Dec (12) is same year, Jan (1) to Mar (3) is prev year
  let academicStartYear = admYear;
  if (admMonth < 4) {
    academicStartYear = admYear - 1;
  }

  const dates: string[] = [];

  const clampDay = (day: number, month: number) => {
    let maxDays = 31;
    if (month === 11) maxDays = 30; // November
    return Math.min(day, maxDays);
  };

  if (feesPlan === "quarterly") {
    // 1st: May
    const d1 = `${academicStartYear}-05-${String(clampDay(admDay, 5)).padStart(2, "0")}`;
    // 2nd: August
    const d2 = `${academicStartYear}-08-${String(clampDay(admDay, 8)).padStart(2, "0")}`;
    // 3rd: November
    const d3 = `${academicStartYear}-11-${String(clampDay(admDay, 11)).padStart(2, "0")}`;
    // 4th: January of next year
    const d4 = `${academicStartYear + 1}-01-${String(clampDay(admDay, 1)).padStart(2, "0")}`;
    dates.push(d1, d2, d3, d4);
  } else {
    // Half-yearly
    // 1st: May
    const d1 = `${academicStartYear}-05-${String(clampDay(admDay, 5)).padStart(2, "0")}`;
    // 2nd: November
    const d2 = `${academicStartYear}-11-${String(clampDay(admDay, 11)).padStart(2, "0")}`;
    dates.push(d1, d2);
  }

  return dates;
}
