const DAY_NAMES = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
];

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

/** Returns an array of date options for the next 5 days formatted as "DD-MM-AAAA ( Día )" */
export function getDateOptions(): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  const today = new Date();

  for (let i = 0; i < 5; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const dd = pad(d.getDate());
    const mm = pad(d.getMonth() + 1);
    const yyyy = d.getFullYear();
    const dayName = DAY_NAMES[d.getDay()];
    const value = `${dd}-${mm}-${yyyy}`;
    const label = `${dd}-${mm}-${yyyy} ( ${dayName} )`;
    options.push({ value, label });
  }

  return options;
}

/** Returns time slot options from 19:00 to 23:00 every 15 min.
 *  If delayMinutes and selectedDate are provided and the date is today,
 *  slots earlier than now + delayMinutes are filtered out. */
export function getTimeSlots(delayMinutes?: number, selectedDate?: string): { value: string; label: string }[] {
  const slots: { value: string; label: string }[] = [];

  for (let h = 19; h <= 22; h++) {
    for (let m = 0; m < 60; m += 15) {
      const start = `${pad(h)}:${pad(m)}`;
      const endM = m + 15;
      const endH = endM >= 60 ? h + 1 : h;
      const endMin = endM >= 60 ? 0 : endM;
      const end = `${pad(endH)}:${pad(endMin)}`;
      const label = `${start} - ${end}`;
      slots.push({ value: label, label });
    }
  }

  // Filter by delay if today is selected
  if (delayMinutes && selectedDate) {
    const now = new Date();
    const todayStr = `${pad(now.getDate())}-${pad(now.getMonth() + 1)}-${now.getFullYear()}`;
    if (selectedDate === todayStr) {
      const cutoffMs = now.getTime() + delayMinutes * 60_000;
      const cutoffH = new Date(cutoffMs).getHours();
      const cutoffM = new Date(cutoffMs).getMinutes();
      const cutoffTotal = cutoffH * 60 + cutoffM;
      return slots.filter((s) => {
        const [startTime] = s.value.split(" - ");
        const [sh, sm] = startTime.split(":").map(Number);
        return sh * 60 + sm >= cutoffTotal;
      });
    }
  }

  return slots;
}

/** Format date+time for WhatsApp. Returns "LO ANTES POSIBLE." if defaults */
export function formatDateTimeForMessage(date: string, time: string): string {
  if (!date && !time) return "LO ANTES POSIBLE.";
  if (!date && time) return `LO ANTES POSIBLE.`;
  if (date && !time) return `${date}, LO ANTES POSIBLE.`;
  return `${date}, ${time}`;
}
