document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('reservation-form');
  const dateInput = document.querySelector('input[name="reservation_date"]');
  const timeSelect = document.querySelector('select[name="reservation_time"]');
  const submitButton = document.getElementById('submit-button');
  const status = document.getElementById('form-status');

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
    if (!dateInput || !timeSelect) return;

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

  if (dateInput && timeSelect) {
    const todayValue = toDateValue(new Date());
    dateInput.min = todayValue;
    if (!dateInput.value) dateInput.value = todayValue;
    populateTimes();
    dateInput.addEventListener('change', populateTimes);
  }

  function encodeFormData(formElement) {
    return new URLSearchParams(new FormData(formElement)).toString();
  }

  if (form) {
    form.addEventListener('submit', async (event) => {
      if (!form.checkValidity()) return;
      event.preventDefault();

      const firstName = (form.querySelector('[name="first_name"]')?.value || '').trim();
      const thankYouUrl = `/reservations/thank-you/${firstName ? `?name=${encodeURIComponent(firstName)}` : ''}`;

      try {
        sessionStorage.setItem('reservationFirstName', firstName);
      } catch (error) {
        // Ignore storage errors and continue with the query string fallback.
      }

      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = 'Sending...';
      }
      if (status) status.textContent = 'Sending your reservation request...';

      try {
        await fetch('/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: encodeFormData(form)
        });
        window.location.href = thankYouUrl;
      } catch (error) {
        if (status) status.textContent = 'There was a problem sending your request. Please try again or call (442) 282-5105.';
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.textContent = 'Request reservation';
        }
      }
    });
  }
});
