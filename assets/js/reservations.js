document.addEventListener('DOMContentLoaded', () => {
  const dateInput = document.querySelector('input[name="reservation_date"]');
  const timeSelect = document.querySelector('select[name="reservation_time"]');

  if (!dateInput || !timeSelect) return;

  const OPEN_HOUR = 10;
  const OPEN_MINUTE = 30;
  const LAST_HOUR = 21;
  const LAST_MINUTE = 30;
  const INTERVAL_MINUTES = 15;
  const SAME_DAY_NOTICE_MINUTES = 60;
  const SAME_DAY_CUTOFF_HOUR = 19;

  function pad(value) {
    return String(value).padStart(2, '0');
  }

  function toDateValue(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function formatTimeLabel(hours, minutes) {
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHour = hours % 12 || 12;
    return `${displayHour}:${pad(minutes)} ${period}`;
  }

  function minutesFromMidnight(date) {
    return date.getHours() * 60 + date.getMinutes();
  }

  function roundUpToInterval(totalMinutes, interval) {
    return Math.ceil(totalMinutes / interval) * interval;
  }

  function populateTimes() {
    const selectedDate = dateInput.value;
    const today = new Date();
    const todayValue = toDateValue(today);

    timeSelect.innerHTML = '<option value="">Select a time</option>';

    const openingMinutes = OPEN_HOUR * 60 + OPEN_MINUTE;
    const lastReservationMinutes = LAST_HOUR * 60 + LAST_MINUTE;

    let startMinutes = openingMinutes;

    if (selectedDate === todayValue) {
      if (today.getHours() >= SAME_DAY_CUTOFF_HOUR) {
        timeSelect.innerHTML = '<option value="">Reservations closed for today</option>';
        timeSelect.disabled = true;
        return;
      }

      startMinutes = Math.max(
        openingMinutes,
        roundUpToInterval(minutesFromMidnight(today) + SAME_DAY_NOTICE_MINUTES, INTERVAL_MINUTES)
      );
    }

    if (startMinutes > lastReservationMinutes) {
      timeSelect.innerHTML = '<option value="">No times available today</option>';
      timeSelect.disabled = true;
      return;
    }

    timeSelect.disabled = false;

    for (let total = startMinutes; total <= lastReservationMinutes; total += INTERVAL_MINUTES) {
      const hours = Math.floor(total / 60);
      const minutes = total % 60;
      const value = `${pad(hours)}:${pad(minutes)}`;

      const option = document.createElement('option');
      option.value = value;
      option.textContent = formatTimeLabel(hours, minutes);
      timeSelect.appendChild(option);
    }
  }

  const today = new Date();
  const todayValue = toDateValue(today);

  dateInput.min = todayValue;
  dateInput.value = todayValue;

  populateTimes();

  dateInput.addEventListener('change', populateTimes);
});